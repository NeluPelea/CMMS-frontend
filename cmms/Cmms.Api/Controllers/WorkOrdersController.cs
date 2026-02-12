using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using System.Security.Claims;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/work-orders")]
[Authorize]
public sealed class WorkOrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    public WorkOrdersController(AppDbContext db) => _db = db;

    // ---------------- Helpers ----------------

    private static DateTimeOffset? ToUtc(DateTimeOffset? x)
        => x.HasValue ? x.Value.ToUniversalTime() : (DateTimeOffset?)null;

    private static int? CalcMinutes(DateTimeOffset? startUtc, DateTimeOffset? stopUtc)
    {
        if (!startUtc.HasValue || !stopUtc.HasValue) return null;
        var diff = stopUtc.Value - startUtc.Value;
        if (diff.TotalMinutes < 0) return null;
        return (int)Math.Round(diff.TotalMinutes);
    }

    private string? GetActorId()
    {
        var v =
            User?.FindFirst("sub")?.Value ??
            User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
            User?.Identity?.Name;

        return string.IsNullOrWhiteSpace(v) ? null : v;
    }

    private void AddEvent(
        Guid woId,
        Guid corr,
        WorkOrderEventKind kind,
        string? field = null,
        string? oldV = null,
        string? newV = null,
        string? msg = null
    )
    {
        _db.WorkOrderEvents.Add(new WorkOrderEvent
        {
            WorkOrderId = woId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            ActorId = GetActorId(),
            Kind = kind,
            Field = field,
            OldValue = oldV,
            NewValue = newV,
            Message = msg,
            CorrelationId = corr
        });
    }

    // ---------------- DTOs ----------------

    public sealed record LocationDto(Guid Id, string Name, string? Code, bool IsAct);

    public sealed record AssetDto(
        Guid Id,
        string Name,
        string? Code,
        Guid? LocationId,
        LocationDto? Location,
        bool IsAct
    );

    public sealed record PersonDto(Guid Id, string DisplayName);

    public sealed record WorkOrderDto(
        Guid Id,
        WorkOrderType Type,
        WorkOrderClassification Classification,
        WorkOrderStatus Status,
        string Title,
        string? Description,
        Guid? AssetId,
        AssetDto? Asset,
        Guid? AssignedToPersonId,
        PersonDto? AssignedToPerson,
        DateTimeOffset? StartAt,
        DateTimeOffset? StopAt,
        int? DurationMinutes,
        Guid? PmPlanId,
        Guid? ExtraRequestId,
        string? Defect,
        string? Cause,
        string? Solution
    );

    public sealed record WorkOrderEventDto(
        Guid Id,
        DateTimeOffset CreatedAtUtc,
        string? ActorId,
        WorkOrderEventKind Kind,
        string? Field,
        string? OldValue,
        string? NewValue,
        string? Message,
        Guid? CorrelationId
    );

    public sealed record PagedResp<T>(int Total, int Take, int Skip, IReadOnlyList<T> Items);

    private static readonly Expression<Func<WorkOrder, WorkOrderDto>> WorkOrderToDto =
        x => new WorkOrderDto(
            x.Id,
            x.Type,
            x.Classification,
            x.Status,
            x.Title,
            x.Description,
            x.AssetId,
            x.Asset == null
                ? null
                : new AssetDto(
                    x.Asset.Id,
                    x.Asset.Name,
                    x.Asset.Code,
                    x.Asset.LocationId,
                    x.Asset.Location == null
                        ? null
                        : new LocationDto(
                            x.Asset.Location!.Id,
                            x.Asset.Location!.Name,
                            x.Asset.Location!.Code,
                            x.Asset.Location!.IsAct
                        ),
                    x.Asset.IsAct
                ),
            x.AssignedToPersonId,
            x.AssignedToPerson == null
                ? null
                : new PersonDto(
                    x.AssignedToPerson.Id,
                    x.AssignedToPerson.DisplayName
                ),
            x.StartAt,
            x.StopAt,
            x.DurationMinutes,
            x.PmPlanId,
            x.ExtraRequestId,
            x.Defect,
            x.Cause,
            x.Solution
        );

    private static readonly Expression<Func<WorkOrderEvent, WorkOrderEventDto>> WorkOrderEventToDto =
        e => new WorkOrderEventDto(
            e.Id,
            e.CreatedAtUtc,
            e.ActorId,
            e.Kind,
            e.Field,
            e.OldValue,
            e.NewValue,
            e.Message,
            e.CorrelationId
        );

    private IQueryable<WorkOrder> BaseEntityQuery()
        => _db.WorkOrders.AsNoTracking()
            .Include(w => w.Asset)!.ThenInclude(a => a!.Location)
            .Include(w => w.AssignedToPerson);

    // ---------------- LIST ----------------
    [HttpGet]
    [Authorize(Policy = "Perm:WO_READ")]
    public async Task<IActionResult> List(
        [FromQuery] string? q = null,
        [FromQuery] WorkOrderStatus? status = null,
        [FromQuery] WorkOrderType? type = null,
        [FromQuery] Guid? assetId = null,
        [FromQuery] Guid? locId = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int take = 50,
        [FromQuery] int skip = 0
    )
    {
        if (take <= 0) take = 50;
        if (take > 200) take = 200;
        if (skip < 0) skip = 0;

        var fromUtc = ToUtc(from);
        var toUtc = ToUtc(to);

        IQueryable<WorkOrder> qry = BaseEntityQuery();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            qry = qry.Where(x =>
                EF.Functions.ILike(x.Title, $"%{s}%") ||
                (x.Description != null && EF.Functions.ILike(x.Description, $"%{s}%"))
            );
        }

        if (status.HasValue) qry = qry.Where(x => x.Status == status.Value);
        if (type.HasValue) qry = qry.Where(x => x.Type == type.Value);
        if (assetId.HasValue) qry = qry.Where(x => x.AssetId == assetId.Value);

        if (locId.HasValue)
            qry = qry.Where(x => x.Asset != null && x.Asset.LocationId == locId.Value);

        // interval intersection [from,to]
        if (fromUtc.HasValue || toUtc.HasValue)
        {
            var f = fromUtc ?? DateTimeOffset.MinValue;
            var t = toUtc ?? DateTimeOffset.MaxValue;

            qry = qry.Where(x =>
                (x.StartAt ?? DateTimeOffset.MinValue) <= t &&
                (x.StopAt ?? DateTimeOffset.MaxValue) >= f
            );
        }

        var total = await qry.CountAsync();

        var items = await qry
            .OrderByDescending(x => x.StartAt ?? DateTimeOffset.MinValue)
            .ThenByDescending(x => x.Id)
            .Skip(skip)
            .Take(take)
            .Select(WorkOrderToDto)
            .ToListAsync();

        return Ok(new PagedResp<WorkOrderDto>(total, take, skip, items));
    }

    [HttpGet("counts")]
    public async Task<IActionResult> GetCounts(
        [FromQuery] string? q = null,
        [FromQuery] WorkOrderType? type = null,
        [FromQuery] Guid? assetId = null,
        [FromQuery] Guid? locId = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null
    )
    {
        var fromUtc = ToUtc(from);
        var toUtc = ToUtc(to);

        IQueryable<WorkOrder> qry = BaseEntityQuery();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            qry = qry.Where(x =>
                EF.Functions.ILike(x.Title, $"%{s}%") ||
                (x.Description != null && EF.Functions.ILike(x.Description, $"%{s}%"))
            );
        }

        if (type.HasValue) qry = qry.Where(x => x.Type == type.Value);
        if (assetId.HasValue) qry = qry.Where(x => x.AssetId == assetId.Value);

        if (locId.HasValue)
            qry = qry.Where(x => x.Asset != null && x.Asset.LocationId == locId.Value);

        // interval intersection [from,to]
        if (fromUtc.HasValue || toUtc.HasValue)
        {
            var f = fromUtc ?? DateTimeOffset.MinValue;
            var t = toUtc ?? DateTimeOffset.MaxValue;

            qry = qry.Where(x =>
                (x.StartAt ?? DateTimeOffset.MinValue) <= t &&
                (x.StopAt ?? DateTimeOffset.MaxValue) >= f
            );
        }

        var grouped = await qry
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var result = new Dictionary<string, int>
        {
            { "All", grouped.Sum(x => x.Count) },
            { "Open", grouped.FirstOrDefault(x => x.Status == WorkOrderStatus.Open)?.Count ?? 0 },
            { "InProgress", grouped.FirstOrDefault(x => x.Status == WorkOrderStatus.InProgress)?.Count ?? 0 },
            { "Done", grouped.FirstOrDefault(x => x.Status == WorkOrderStatus.Done)?.Count ?? 0 },
            { "Cancelled", grouped.FirstOrDefault(x => x.Status == WorkOrderStatus.Cancelled)?.Count ?? 0 }
        };

        return Ok(result);
    }

    // ---------------- GET BY ID ----------------
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var wo = await BaseEntityQuery()
            .Where(x => x.Id == id)
            .Select(WorkOrderToDto)
            .FirstOrDefaultAsync();

        if (wo == null) return NotFound();
        return Ok(wo);
    }

    // ---------------- EVENTS ----------------
    [HttpGet("{id:guid}/events")]
    public async Task<IActionResult> Events(
        Guid id,
        [FromQuery] int take = 50,
        [FromQuery] int skip = 0
    )
    {
        if (take <= 0) take = 50;
        if (take > 500) take = 500;
        if (skip < 0) skip = 0;

        var exists = await _db.WorkOrders.AsNoTracking().AnyAsync(x => x.Id == id);
        if (!exists) return NotFound();

        var total = await _db.WorkOrderEvents.AsNoTracking()
            .Where(e => e.WorkOrderId == id)
            .CountAsync();

        var items = await _db.WorkOrderEvents.AsNoTracking()
            .Where(e => e.WorkOrderId == id)
            .OrderByDescending(e => e.CreatedAtUtc)
            .ThenByDescending(e => e.Id)
            .Skip(skip)
            .Take(take)
            .Select(WorkOrderEventToDto)
            .ToListAsync();

        return Ok(new PagedResp<WorkOrderEventDto>(total, take, skip, items));
    }

    // ---------------- CREATE ----------------
    public sealed record CreateReq(
        string Title,
        string? Description,
        WorkOrderType Type,
        WorkOrderClassification? Classification,
        Guid? AssetId,
        Guid? AssignedToPersonId,
        DateTimeOffset? StartAt,
        DateTimeOffset? StopAt
    );

    [HttpPost]
    [Authorize(Policy = "Perm:WO_CREATE")]
    public async Task<IActionResult> Create([FromBody] CreateReq req)
    {
        if (req == null) return BadRequest("req null");

        var title = (req.Title ?? "").Trim();
        if (title.Length < 2) return BadRequest("title too short");
        if (title.Length > 200) return BadRequest("title too long");

        var startUtc = ToUtc(req.StartAt);
        var stopUtc = ToUtc(req.StopAt);

        if (stopUtc.HasValue && startUtc.HasValue && stopUtc.Value < startUtc.Value)
            return BadRequest("stopAt must be >= startAt");

        if (req.AssetId.HasValue)
        {
            var ok = await _db.Assets.AsNoTracking()
                .AnyAsync(a => a.Id == req.AssetId.Value && a.IsAct);
            if (!ok) return BadRequest("bad assetId");
        }

        if (req.AssignedToPersonId.HasValue)
        {
            var ok = await _db.People.AsNoTracking()
                .AnyAsync(p => p.Id == req.AssignedToPersonId.Value);
            if (!ok) return BadRequest("bad assignedToPersonId");
        }

        var wo = new WorkOrder
        {
            Title = title,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            Type = req.Type,
            Classification = req.Classification ?? WorkOrderClassification.Reactive,
            Status = WorkOrderStatus.Open,
            AssetId = req.AssetId,
            AssignedToPersonId = req.AssignedToPersonId,
            StartAt = startUtc,
            StopAt = stopUtc,
            DurationMinutes = CalcMinutes(startUtc, stopUtc),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.WorkOrders.Add(wo);

        var corr = Guid.NewGuid();
        AddEvent(wo.Id, corr, WorkOrderEventKind.Created, "title", null, wo.Title);
        AddEvent(wo.Id, corr, WorkOrderEventKind.StatusChanged, "status", null, WorkOrderStatus.Open.ToString());

        if (wo.AssetId.HasValue)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "assetId", null, wo.AssetId.Value.ToString());

        if (wo.AssignedToPersonId.HasValue)
            AddEvent(wo.Id, corr, WorkOrderEventKind.AssignedChanged, "assignedToPersonId", null, wo.AssignedToPersonId.Value.ToString());

        if (wo.StartAt.HasValue)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Started, "startAt", null, wo.StartAt.Value.ToString("O"));

        if (wo.StopAt.HasValue)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Stopped, "stopAt", null, wo.StopAt.Value.ToString("O"));

        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == wo.Id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }

    // ---------------- UPDATE ----------------
    public sealed record UpdateReq(
        string Title,
        string? Description,
        WorkOrderStatus Status,
        WorkOrderClassification? Classification,
        Guid? AssetId,
        Guid? AssignedToPersonId,
        DateTimeOffset? StartAt,
        DateTimeOffset? StopAt,
        string? Defect,
        string? Cause,
        string? Solution
    );

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Perm:WO_UPDATE")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReq req)
    {
        if (req == null) return BadRequest("req null");

        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        var corr = Guid.NewGuid();

        var oldTitle = wo.Title;
        var oldDesc = wo.Description;
        var oldAssetId = wo.AssetId;
        var oldAssigned = wo.AssignedToPersonId;
        var oldStart = wo.StartAt;
        var oldStop = wo.StopAt;
        var oldStatus = wo.Status;
        var oldClassification = wo.Classification;
        var oldDefect = wo.Defect;
        var oldCause = wo.Cause;
        var oldSolution = wo.Solution;

        var title = (req.Title ?? "").Trim();
        if (title.Length < 2) return BadRequest("title too short");
        if (title.Length > 200) return BadRequest("title too long");

        var startUtc = ToUtc(req.StartAt);
        var stopUtc = ToUtc(req.StopAt);

        if (stopUtc.HasValue && startUtc.HasValue && stopUtc.Value < startUtc.Value)
            return BadRequest("stopAt must be >= startAt");

        if (req.AssetId.HasValue)
        {
            var ok = await _db.Assets.AsNoTracking()
                .AnyAsync(a => a.Id == req.AssetId.Value && a.IsAct);
            if (!ok) return BadRequest("bad assetId");
        }

        if (req.AssignedToPersonId.HasValue)
        {
            var ok = await _db.People.AsNoTracking()
                .AnyAsync(p => p.Id == req.AssignedToPersonId.Value);
            if (!ok) return BadRequest("bad assignedToPersonId");
        }

        // Status inferred by time fields
        WorkOrderStatus inferred;
        if (startUtc == null && stopUtc == null) inferred = WorkOrderStatus.Open;
        else if (startUtc != null && stopUtc == null) inferred = WorkOrderStatus.InProgress;
        else inferred = WorkOrderStatus.Done;

        wo.Title = title;
        wo.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        wo.AssetId = req.AssetId;
        wo.AssignedToPersonId = req.AssignedToPersonId;
        wo.StartAt = startUtc;
        wo.StopAt = stopUtc;
        wo.DurationMinutes = CalcMinutes(startUtc, stopUtc);

        if (inferred == WorkOrderStatus.Open)
        {
            wo.Status = req.Status == WorkOrderStatus.Cancelled ? WorkOrderStatus.Cancelled : WorkOrderStatus.Open;
        }
        else
        {
            wo.Status = inferred;
        }

        wo.Defect = string.IsNullOrWhiteSpace(req.Defect) ? null : req.Defect.Trim();
        wo.Cause = string.IsNullOrWhiteSpace(req.Cause) ? null : req.Cause.Trim();
        wo.Solution = string.IsNullOrWhiteSpace(req.Solution) ? null : req.Solution.Trim();

        if (req.Classification.HasValue)
            wo.Classification = req.Classification.Value;

        // Audit diffs
        if (oldTitle != wo.Title) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "title", oldTitle, wo.Title);
        if (oldDesc != wo.Description) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "description", oldDesc, wo.Description);

        if (oldAssetId != wo.AssetId)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "assetId", oldAssetId?.ToString(), wo.AssetId?.ToString());

        if (oldAssigned != wo.AssignedToPersonId)
            AddEvent(wo.Id, corr, WorkOrderEventKind.AssignedChanged, "assignedToPersonId", oldAssigned?.ToString(), wo.AssignedToPersonId?.ToString());

        if (oldStart != wo.StartAt)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "startAt", oldStart?.ToString("O"), wo.StartAt?.ToString("O"));

        if (oldStop != wo.StopAt)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "stopAt", oldStop?.ToString("O"), wo.StopAt?.ToString("O"));

        if (oldStatus != wo.Status)
            AddEvent(wo.Id, corr, WorkOrderEventKind.StatusChanged, "status", oldStatus.ToString(), wo.Status.ToString());

        if (oldDefect != wo.Defect) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "defect", oldDefect, wo.Defect);
        if (oldCause != wo.Cause) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "cause", oldCause, wo.Cause);
        if (oldSolution != wo.Solution) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "solution", oldSolution, wo.Solution);
        if (oldClassification != wo.Classification) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "classification", oldClassification.ToString(), wo.Classification.ToString());

        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == wo.Id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }

    // ---------------- ACTIONS (STATE MACHINE) ----------------

    [HttpPost("{id:guid}/start")]
    [Authorize(Policy = "Perm:WO_EXECUTE")]
    public async Task<IActionResult> Start(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.Open)
            return BadRequest("Start allowed only when Status=Open.");

        var corr = Guid.NewGuid();
        var oldStatus = wo.Status;
        var oldStart = wo.StartAt;

        var now = DateTimeOffset.UtcNow;

        wo.Status = WorkOrderStatus.InProgress;
        if (!wo.StartAt.HasValue) wo.StartAt = now;

        wo.StopAt = null;
        wo.DurationMinutes = null;

        AddEvent(wo.Id, corr, WorkOrderEventKind.Started, "status", oldStatus.ToString(), wo.Status.ToString());
        if (oldStart != wo.StartAt) AddEvent(wo.Id, corr, WorkOrderEventKind.Started, "startAt", oldStart?.ToString("O"), wo.StartAt?.ToString("O"));

        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }

    [HttpPost("{id:guid}/stop")]
    [Authorize(Policy = "Perm:WO_EXECUTE")]
    public async Task<IActionResult> Stop(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.InProgress)
            return BadRequest("Stop allowed only when Status=InProgress.");

        var corr = Guid.NewGuid();
        var oldStatus = wo.Status;
        var oldStop = wo.StopAt;

        var now = DateTimeOffset.UtcNow;

        if (!wo.StartAt.HasValue) wo.StartAt = now;
        wo.StopAt = now;

        wo.Status = WorkOrderStatus.Done;
        wo.DurationMinutes = CalcMinutes(ToUtc(wo.StartAt), ToUtc(wo.StopAt));

        AddEvent(wo.Id, corr, WorkOrderEventKind.Stopped, "status", oldStatus.ToString(), wo.Status.ToString());
        if (oldStop != wo.StopAt) AddEvent(wo.Id, corr, WorkOrderEventKind.Stopped, "stopAt", oldStop?.ToString("O"), wo.StopAt?.ToString("O"));

        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.Open && wo.Status != WorkOrderStatus.InProgress)
            return BadRequest("Cancel allowed only when Status=Open or Status=InProgress.");

        var corr = Guid.NewGuid();
        var oldStatus = wo.Status;

        wo.Status = WorkOrderStatus.Cancelled;

        AddEvent(wo.Id, corr, WorkOrderEventKind.Cancelled, "status", oldStatus.ToString(), wo.Status.ToString());

        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }

    [HttpPost("{id:guid}/reopen")]
    public async Task<IActionResult> Reopen(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.Done && wo.Status != WorkOrderStatus.Cancelled)
            return BadRequest("Reopen allowed only when Status=Done or Status=Cancelled.");

        var corr = Guid.NewGuid();
        var oldStatus = wo.Status;
        var oldStart = wo.StartAt;
        var oldStop = wo.StopAt;

        wo.Status = WorkOrderStatus.Open;
        wo.StartAt = null;
        wo.StopAt = null;
        wo.DurationMinutes = null;

        AddEvent(wo.Id, corr, WorkOrderEventKind.Reopened, "status", oldStatus.ToString(), wo.Status.ToString());
        if (oldStart != wo.StartAt) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "startAt", oldStart?.ToString("O"), null);
        if (oldStop != wo.StopAt) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "stopAt", oldStop?.ToString("O"), null);

        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }
}
