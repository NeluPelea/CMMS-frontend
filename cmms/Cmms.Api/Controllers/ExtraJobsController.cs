using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/extra-jobs")]
[Authorize]
public sealed class ExtraJobsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ExtraJobsController(AppDbContext db) => _db = db;

    private string? GetActorId()
    {
        var v =
            User?.FindFirst("sub")?.Value ??
            User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
            User?.Identity?.Name;

        return string.IsNullOrWhiteSpace(v) ? null : v;
    }

    private void AddEvent(
        Guid extraJobId,
        WorkOrderEventKind kind,
        string? field = null,
        string? oldV = null,
        string? newV = null,
        string? msg = null
    )
    {
        _db.ExtraJobEvents.Add(new ExtraJobEvent
        {
            ExtraJobId = extraJobId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            ActorId = GetActorId(),
            Kind = kind,
            Field = field,
            OldValue = oldV,
            NewValue = newV,
            Message = msg
        });
    }

    [HttpGet]
    public async Task<ActionResult<List<ExtraJobDto>>> List(
        [FromQuery] bool? done = null, 
        [FromQuery] int take = 50, 
        [FromQuery] int skip = 0)
    {
        var q = _db.ExtraJobs.AsNoTracking();
        
        // Helper filter for legacy "done" param
        if (done.HasValue) 
        {
            if (done.Value) q = q.Where(x => x.Status == WorkOrderStatus.Done || x.Status == WorkOrderStatus.Cancelled);
            else q = q.Where(x => x.Status == WorkOrderStatus.Open || x.Status == WorkOrderStatus.InProgress);
        }

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Include(x => x.AssignedToPerson)
            .Select(x => new ExtraJobDto
            {
                Id = x.Id,
                Title = x.Title,
                Description = x.Description,
                IsDone = x.Status == WorkOrderStatus.Done || x.Status == WorkOrderStatus.Cancelled, // computed for compat
                Status = x.Status,
                AssignedToPersonId = x.AssignedToPersonId,
                AssignedToPersonName = x.AssignedToPerson != null ? x.AssignedToPerson.DisplayName : null,
                CreatedAt = x.CreatedAt,
                FinishedAt = x.StopAt ?? x.FinishedAt, // fallback
                StartAt = x.StartAt,
                StopAt = x.StopAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<ActionResult<ExtraJobDto>> Create([FromBody] CreateExtraJobReq req)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("Title required");

        var ent = new ExtraJob
        {
            Id = Guid.NewGuid(),
            Title = req.Title.Trim(),
            Description = req.Description,
            Status = WorkOrderStatus.Open,
            AssignedToPersonId = req.AssignedToPersonId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.ExtraJobs.Add(ent);
        
        AddEvent(ent.Id, WorkOrderEventKind.Created, "title", null, ent.Title);
        if (ent.AssignedToPersonId.HasValue)
            AddEvent(ent.Id, WorkOrderEventKind.AssignedChanged, "assignedToPersonId", null, ent.AssignedToPersonId.ToString());

        await _db.SaveChangesAsync();

        return Ok(Map(ent));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ExtraJobDto>> Update(Guid id, [FromBody] CreateExtraJobReq req)
    {
         var ent = await _db.ExtraJobs.FirstOrDefaultAsync(x => x.Id == id);
         if (ent == null) return NotFound();

         if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("Title required");

         var oldTitle = ent.Title;
         var oldDesc = ent.Description;
         var oldAssigned = ent.AssignedToPersonId;

         ent.Title = req.Title.Trim();
         ent.Description = req.Description;
         ent.AssignedToPersonId = req.AssignedToPersonId;

         if (oldTitle != ent.Title) AddEvent(ent.Id, WorkOrderEventKind.Updated, "title", oldTitle, ent.Title);
         if (oldDesc != ent.Description) AddEvent(ent.Id, WorkOrderEventKind.Updated, "description", oldDesc, ent.Description);
         if (oldAssigned != ent.AssignedToPersonId) AddEvent(ent.Id, WorkOrderEventKind.AssignedChanged, "assignedToPersonId", oldAssigned?.ToString(), ent.AssignedToPersonId?.ToString());

         await _db.SaveChangesAsync();
         return Ok(Map(ent));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ent = await _db.ExtraJobs.FirstOrDefaultAsync(x => x.Id == id);
        if (ent == null) return NotFound();

        _db.ExtraJobs.Remove(ent);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ACTIONS

    [HttpPost("{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id)
    {
        var ent = await _db.ExtraJobs.FirstOrDefaultAsync(x => x.Id == id);
        if (ent == null) return NotFound();

        // Safeguard against double-click
        if (ent.Status == WorkOrderStatus.InProgress) return Ok(Map(ent));

        if (ent.Status != WorkOrderStatus.Open) return BadRequest("Start allowed only when Open.");

        // Check if assigned employee already has an active extra activity
        if (ent.AssignedToPersonId.HasValue)
        {
            var openJob = await _db.ExtraJobs
                .AsNoTracking()
                .Where(x => x.AssignedToPersonId == ent.AssignedToPersonId && x.Status == WorkOrderStatus.InProgress && x.Id != id)
                .FirstOrDefaultAsync();

            if (openJob != null)
            {
                return Conflict(new {
                    code = "PERSON_ALREADY_RUNNING_ACTIVITY",
                    message = $"Inchide mai intai activitatea {openJob.Title}",
                    openActivityId = openJob.Id,
                    openActivityTitle = openJob.Title
                });
            }
        }

        var oldStatus = ent.Status;
        ent.Status = WorkOrderStatus.InProgress;
        ent.StartAt = DateTimeOffset.UtcNow;
        ent.StopAt = null;

        AddEvent(ent.Id, WorkOrderEventKind.Started, "status", oldStatus.ToString(), ent.Status.ToString());
        AddEvent(ent.Id, WorkOrderEventKind.Started, "startAt", null, ent.StartAt?.ToString("O"));

        await _db.SaveChangesAsync();
        return Ok(Map(ent));
    }

    [HttpPost("{id:guid}/stop")]
    public async Task<IActionResult> Stop(Guid id)
    {
        var ent = await _db.ExtraJobs.FirstOrDefaultAsync(x => x.Id == id);
        if (ent == null) return NotFound();

        if (ent.Status != WorkOrderStatus.InProgress) return BadRequest("Stop allowed only when InProgress.");

        var oldStatus = ent.Status;
        ent.Status = WorkOrderStatus.Done;
        ent.StopAt = DateTimeOffset.UtcNow;
        ent.IsDone = true; // compat

        AddEvent(ent.Id, WorkOrderEventKind.Stopped, "status", oldStatus.ToString(), ent.Status.ToString());
        AddEvent(ent.Id, WorkOrderEventKind.Stopped, "stopAt", null, ent.StopAt?.ToString("O"));

        await _db.SaveChangesAsync();
        return Ok(Map(ent));
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var ent = await _db.ExtraJobs.FirstOrDefaultAsync(x => x.Id == id);
        if (ent == null) return NotFound();

        if (ent.Status == WorkOrderStatus.Done || ent.Status == WorkOrderStatus.Cancelled) return BadRequest("Already final status.");

        var oldStatus = ent.Status;
        ent.Status = WorkOrderStatus.Cancelled;
        ent.IsDone = true; // compat logic: allow hiding from list

        AddEvent(ent.Id, WorkOrderEventKind.Cancelled, "status", oldStatus.ToString(), ent.Status.ToString());

        await _db.SaveChangesAsync();
        return Ok(Map(ent));
    }

    [HttpPost("{id:guid}/reopen")]
    public async Task<IActionResult> Reopen(Guid id)
    {
        var ent = await _db.ExtraJobs.FirstOrDefaultAsync(x => x.Id == id);
        if (ent == null) return NotFound();

        if (ent.Status != WorkOrderStatus.Done && ent.Status != WorkOrderStatus.Cancelled) return BadRequest("Can only reopen Done/Cancelled.");

        var oldStatus = ent.Status;
        ent.Status = WorkOrderStatus.Open;
        ent.StartAt = null;
        ent.StopAt = null;
        ent.IsDone = false;

        AddEvent(ent.Id, WorkOrderEventKind.Reopened, "status", oldStatus.ToString(), ent.Status.ToString());
        AddEvent(ent.Id, WorkOrderEventKind.Updated, "startAt", null, null); // clear
        AddEvent(ent.Id, WorkOrderEventKind.Updated, "stopAt", null, null); // clear

        await _db.SaveChangesAsync();
        return Ok(Map(ent));
    }

    // Helper mapping
    private static ExtraJobDto Map(ExtraJob x)
    {
        return new ExtraJobDto
        {
            Id = x.Id,
            Title = x.Title,
            Description = x.Description,
            IsDone = x.Status == WorkOrderStatus.Done || x.Status == WorkOrderStatus.Cancelled, 
            Status = x.Status,
            AssignedToPersonId = x.AssignedToPersonId,
            CreatedAt = x.CreatedAt,
            StartAt = x.StartAt,
            StopAt = x.StopAt,
            FinishedAt = x.StopAt ?? x.FinishedAt
        };
    }


    public sealed class ExtraJobDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public bool IsDone { get; set; }
        public WorkOrderStatus Status { get; set; } // new field
        public Guid? AssignedToPersonId { get; set; }
        public string? AssignedToPersonName { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? StartAt { get; set; }
        public DateTimeOffset? StopAt { get; set; }
        public DateTimeOffset? FinishedAt { get; set; }
    }

    public sealed class CreateExtraJobReq
    {
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public Guid? AssignedToPersonId { get; set; }
    }
}
