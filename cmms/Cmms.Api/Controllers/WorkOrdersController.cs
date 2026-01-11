using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/work-orders")]
[Authorize]
public class WorkOrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    public WorkOrdersController(AppDbContext db) => _db = db;

    private static DateTimeOffset? ToUtc(DateTimeOffset? x)
        => x.HasValue ? x.Value.ToUniversalTime() : (DateTimeOffset?)null;

    private static int? CalcMinutes(DateTimeOffset? startUtc, DateTimeOffset? stopUtc)
    {
        if (!startUtc.HasValue || !stopUtc.HasValue) return null;
        var diff = stopUtc.Value - startUtc.Value;
        if (diff.TotalMinutes < 0) return null;
        return (int)Math.Round(diff.TotalMinutes);
    }

    // Derivam status numai din timpi
    private static WorkOrderStatus InferStatus(DateTimeOffset? startUtc, DateTimeOffset? stopUtc)
    {
        if (stopUtc.HasValue) return WorkOrderStatus.Done;
        if (startUtc.HasValue) return WorkOrderStatus.InProgress;
        return WorkOrderStatus.Open;
    }

    // ---------------- DTOs ----------------

    public sealed record LocationDto(Guid Id, string Name, string? Code, bool IsAct);

    public sealed record AssetDto(
        Guid Id,
        string Name,
        string Code,
        Guid? LocationId,          // IMPORTANT: Guid? ca sa eviti CS1503
        LocationDto? Location,
        bool IsAct
    );

    public sealed record PersonDto(Guid Id, string DisplayName);

    public sealed record WorkOrderListItemDto(
        Guid Id,
        WorkOrderType Type,
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
        Guid? ExtraRequestId
    );

    public sealed record PagedResp<T>(int Total, int Take, int Skip, IReadOnlyList<T> Items);

    // ---------------- LIST ----------------
    [HttpGet]
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

        var qry = _db.WorkOrders.AsNoTracking().AsQueryable();

        // Text search (PostgreSQL): ILIKE
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

        // Interval filtering: workorders care se intersecteaza cu [from,to]
        if (fromUtc.HasValue || toUtc.HasValue)
        {
            var f = fromUtc ?? DateTimeOffset.MinValue;
            var t = toUtc ?? DateTimeOffset.MaxValue;

            qry = qry.Where(x =>
                (x.StartAt ?? DateTimeOffset.MinValue) <= t &&
                ((x.StopAt ?? DateTimeOffset.MaxValue) >= f)
            );
        }

        var total = await qry.CountAsync();

        var items = await qry
            .OrderByDescending(x => x.StartAt ?? DateTimeOffset.MinValue)
            .ThenByDescending(x => x.Id)
            .Skip(skip)
            .Take(take)
            .Select(x => new WorkOrderListItemDto(
                x.Id,
                x.Type,
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
                                x.Asset.Location.Id,
                                x.Asset.Location.Name,
                                x.Asset.Location.Code,
                                x.Asset.Location.IsAct
                            ),
                        x.Asset.IsAct
                    ),
                x.AssignedToPersonId,
                x.AssignedToPerson == null
                    ? null
                    : new PersonDto(x.AssignedToPerson.Id, x.AssignedToPerson.DisplayName),
                x.StartAt,
                x.StopAt,
                x.DurationMinutes,
                x.PmPlanId,
                x.ExtraRequestId
            ))
            .ToListAsync();

        return Ok(new PagedResp<WorkOrderListItemDto>(total, take, skip, items));
    }

    // ---------------- GET BY ID ----------------
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var wo = await _db.WorkOrders.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                id = x.Id,
                type = x.Type,
                status = x.Status,
                title = x.Title,
                description = x.Description,
                assetId = x.AssetId,
                asset = x.Asset == null ? null : new
                {
                    id = x.Asset.Id,
                    name = x.Asset.Name,
                    code = x.Asset.Code,
                    locationId = x.Asset.LocationId,
                    location = x.Asset.Location == null ? null : new
                    {
                        id = x.Asset.Location.Id,
                        name = x.Asset.Location.Name,
                        code = x.Asset.Location.Code,
                        isAct = x.Asset.Location.IsAct
                    },
                    isAct = x.Asset.IsAct
                },
                assignedToPersonId = x.AssignedToPersonId,
                assignedToPerson = x.AssignedToPerson == null ? null : new
                {
                    id = x.AssignedToPerson.Id,
                    displayName = x.AssignedToPerson.DisplayName
                },
                startAt = x.StartAt,
                stopAt = x.StopAt,
                durationMinutes = x.DurationMinutes,
                pmPlanId = x.PmPlanId,
                extraRequestId = x.ExtraRequestId
            })
            .FirstOrDefaultAsync();

        if (wo == null) return NotFound();
        return Ok(wo);
    }

    // ---------------- CREATE ----------------
    public record CreateReq(
        string Title,
        string? Description,
        WorkOrderType Type,
        Guid? AssetId,
        Guid? AssignedToPersonId,
        DateTimeOffset? StartAt,
        DateTimeOffset? StopAt
    );

    [HttpPost]
    public async Task<IActionResult> Create(CreateReq req)
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
            var ok = await _db.Assets.AsNoTracking().AnyAsync(a => a.Id == req.AssetId.Value);
            if (!ok) return BadRequest("bad assetId");
        }

        if (req.AssignedToPersonId.HasValue)
        {
            var ok = await _db.People.AsNoTracking().AnyAsync(p => p.Id == req.AssignedToPersonId.Value);
            if (!ok) return BadRequest("bad assignedToPersonId");
        }

        var wo = new WorkOrder
        {
            Title = title,
            Description = req.Description,
            Type = req.Type,
            AssetId = req.AssetId,
            AssignedToPersonId = req.AssignedToPersonId,
            StartAt = startUtc,
            StopAt = stopUtc
        };

        wo.DurationMinutes = CalcMinutes(startUtc, stopUtc);
        wo.Status = InferStatus(startUtc, stopUtc);

        _db.WorkOrders.Add(wo);
        await _db.SaveChangesAsync();

        var outWo = await _db.WorkOrders.AsNoTracking()
            .Include(x => x.Asset).ThenInclude(a => a.Location)
            .Include(x => x.AssignedToPerson)
            .FirstAsync(x => x.Id == wo.Id);

        return Ok(outWo);
    }

    // ---------------- UPDATE ----------------
    public record UpdateReq(
        string Title,
        string? Description,
        WorkOrderStatus Status, // folosit doar pt Cancelled cand WO e Open
        Guid? AssetId,
        Guid? AssignedToPersonId,
        DateTimeOffset? StartAt,
        DateTimeOffset? StopAt
    );

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateReq req)
    {
        if (req == null) return BadRequest("req null");

        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        var title = (req.Title ?? "").Trim();
        if (title.Length < 2) return BadRequest("title too short");
        if (title.Length > 200) return BadRequest("title too long");

        var startUtc = ToUtc(req.StartAt);
        var stopUtc = ToUtc(req.StopAt);

        if (stopUtc.HasValue && startUtc.HasValue && stopUtc.Value < startUtc.Value)
            return BadRequest("stopAt must be >= startAt");

        if (req.AssetId.HasValue)
        {
            var ok = await _db.Assets.AsNoTracking().AnyAsync(a => a.Id == req.AssetId.Value);
            if (!ok) return BadRequest("bad assetId");
        }

        if (req.AssignedToPersonId.HasValue)
        {
            var ok = await _db.People.AsNoTracking().AnyAsync(p => p.Id == req.AssignedToPersonId.Value);
            if (!ok) return BadRequest("bad assignedToPersonId");
        }

        wo.Title = title;
        wo.Description = req.Description;
        wo.AssetId = req.AssetId;
        wo.AssignedToPersonId = req.AssignedToPersonId;

        wo.StartAt = startUtc;
        wo.StopAt = stopUtc;
        wo.DurationMinutes = CalcMinutes(startUtc, stopUtc);

        var inferred = InferStatus(startUtc, stopUtc);
        if (inferred == WorkOrderStatus.Open)
            wo.Status = req.Status == WorkOrderStatus.Cancelled ? WorkOrderStatus.Cancelled : WorkOrderStatus.Open;
        else
            wo.Status = inferred;

        await _db.SaveChangesAsync();

        var outWo = await _db.WorkOrders.AsNoTracking()
            .Include(x => x.Asset).ThenInclude(a => a.Location)
            .Include(x => x.AssignedToPerson)
            .FirstAsync(x => x.Id == wo.Id);

        return Ok(outWo);
    }

    // ---------------- ACTIONS ----------------

    [HttpPost("{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.Open)
            return BadRequest("Start allowed only when Status=Open.");

        var now = DateTimeOffset.UtcNow;

        wo.Status = WorkOrderStatus.InProgress;
        if (wo.StartAt == null)
            wo.StartAt = now;

        wo.StopAt = null;
        wo.DurationMinutes = null;

        await _db.SaveChangesAsync();

        return Ok(new { id = wo.Id, status = wo.Status, startAt = wo.StartAt, stopAt = wo.StopAt, durationMinutes = wo.DurationMinutes });
    }

    [HttpPost("{id:guid}/stop")]
    public async Task<IActionResult> Stop(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.InProgress)
            return BadRequest("Stop allowed only when Status=InProgress.");

        var now = DateTimeOffset.UtcNow;

        if (wo.StartAt == null)
            wo.StartAt = now;

        wo.StopAt = now;
        wo.Status = WorkOrderStatus.Done;

        var startUtc = ToUtc(wo.StartAt);
        var stopUtc = ToUtc(wo.StopAt);
        wo.DurationMinutes = CalcMinutes(startUtc, stopUtc);

        await _db.SaveChangesAsync();

        return Ok(new { id = wo.Id, status = wo.Status, startAt = wo.StartAt, stopAt = wo.StopAt, durationMinutes = wo.DurationMinutes });
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.Open && wo.Status != WorkOrderStatus.InProgress)
            return BadRequest("Cancel allowed only when Status=Open or Status=InProgress.");

        wo.Status = WorkOrderStatus.Cancelled;
        await _db.SaveChangesAsync();

        return Ok(new { id = wo.Id, status = wo.Status });
    }

    [HttpPost("{id:guid}/reopen")]
    public async Task<IActionResult> Reopen(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.Done && wo.Status != WorkOrderStatus.Cancelled)
            return BadRequest("Reopen allowed only when Status=Done or Status=Cancelled.");

        wo.Status = WorkOrderStatus.Open;
        wo.StartAt = null;
        wo.StopAt = null;
        wo.DurationMinutes = null;

        await _db.SaveChangesAsync();

        return Ok(new { id = wo.Id, status = wo.Status, startAt = wo.StartAt, stopAt = wo.StopAt, durationMinutes = wo.DurationMinutes });
    }

    // One-time repair
    [HttpPost("repair-status")]
    public async Task<IActionResult> RepairStatus()
    {
        var list = await _db.WorkOrders.ToListAsync();
        var changed = 0;

        foreach (var wo in list)
        {
            var old = wo.Status;

            var startUtc = ToUtc(wo.StartAt);
            var stopUtc = ToUtc(wo.StopAt);

            var inferred = InferStatus(startUtc, stopUtc);

            if (wo.Status == WorkOrderStatus.Cancelled && !stopUtc.HasValue)
            {
                // keep Cancelled
            }
            else
            {
                wo.Status = inferred;
            }

            wo.DurationMinutes = CalcMinutes(startUtc, stopUtc);

            if (wo.Status != old) changed++;
        }

        await _db.SaveChangesAsync();
        return Ok(new { changed });
    }
}
