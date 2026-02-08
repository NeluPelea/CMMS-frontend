using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public sealed class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    public DashboardController(AppDbContext db) => _db = db;

    // ---------------- DTOs ----------------

    public sealed record KpisDto(
        int WoTotal,
        int WoClosed,
        int WoInProgress,
        int WoOpen,
        int PmOnTime,
        int PmLate,
        int AssetsInMaintenance
    );

    public sealed record PersonActivityDto(
        Guid PersonId,
        DateTimeOffset FromUtc,
        DateTimeOffset ToUtc,
        int WoTotal,
        int WoClosed,
        int WoInProgress,
        int WoOpen,
        int WoCancelled,
        int TotalDurationMinutes,
        IReadOnlyList<ActivityWoRowDto> Items
    );

    public sealed record ActivityWoRowDto(
        Guid Id,
        string Title,
        WorkOrderStatus Status,
        Guid? AssetId,
        string? AssetName,
        DateTimeOffset? StartAt,
        DateTimeOffset? StopAt,
        int? DurationMinutes
    );

    public sealed record AssetInMaintDto(
        Guid AssetId,
        string AssetName,
        Guid? LocationId,
        string? LocationName,
        Guid WorkOrderId,
        string WorkOrderTitle,
        WorkOrderStatus WorkOrderStatus,
        Guid? AssignedToPersonId,
        string? AssignedToName,
        DateTimeOffset? StartAt
    );

    public sealed record PagedResp<T>(int Total, int Take, int Skip, IReadOnlyList<T> Items);

    // ---------------- Helpers ----------------

    private static DateTimeOffset UtcNow() => DateTimeOffset.UtcNow;

    private static (DateTimeOffset fromUtc, DateTimeOffset toUtc) ResolvePeriod(string? period)
    {
        // period: "week" | "month" | "quarter"
        // week = luni 00:00 -> acum
        var now = UtcNow();

        period = (period ?? "").Trim().ToLowerInvariant();
        if (period == "month")
        {
            var from = new DateTimeOffset(new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc));
            return (from, now);
        }
        if (period == "quarter")
        {
            var q = ((now.Month - 1) / 3) * 3 + 1;
            var from = new DateTimeOffset(new DateTime(now.Year, q, 1, 0, 0, 0, DateTimeKind.Utc));
            return (from, now);
        }

        // default week
        var delta = (int)now.DayOfWeek - (int)DayOfWeek.Monday;
        if (delta < 0) delta += 7;
        var monday = now.Date.AddDays(-delta); // Date is midnight local-kind, but here DateTimeOffset keeps offset; we want UTC:
        var fromWeek = new DateTimeOffset(new DateTime(monday.Year, monday.Month, monday.Day, 0, 0, 0, DateTimeKind.Utc));
        return (fromWeek, now);
    }

    // =====================================================================
    // 1) KPI GLOBAL
    // GET /api/dashboard/kpis?from=&to=&locId=&personId=
    // =====================================================================
    [HttpGet("kpis")]
    public async Task<IActionResult> GetKpis(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] Guid? locId = null,
        [FromQuery] Guid? personId = null
    )
    {
        var now = UtcNow();
        var fromUtc = (from?.ToUniversalTime()) ?? DateTimeOffset.MinValue;
        var toUtc = (to?.ToUniversalTime()) ?? DateTimeOffset.MaxValue;

        // WorkOrders query (filtru pe interval pe StartAt/StopAt; daca nu ai StartAt, nu intra in interval)
        IQueryable<WorkOrder> wq = _db.WorkOrders.AsNoTracking();

        if (locId.HasValue)
            wq = wq.Where(x => x.Asset != null && x.Asset.LocationId == locId.Value);

        if (personId.HasValue)
            wq = wq.Where(x => x.AssignedToPersonId == personId.Value);

        // interval intersection
        wq = wq.Where(x =>
            (x.StartAt ?? DateTimeOffset.MinValue) <= toUtc &&
            (x.StopAt ?? DateTimeOffset.MaxValue) >= fromUtc
        );

        var woTotal = await wq.CountAsync();
        var woClosed = await wq.CountAsync(x => x.Status == WorkOrderStatus.Done);
        var woInProgress = await wq.CountAsync(x => x.Status == WorkOrderStatus.InProgress);
        var woOpen = await wq.CountAsync(x => x.Status == WorkOrderStatus.Open);

        // PM KPIs (simple, din NextDueAt)
        IQueryable<PmPlan> pq = _db.PmPlans.AsNoTracking().Where(x => x.IsAct);

        if (locId.HasValue)
            pq = pq.Where(x => x.Asset != null && x.Asset.LocationId == locId.Value);

        var pmOnTime = await pq.CountAsync(x => x.NextDueAt >= now);
        var pmLate = await pq.CountAsync(x => x.NextDueAt < now);

        // Assets in maintenance = assets cu WO InProgress (optional: include Open)
        IQueryable<WorkOrder> maintQ = _db.WorkOrders.AsNoTracking()
            .Where(x => x.Status == WorkOrderStatus.InProgress);

        if (locId.HasValue)
            maintQ = maintQ.Where(x => x.Asset != null && x.Asset.LocationId == locId.Value);

        var assetsInMaintenance = await maintQ
            .Where(x => x.AssetId != null)
            .Select(x => x.AssetId!.Value)
            .Distinct()
            .CountAsync();

        return Ok(new KpisDto(
            WoTotal: woTotal,
            WoClosed: woClosed,
            WoInProgress: woInProgress,
            WoOpen: woOpen,
            PmOnTime: pmOnTime,
            PmLate: pmLate,
            AssetsInMaintenance: assetsInMaintenance
        ));
    }

    // =====================================================================
    // 2) ACTIVITATE ANGAJAT
    // GET /api/dashboard/people/{personId}/activity?period=week|month|quarter&take=&skip=
    // =====================================================================
    [HttpGet("people/{personId:guid}/activity")]
    public async Task<IActionResult> GetPersonActivity(
        Guid personId,
        [FromQuery] string? period = "week",
        [FromQuery] int take = 50,
        [FromQuery] int skip = 0
    )
    {
        if (take <= 0) take = 50;
        if (take > 200) take = 200;
        if (skip < 0) skip = 0;

        var (fromUtc, toUtc) = ResolvePeriod(period);

        var baseQ = _db.WorkOrders.AsNoTracking()
            .Include(x => x.Asset)
            .Where(x => x.AssignedToPersonId == personId)
            .Where(x =>
                (x.StartAt ?? DateTimeOffset.MinValue) <= toUtc &&
                (x.StopAt ?? DateTimeOffset.MaxValue) >= fromUtc
            );

        var total = await baseQ.CountAsync();

        var closed = await baseQ.CountAsync(x => x.Status == WorkOrderStatus.Done);
        var inProg = await baseQ.CountAsync(x => x.Status == WorkOrderStatus.InProgress);
        var open = await baseQ.CountAsync(x => x.Status == WorkOrderStatus.Open);
        var cancelled = await baseQ.CountAsync(x => x.Status == WorkOrderStatus.Cancelled);

        var totalMinutes = await baseQ
            .Select(x => x.DurationMinutes ?? 0)
            .SumAsync();

        var items = await baseQ
            .OrderByDescending(x => x.StartAt ?? DateTimeOffset.MinValue)
            .ThenByDescending(x => x.Id)
            .Skip(skip)
            .Take(take)
            .Select(x => new ActivityWoRowDto(
                x.Id,
                x.Title,
                x.Status,
                x.AssetId,
                x.Asset != null ? x.Asset.Name : null,
                x.StartAt,
                x.StopAt,
                x.DurationMinutes
            ))
            .ToListAsync();

        return Ok(new PersonActivityDto(
            PersonId: personId,
            FromUtc: fromUtc,
            ToUtc: toUtc,
            WoTotal: total,
            WoClosed: closed,
            WoInProgress: inProg,
            WoOpen: open,
            WoCancelled: cancelled,
            TotalDurationMinutes: totalMinutes,
            Items: items
        ));
    }

    // =====================================================================
    // 3) UTILAJELOR IN MENTENANTA
    // GET /api/dashboard/assets/in-maintenance?locId=
    // =====================================================================
    [HttpGet("assets/in-maintenance")]
    public async Task<IActionResult> GetAssetsInMaintenance([FromQuery] Guid? locId = null)
    {
        var q = _db.WorkOrders.AsNoTracking()
            .Where(x => x.Status == WorkOrderStatus.InProgress && x.AssetId != null);

        if (locId.HasValue)
            q = q.Where(x => x.Asset != null && x.Asset.LocationId == locId.Value);


        var rows = await q
            .OrderByDescending(x => x.StartAt ?? DateTimeOffset.MinValue)
            .Select(x => new AssetInMaintDto(
                x.AssetId!.Value,                                        // AssetId
                x.Asset!.Name,                                           // AssetName
                x.Asset.LocationId,                                      // LocationId
                x.Asset.Location != null ? x.Asset.Location.Name : null, // LocationName
                x.Id,                                                    // WorkOrderId
                x.Title,                                                 // WorkOrderTitle
                x.Status,                                                // WorkOrderStatus
                x.AssignedToPersonId,                                    // AssignedToPersonId
                x.AssignedToPerson != null ? x.AssignedToPerson.DisplayName : null, // AssignedToName
                x.StartAt                                                // StartAt
            ))
            .ToListAsync();

        var dedup = rows
            .GroupBy(x => x.AssetId)
            .Select(g => g.First())
            .OrderBy(x => x.AssetName)
            .ToList();

        return Ok(dedup);
    }


    // =====================================================================
    // 4) ACTIVE PEOPLE NOW
    // GET /api/dashboard/people-active-now
    // =====================================================================
    public sealed record PersonActiveNowDto(
        Guid PersonId,
        string PersonName,
        string ActivityType, // "WO" | "Extra"
        string ActivityTitle,
        DateTimeOffset? StartedAt, // Local or UTC? we send UTC usually
        Guid? AssetId = null,
        string? AssetName = null,
        string? LocationName = null
    );

    [HttpGet("people-active-now")]
    public async Task<IActionResult> GetPeopleActiveNow()
    {
        // 1. WOs InProgress (AssignedToPersonId != null)
        var wos = await _db.WorkOrders.AsNoTracking()
            .Where(x => x.Status == WorkOrderStatus.InProgress && x.AssignedToPersonId != null)
            .Select(x => new
            {
                PersonId = x.AssignedToPersonId!.Value,
                PersonName = x.AssignedToPerson != null ? x.AssignedToPerson.DisplayName : "Unknown",
                Type = "WO",
                Title = x.Title,
                Start = x.StartAt,
                AssetId = x.AssetId,
                AssetName = x.Asset != null ? x.Asset.Name : null,
                LocationName = x.Asset != null && x.Asset.Location != null ? x.Asset.Location.Name : null
            })
            .ToListAsync();

        // 2. ExtraJobs InProgress (or Open with StartAt, and no StopAt)
        // We need to fetch basic fields first because we can't easily merge 2 different queries unless we use a common DTO or anonymous type in memory.
        // Actually we can project to anonymous types that match structure.
        var extras = await _db.ExtraJobs.AsNoTracking()
            .Where(x => (x.Status == WorkOrderStatus.InProgress || x.Status == WorkOrderStatus.Open)
                        && x.AssignedToPersonId != null
                        && x.StartAt != null
                        && x.StopAt == null)
            .Select(x => new
            {
                PersonId = x.AssignedToPersonId!.Value,
                PersonName = x.AssignedToPerson != null ? x.AssignedToPerson.DisplayName : "Unknown",
                Type = "Extra",
                Title = x.Title,
                Start = x.StartAt,
                AssetId = (Guid?)null,
                AssetName = (string?)null,
                LocationName = (string?)null
            })
            .ToListAsync();

        // 3. Merge & Prioritize
        var all = wos.Concat(extras).ToList();

        var grouped = all.GroupBy(x => x.PersonId);
        var result = new List<PersonActiveNowDto>();

        foreach (var g in grouped)
        {
            // Priority: WO > Extra.
            // If we sort by Type descending, "WO" > "Extra".
            // If multiple WOs, maybe take latest start?
            var best = g.OrderByDescending(x => x.Type).ThenByDescending(x => x.Start).First();

            result.Add(new PersonActiveNowDto(
                best.PersonId,
                best.PersonName,
                best.Type,
                best.Type == "WO" ? $"WO: {best.Title}" : $"Extra: {best.Title}",
                best.Start,
                best.AssetId,
                best.AssetName,
                best.LocationName
            ));
        }

        return Ok(result.OrderBy(x => x.PersonName));
    }

}
