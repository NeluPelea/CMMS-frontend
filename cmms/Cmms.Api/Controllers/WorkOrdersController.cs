using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

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

    // IMPORTANT: Proiecție EF-translatable (Expression), reutilizabilă peste tot.
    private static readonly Expression<Func<WorkOrder, WorkOrderDto>> WorkOrderToDto =
        x => new WorkOrderDto(
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
                : new PersonDto(
                    x.AssignedToPerson.Id,
                    x.AssignedToPerson.DisplayName
                ),
            x.StartAt,
            x.StopAt,
            x.DurationMinutes,
            x.PmPlanId,
            x.ExtraRequestId
        );

    // Query de bază pe entity (include navigații pentru a evita surprize la lazy-loading / nulls).
    private IQueryable<WorkOrder> BaseEntityQuery()
        => _db.WorkOrders.AsNoTracking()
            .Include(w => w.Asset)!.ThenInclude(a => a.Location)
            .Include(w => w.AssignedToPerson);

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

        // IMPORTANT: sort/paging pe entity, apoi proiectie DTO
        var items = await qry
            .OrderByDescending(x => x.StartAt ?? DateTimeOffset.MinValue)
            .ThenByDescending(x => x.Id)
            .Skip(skip)
            .Take(take)
            .Select(WorkOrderToDto)
            .ToListAsync();

        return Ok(new PagedResp<WorkOrderDto>(total, take, skip, items));
    }

    // ---------------- GET BY ID ----------------
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        // IMPORTANT: filtrare pe entity, nu pe DTO
        var wo = await BaseEntityQuery()
            .Where(x => x.Id == id)
            .Select(WorkOrderToDto)
            .FirstOrDefaultAsync();

        if (wo == null) return NotFound();
        return Ok(wo);
    }

    // ---------------- CREATE ----------------
    public sealed record CreateReq(
        string Title,
        string? Description,
        WorkOrderType Type,
        Guid? AssetId,
        Guid? AssignedToPersonId,
        DateTimeOffset? StartAt,
        DateTimeOffset? StopAt
    );

    [HttpPost]
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

            // la Create: status initial Open (state machine decide Start/Stop)
            Status = WorkOrderStatus.Open,

            AssetId = req.AssetId,
            AssignedToPersonId = req.AssignedToPersonId,

            StartAt = startUtc,
            StopAt = stopUtc,
            DurationMinutes = CalcMinutes(startUtc, stopUtc)
        };

        _db.WorkOrders.Add(wo);
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
        Guid? AssetId,
        Guid? AssignedToPersonId,
        DateTimeOffset? StartAt,
        DateTimeOffset? StopAt
    );

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReq req)
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

        // IMPORTANT: statusul trebuie sa fie coerent cu state-machine.
        // Permitem update de campuri; statusul il lasam doar Open/Cancelled daca nu ai timpi,
        // altfel timpii dicteaza:
        // - start != null && stop == null -> InProgress
        // - start != null && stop != null -> Done
        // - start == null && stop == null -> Open sau Cancelled (din request)
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
            // cand nu ai timpi, permit doar Open/Cancelled
            wo.Status = req.Status == WorkOrderStatus.Cancelled ? WorkOrderStatus.Cancelled : WorkOrderStatus.Open;
        }
        else
        {
            // timpii dicteaza
            wo.Status = inferred;
        }

        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == wo.Id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }

    // ---------------- ACTIONS (STATE MACHINE) ----------------

    [HttpPost("{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.Open)
            return BadRequest("Start allowed only when Status=Open.");

        var now = DateTimeOffset.UtcNow;

        wo.Status = WorkOrderStatus.InProgress;
        if (!wo.StartAt.HasValue) wo.StartAt = now;

        wo.StopAt = null;
        wo.DurationMinutes = null;

        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }

    [HttpPost("{id:guid}/stop")]
    public async Task<IActionResult> Stop(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.InProgress)
            return BadRequest("Stop allowed only when Status=InProgress.");

        var now = DateTimeOffset.UtcNow;

        if (!wo.StartAt.HasValue) wo.StartAt = now; // fallback defensiv
        wo.StopAt = now;

        wo.Status = WorkOrderStatus.Done;
        wo.DurationMinutes = CalcMinutes(ToUtc(wo.StartAt), ToUtc(wo.StopAt));

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

        wo.Status = WorkOrderStatus.Cancelled;

        // recomandare: NU setam StopAt la cancel (ramane null)
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

        wo.Status = WorkOrderStatus.Open;
        wo.StartAt = null;
        wo.StopAt = null;
        wo.DurationMinutes = null;

        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }
}
