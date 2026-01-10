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

    // Derivam status numai din timpi, util pentru Create/Update + repair
    private static WorkOrderStatus InferStatus(DateTimeOffset? startUtc, DateTimeOffset? stopUtc)
    {
        if (stopUtc.HasValue) return WorkOrderStatus.Done;
        if (startUtc.HasValue) return WorkOrderStatus.InProgress;
        return WorkOrderStatus.Open;
    }

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

        var qry = _db.WorkOrders.AsNoTracking()
            .Include(x => x.Asset)
                .ThenInclude(a => a.Location)
            .Include(x => x.AssignedToPerson)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();
            qry = qry.Where(x =>
                x.Title.ToLower().Contains(s) ||
                (x.Description != null && x.Description.ToLower().Contains(s))
            );
        }

        if (status.HasValue) qry = qry.Where(x => x.Status == status.Value);
        if (type.HasValue) qry = qry.Where(x => x.Type == type.Value);
        if (assetId.HasValue) qry = qry.Where(x => x.AssetId == assetId.Value);

        if (locId.HasValue)
            qry = qry.Where(x => x.Asset != null && x.Asset.LocationId == locId.Value);

        if (fromUtc.HasValue)
            qry = qry.Where(x => (x.StartAt ?? DateTimeOffset.MinValue) >= fromUtc.Value);

        if (toUtc.HasValue)
            qry = qry.Where(x => (x.StartAt ?? DateTimeOffset.MinValue) <= toUtc.Value);

        var total = await qry.CountAsync();

        var items = await qry
            .OrderByDescending(x => x.StartAt ?? DateTimeOffset.MinValue)
            .Skip(skip)
            .Take(take)
            .ToListAsync();

        return Ok(new { total, take, skip, items });
    }

    // ---------------- GET BY ID ----------------
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var wo = await _db.WorkOrders.AsNoTracking()
            .Include(x => x.Asset)
                .ThenInclude(a => a.Location)
            .Include(x => x.AssignedToPerson)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (wo == null) return NotFound();

        return Ok(new
        {
            id = wo.Id,
            type = wo.Type,
            status = wo.Status,
            title = wo.Title,
            description = wo.Description,
            assetId = wo.AssetId,
            assetName = wo.Asset?.Name,
            locId = wo.Asset?.LocationId,
            locName = wo.Asset?.Location?.Name,
            assignedToPersonId = wo.AssignedToPersonId,
            assignedToPersonName = wo.AssignedToPerson?.DisplayName,
            startAt = wo.StartAt,
            stopAt = wo.StopAt,
            durationMinutes = wo.DurationMinutes,
            pmPlanId = wo.PmPlanId,
            extraRequestId = wo.ExtraRequestId
        });
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
            StopAt = stopUtc,
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
        WorkOrderStatus Status,
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

        // Regula consistenta: timpii dicteaza statusul (Open/InProgress/Done).
        // Daca nu exista timpi (Open), acceptam Status din request DOAR daca e Open/Cancelled.
        var inferred = InferStatus(startUtc, stopUtc);
        if (inferred == WorkOrderStatus.Open)
        {
            // daca user vrea sa marcheze Cancelled prin Update, acceptam; altfel Open
            wo.Status = req.Status == WorkOrderStatus.Cancelled ? WorkOrderStatus.Cancelled : WorkOrderStatus.Open;
        }
        else
        {
            wo.Status = inferred;
        }

        await _db.SaveChangesAsync();

        var outWo = await _db.WorkOrders.AsNoTracking()
            .Include(x => x.Asset).ThenInclude(a => a.Location)
            .Include(x => x.AssignedToPerson)
            .FirstAsync(x => x.Id == wo.Id);

        return Ok(outWo);
    }

    // ---------------- ACTIONS (STATE MACHINE) ----------------

    // Open -> InProgress
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

        // curatam orice "stop" existent
        wo.StopAt = null;
        wo.DurationMinutes = null;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            id = wo.Id,
            status = wo.Status,
            startAt = wo.StartAt,
            stopAt = wo.StopAt,
            durationMinutes = wo.DurationMinutes
        });
    }

    // InProgress -> Done
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

        return Ok(new
        {
            id = wo.Id,
            status = wo.Status,
            startAt = wo.StartAt,
            stopAt = wo.StopAt,
            durationMinutes = wo.DurationMinutes
        });
    }

    // Open/InProgress -> Cancelled
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

    // Done/Cancelled -> Open
    [HttpPost("{id:guid}/reopen")]
    public async Task<IActionResult> Reopen(Guid id)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        if (wo.Status != WorkOrderStatus.Done && wo.Status != WorkOrderStatus.Cancelled)
            return BadRequest("Reopen allowed only when Status=Done or Status=Cancelled.");

        wo.Status = WorkOrderStatus.Open;

        // resetam timpii
        wo.StartAt = null;
        wo.StopAt = null;
        wo.DurationMinutes = null;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            id = wo.Id,
            status = wo.Status,
            startAt = wo.StartAt,
            stopAt = wo.StopAt,
            durationMinutes = wo.DurationMinutes
        });
    }

    // --------- ONE-TIME REPAIR (optional) ---------
    // Rulezi o singura data din Swagger si apoi poti sterge metoda.
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

            // nu rescriem Cancelled daca e deja Cancelled si nu are stop
            // (dar daca are stop, trebuie sa fie Done)
            if (wo.Status == WorkOrderStatus.Cancelled && !stopUtc.HasValue)
            {
                // pastram Cancelled
            }
            else
            {
                wo.Status = inferred;
            }

            var newDur = CalcMinutes(startUtc, stopUtc);
            if (newDur.HasValue) wo.DurationMinutes = newDur;

            if (wo.Status != old) changed++;
        }

        await _db.SaveChangesAsync();
        return Ok(new { changed });
    }
}
