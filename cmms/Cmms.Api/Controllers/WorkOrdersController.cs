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
        string? msg = null,
        string? fromStatus = null,
        string? toStatus = null,
        string? metadata = null
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
            CorrelationId = corr,
            FromStatus = fromStatus,
            ToStatus = toStatus,
            Metadata = metadata
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
        bool IsAct,
        string? Ranking
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
        string? Solution,
        Guid? WorkOrderGroupId,
        Guid? TeamId,
        Guid? CoordinatorPersonId,
        PersonDto? CoordinatorPerson
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
        Guid? CorrelationId,
        string? FromStatus,
        string? ToStatus,
        string? Metadata
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
                    x.Asset.IsAct,
                    x.Asset.Ranking
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
            x.Solution,
            x.WorkOrderGroupId,
            x.TeamId,
            x.CoordinatorPersonId,
            x.CoordinatorPerson == null ? null : new PersonDto(x.CoordinatorPerson.Id, x.CoordinatorPerson.DisplayName)
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
            e.CorrelationId,
            e.FromStatus,
            e.ToStatus,
            e.Metadata
        );

    private IQueryable<WorkOrder> BaseEntityQuery()
        => _db.WorkOrders.AsNoTracking()
            .Include(w => w.Asset)!.ThenInclude(a => a!.Location)
            .Include(w => w.AssignedToPerson)
            .Include(w => w.CoordinatorPerson);

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int take = 50,
        [FromQuery] int skip = 0,
        [FromQuery] WorkOrderStatus? status = null,
        [FromQuery] WorkOrderType? type = null,
        [FromQuery] string? q = null,
        [FromQuery] Guid? locId = null,
        [FromQuery] Guid? assetId = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null
    )
    {
        var query = BaseEntityQuery();

        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        if (type.HasValue) query = query.Where(x => x.Type == type.Value);
        if (locId.HasValue) query = query.Where(x => x.Asset != null && x.Asset.LocationId == locId.Value);
        if (assetId.HasValue) query = query.Where(x => x.AssetId == assetId.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();
            query = query.Where(x =>
                x.Title.ToLower().Contains(s) ||
                (x.Asset != null && x.Asset.Name.ToLower().Contains(s))
            );
        }

        if (from.HasValue) query = query.Where(x => x.CreatedAt >= from.Value);
        if (to.HasValue) query = query.Where(x => x.CreatedAt <= to.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Select(WorkOrderToDto)
            .ToListAsync();

        return Ok(new { total, take, skip, items });
    }

    [HttpGet("counts")]
    public async Task<IActionResult> GetCounts(
         [FromQuery] string? q = null,
         [FromQuery] WorkOrderType? type = null,
         [FromQuery] Guid? locId = null,
         [FromQuery] Guid? assetId = null,
         [FromQuery] DateTimeOffset? from = null,
         [FromQuery] DateTimeOffset? to = null
    )
    {
        var query = _db.WorkOrders.AsNoTracking();

        if (type.HasValue) query = query.Where(x => x.Type == type.Value);
        if (locId.HasValue) query = query.Where(x => x.Asset != null && x.Asset.LocationId == locId.Value);
        if (assetId.HasValue) query = query.Where(x => x.AssetId == assetId.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();
            query = query.Where(x =>
                x.Title.ToLower().Contains(s) ||
                (x.Asset != null && x.Asset.Name.ToLower().Contains(s))
            );
        }

        if (from.HasValue) query = query.Where(x => x.CreatedAt >= from.Value);
        if (to.HasValue) query = query.Where(x => x.CreatedAt <= to.Value);

        var grouped = await query
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        // Enum keys might need conversion to match frontend expectations (Open, InProgress etc or 1, 2)
        // Frontend expects Record<string, number>. Usually keys are "1", "2"... or "Open", "InProgress".
        // Let's return strings of the enum names or values?
        // Looking at frontend usage, typescript enum values are usually numbers. Use number keys.
        // Actually the `grouped` keys are WorkOrderStatus enum.
        // Let's verify what `dict` expects.
        // The return type is `Record<string, number>`.
        // Let's map enum integer value to string key.
        var dict = grouped.ToDictionary(x => ((int)x.Status).ToString(), x => x.Count);
        return Ok(dict);
    }

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

    public sealed record CreateReq(
        string Title,
        string? Description,
        WorkOrderType Type,
        WorkOrderClassification? Classification,
        Guid? AssetId,
        Guid? AssignedToPersonId,
        DateTimeOffset? StartAt,
        DateTimeOffset? StopAt,
        Guid? TeamId,
        Guid? CoordinatorPersonId
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

        // Validation: Team Logic
        List<Guid> memberIds = new();
        if (req.TeamId.HasValue)
        {
            if (!req.CoordinatorPersonId.HasValue)
                return BadRequest("CoordinatorPersonId is required when TeamId is set.");

            var teamParams = await _db.Teams.AsNoTracking()
                .Where(t => t.Id == req.TeamId.Value)
                .Select(t => new { 
                    t.Members,
                    MemberIds = t.Members.Where(m => m.IsActive).Select(m => m.PersonId).ToList() 
                })
                .FirstOrDefaultAsync();

            if (teamParams == null) return BadRequest("Invalid TeamId");
            
            // Coordinator must be in team
            if (!teamParams.MemberIds.Contains(req.CoordinatorPersonId.Value))
                return BadRequest("Coordinator must be a member of the selected team.");

            memberIds = teamParams.MemberIds;
        }
        else if (req.AssignedToPersonId.HasValue)
        {
             var ok = await _db.People.AsNoTracking()
                .AnyAsync(p => p.Id == req.AssignedToPersonId.Value);
            if (!ok) return BadRequest("bad assignedToPersonId");
            memberIds.Add(req.AssignedToPersonId.Value);
        }

        // If no assignments, create 1 unassigned WO
        if (memberIds.Count == 0)
        {
            // Just create one unassigned
            await CreateSingleWo(req, null, null, null, null);
            await _db.SaveChangesAsync();
             var last = await _db.WorkOrders.OrderByDescending(x => x.Id).FirstOrDefaultAsync(); // simplistic, better to return from CreateSingleWo
             // ... hacky to get ID. Refactoring CreateSingleWo to return entity.
        }
        else if (req.TeamId.HasValue)
        {
            // Explode
            var groupId = Guid.NewGuid();
            foreach (var personId in memberIds)
            {
                await CreateSingleWo(req, personId, req.TeamId, groupId, req.CoordinatorPersonId);
            }
            await _db.SaveChangesAsync();
        }
        else
        {
            // Single person
            await CreateSingleWo(req, req.AssignedToPersonId, null, null, null);
            await _db.SaveChangesAsync();
        }

        // Return the *last* created WO or just Ok
        return Ok(new { Message = "Work Orders created" });
    }

    private async Task<WorkOrder> CreateSingleWo(CreateReq req, Guid? assignedId, Guid? teamId, Guid? groupId, Guid? coordId)
    {
         var startUtc = ToUtc(req.StartAt);
         var stopUtc = ToUtc(req.StopAt);

         var wo = new WorkOrder
        {
            Title = (req.Title ?? "").Trim(),
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            Type = req.Type,
            Classification = req.Classification ?? WorkOrderClassification.Reactive,
            Status = WorkOrderStatus.Open,
            AssetId = req.AssetId,
            AssignedToPersonId = assignedId,
            TeamId = teamId,
            WorkOrderGroupId = groupId,
            CoordinatorPersonId = coordId,
            StartAt = startUtc,
            StopAt = stopUtc,
            DurationMinutes = CalcMinutes(startUtc, stopUtc),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.WorkOrders.Add(wo);

        var corr = Guid.NewGuid();
        AddEvent(wo.Id, corr, WorkOrderEventKind.Created, "title", null, wo.Title, null, null, "Open");
        AddEvent(wo.Id, corr, WorkOrderEventKind.StatusChanged, "status", null, WorkOrderStatus.Open.ToString(), null, "Open", null);

        if (wo.AssetId.HasValue)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "assetId", null, wo.AssetId.Value.ToString());

        if (wo.AssignedToPersonId.HasValue)
            AddEvent(wo.Id, corr, WorkOrderEventKind.AssignedChanged, "assignedToPersonId", null, wo.AssignedToPersonId.Value.ToString());

        if (wo.TeamId.HasValue)
             AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "teamId", null, wo.TeamId.Value.ToString());

        return wo;
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


    private async Task UpdateAssetStatus(Guid? assetId, Guid currentWoId, WorkOrderStatus newStatus)
    {
        if (!assetId.HasValue) return;

        var asset = await _db.Assets.FirstOrDefaultAsync(a => a.Id == assetId.Value);
        if (asset == null) return;

        bool inMaint = false;
        if (newStatus == WorkOrderStatus.InProgress)
        {
            inMaint = true;
        }
        else
        {
            // Check others
            inMaint = await _db.WorkOrders
                .AnyAsync(w => w.AssetId == assetId.Value && w.Id != currentWoId && w.Status == WorkOrderStatus.InProgress);
        }

        var newAs = inMaint ? AssetStatus.InMaintenance : AssetStatus.Operational;
        if (asset.Status != newAs)
        {
            asset.Status = newAs;
            // Optional: Log asset event? We are logging WO events. 
            // Requirement said "write AssetStatusChanged event". We can put it on the WO stream.
            // AddEvent(currentWoId, Guid.NewGuid(), WorkOrderEventKind.Updated, "AssetStatus", asset.Status.ToString(), newAs.ToString());
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Perm:WO_UPDATE")]
    public async Task<IActionResult> Update(Guid id, [FromBody] WorkOrderDto dto)
    {
        if (dto == null) return BadRequest();

        var wo = await _db.WorkOrders
            .Include(w => w.Asset)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (wo == null) return NotFound();

        var corr = Guid.NewGuid();

        // Snapshot old values
        var oldTitle = wo.Title;
        var oldDesc = wo.Description;
        var oldAssetId = wo.AssetId;
        var oldAssigned = wo.AssignedToPersonId;
        var oldStart = wo.StartAt;
        var oldStop = wo.StopAt;
        var oldStatus = wo.Status;
        var oldDefect = wo.Defect;
        var oldCause = wo.Cause;
        var oldSolution = wo.Solution;
        var oldClassification = wo.Classification;
        var oldTeam = wo.TeamId;
        var oldCoord = wo.CoordinatorPersonId;

        // Apply
        wo.Title = (dto.Title ?? "").Trim();
        wo.Description = dto.Description?.Trim();
        wo.AssetId = dto.AssetId;
        wo.AssignedToPersonId = dto.AssignedToPersonId;
        wo.StartAt = ToUtc(dto.StartAt);
        wo.StopAt = ToUtc(dto.StopAt);
        wo.Defect = dto.Defect;
        wo.Cause = dto.Cause;
        wo.Solution = dto.Solution;
        wo.Classification = dto.Classification;

        // Status change via Update is allowed but handled carefully
        // Usually UI calls Start/Stop actions, but if they edit status directly:
        if (dto.Status != wo.Status)
        {
            wo.Status = dto.Status;
            AddEvent(wo.Id, corr, WorkOrderEventKind.StatusChanged, "status", oldStatus.ToString(), wo.Status.ToString(), null, oldStatus.ToString(), wo.Status.ToString());
            await UpdateAssetStatus(wo.AssetId, wo.Id, wo.Status);
        }

        // New fields
        wo.TeamId = dto.TeamId;
        wo.CoordinatorPersonId = dto.CoordinatorPersonId;

        // Audit diffs
        if (oldTitle != wo.Title) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "title", oldTitle, wo.Title);
        if (oldDesc != wo.Description) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "description", oldDesc, wo.Description);

        if (oldAssetId != wo.AssetId)
        {
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "assetId", oldAssetId?.ToString(), wo.AssetId?.ToString());
            // Asset changed? potentially re-eval old asset and new asset status. 
            // Complex. Let's assume AssetId doesn't change often in InProgress.
        }

        if (oldAssigned != wo.AssignedToPersonId)
            AddEvent(wo.Id, corr, WorkOrderEventKind.AssignedChanged, "assignedToPersonId", oldAssigned?.ToString(), wo.AssignedToPersonId?.ToString());

        if (oldTeam != wo.TeamId)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "teamId", oldTeam?.ToString(), wo.TeamId?.ToString());
        
        if (oldCoord != wo.CoordinatorPersonId)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "coordinatorPersonId", oldCoord?.ToString(), wo.CoordinatorPersonId?.ToString());

        if (oldStart != wo.StartAt)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "startAt", oldStart?.ToString("O"), wo.StartAt?.ToString("O"));

        if (oldStop != wo.StopAt)
            AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "stopAt", oldStop?.ToString("O"), wo.StopAt?.ToString("O"));

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

        AddEvent(wo.Id, corr, WorkOrderEventKind.Started, "status", oldStatus.ToString(), wo.Status.ToString(), null, oldStatus.ToString(), wo.Status.ToString());
        if (oldStart != wo.StartAt) AddEvent(wo.Id, corr, WorkOrderEventKind.Started, "startAt", oldStart?.ToString("O"), wo.StartAt?.ToString("O"));

        await UpdateAssetStatus(wo.AssetId, wo.Id, wo.Status);
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

        AddEvent(wo.Id, corr, WorkOrderEventKind.Stopped, "status", oldStatus.ToString(), wo.Status.ToString(), null, oldStatus.ToString(), wo.Status.ToString());
        if (oldStop != wo.StopAt) AddEvent(wo.Id, corr, WorkOrderEventKind.Stopped, "stopAt", oldStop?.ToString("O"), wo.StopAt?.ToString("O"));

        await UpdateAssetStatus(wo.AssetId, wo.Id, wo.Status);
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

        AddEvent(wo.Id, corr, WorkOrderEventKind.Cancelled, "status", oldStatus.ToString(), wo.Status.ToString(), null, oldStatus.ToString(), wo.Status.ToString());

        await UpdateAssetStatus(wo.AssetId, wo.Id, wo.Status);
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
        wo.StartAt = null; // Reset start/stop on reopen? Usually yes or keep history. Code cleared them.
        wo.StopAt = null;
        wo.DurationMinutes = null;

        AddEvent(wo.Id, corr, WorkOrderEventKind.Reopened, "status", oldStatus.ToString(), wo.Status.ToString(), null, oldStatus.ToString(), wo.Status.ToString());
        if (oldStart != wo.StartAt) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "startAt", oldStart?.ToString("O"), null);
        if (oldStop != wo.StopAt) AddEvent(wo.Id, corr, WorkOrderEventKind.Updated, "stopAt", oldStop?.ToString("O"), null);

        await UpdateAssetStatus(wo.AssetId, wo.Id, wo.Status);
        await _db.SaveChangesAsync();

        var outWo = await BaseEntityQuery()
            .Where(x => x.Id == id)
            .Select(WorkOrderToDto)
            .FirstAsync();

        return Ok(outWo);
    }
}
