using Cmms.Domain;
using Cmms.Infrastructure;
using Cmms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/work-orders")]
[Authorize]
public sealed class WorkOrderAssignmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PeopleAvailability _availability;

    public WorkOrderAssignmentsController(AppDbContext db, PeopleAvailability availability)
    {
        _db = db;
        _availability = availability;
    }

    // GET /api/work-orders/{id}/assignments
    [HttpGet("{id:guid}/assignments")]
    public async Task<ActionResult<List<AssignmentDto>>> List(Guid id, CancellationToken ct)
    {
        var woExists = await _db.WorkOrders.AsNoTracking().AnyAsync(x => x.Id == id, ct);
        if (!woExists) return NotFound("WorkOrder not found.");

        var items =
            await (from a in _db.WorkOrderAssignments.AsNoTracking()
                   join p in _db.People.AsNoTracking() on a.PersonId equals p.Id
                   join r in _db.AssignmentRoles.AsNoTracking() on a.RoleId equals r.Id
                   where a.WorkOrderId == id
                   orderby a.PlannedFrom, a.CreatedAt
                   select new AssignmentDto
                   {
                       Id = a.Id,
                       WorkOrderId = a.WorkOrderId,
                       PersonId = a.PersonId,
                       PersonName = p.FullName,
                       RoleId = a.RoleId,
                       RoleName = r.Name,
                       PlannedFrom = a.PlannedFrom,
                       PlannedTo = a.PlannedTo,
                       CreatedAt = a.CreatedAt,
                       Notes = a.Notes
                   }).ToListAsync(ct);

        return Ok(items);
    }

    // POST /api/work-orders/{id}/assignments
    [HttpPost("{id:guid}/assignments")]
    public async Task<ActionResult<AssignmentDto>> Create(Guid id, [FromBody] CreateAssignmentReq req, CancellationToken ct)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (wo == null) return NotFound("WorkOrder not found.");

        if (req.PersonId == Guid.Empty) return BadRequest("personId is required.");
        if (req.RoleId == Guid.Empty) return BadRequest("roleId is required.");
        if (!req.PlannedFrom.HasValue || !req.PlannedTo.HasValue)
            return BadRequest("plannedFrom and plannedTo are required.");

        var fromUtc = req.PlannedFrom.Value.ToUniversalTime();
        var toUtc = req.PlannedTo.Value.ToUniversalTime();

        var role = await _db.AssignmentRoles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == req.RoleId, ct);
        if (role == null) return BadRequest("roleId not found.");
        if (!role.IsActive) return Conflict("Role is inactive.");

        var avail = await _availability.CanAssignAsync(req.PersonId, fromUtc, toUtc, ct);
        if (!avail.IsOk) return Conflict(avail.Reason);

        var exists = await _db.WorkOrderAssignments.AnyAsync(x =>
            x.WorkOrderId == id && x.PersonId == req.PersonId && x.RoleId == req.RoleId, ct);

        if (exists) return Conflict("This person already has this role on this work order.");

        var a = new WorkOrderAssignment
        {
            Id = Guid.NewGuid(),
            WorkOrderId = id,
            PersonId = req.PersonId,
            RoleId = req.RoleId,
            PlannedFrom = fromUtc,
            PlannedTo = toUtc,
            CreatedAt = DateTimeOffset.UtcNow,
            Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim()
        };

        _db.WorkOrderAssignments.Add(a);

        // bridge legacy single-assign
        if (!wo.AssignedToPersonId.HasValue)
            wo.AssignedToPersonId = req.PersonId;

        await _db.SaveChangesAsync(ct);

        var dto =
            await (from aa in _db.WorkOrderAssignments.AsNoTracking()
                   join p in _db.People.AsNoTracking() on aa.PersonId equals p.Id
                   join r in _db.AssignmentRoles.AsNoTracking() on aa.RoleId equals r.Id
                   where aa.Id == a.Id
                   select new AssignmentDto
                   {
                       Id = aa.Id,
                       WorkOrderId = aa.WorkOrderId,
                       PersonId = aa.PersonId,
                       PersonName = p.FullName,
                       RoleId = aa.RoleId,
                       RoleName = r.Name,
                       PlannedFrom = aa.PlannedFrom,
                       PlannedTo = aa.PlannedTo,
                       CreatedAt = aa.CreatedAt,
                       Notes = aa.Notes
                   }).FirstAsync(ct);

        return Ok(dto);
    }

    // DELETE /api/work-orders/{workOrderId}/assignments/{assignmentId}
    [HttpDelete("{workOrderId:guid}/assignments/{assignmentId:guid}")]
    public async Task<IActionResult> Delete(Guid workOrderId, Guid assignmentId, CancellationToken ct)
    {
        var a = await _db.WorkOrderAssignments
            .FirstOrDefaultAsync(x => x.Id == assignmentId && x.WorkOrderId == workOrderId, ct);

        if (a == null) return NotFound();

        _db.WorkOrderAssignments.Remove(a);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // DTOs
    public sealed class CreateAssignmentReq
    {
        public Guid PersonId { get; set; }
        public Guid RoleId { get; set; }
        public DateTimeOffset? PlannedFrom { get; set; }
        public DateTimeOffset? PlannedTo { get; set; }
        public string? Notes { get; set; }
    }

    public sealed class AssignmentDto
    {
        public Guid Id { get; set; }
        public Guid WorkOrderId { get; set; }

        public Guid PersonId { get; set; }
        public string PersonName { get; set; } = "";

        public Guid RoleId { get; set; }
        public string RoleName { get; set; } = "";

        public DateTimeOffset PlannedFrom { get; set; }
        public DateTimeOffset PlannedTo { get; set; }

        public DateTimeOffset CreatedAt { get; set; }

        public string? Notes { get; set; }
    }
}
