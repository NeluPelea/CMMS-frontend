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

    // ---------------- Helpers ----------------

    private static DateTimeOffset ToUtc(DateTimeOffset x) => x.ToUniversalTime();

    private static bool IsValidWindow(DateTimeOffset fromUtc, DateTimeOffset toUtc)
        => toUtc > fromUtc;

    private async Task<bool> WorkOrderExists(Guid workOrderId, CancellationToken ct)
        => await _db.WorkOrders.AsNoTracking().AnyAsync(x => x.Id == workOrderId, ct);

    private async Task<AssignmentDto> LoadDto(Guid assignmentId, CancellationToken ct)
    {
        return await (from a in _db.WorkOrderAssignments.AsNoTracking()
                      join p in _db.People.AsNoTracking() on a.PersonId equals p.Id
                      join r in _db.AssignmentRoles.AsNoTracking() on a.RoleId equals r.Id
                      where a.Id == assignmentId
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
                      }).FirstAsync(ct);
    }

    private async Task EnsureRoleIsActive(Guid roleId, CancellationToken ct)
    {
        var role = await _db.AssignmentRoles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == roleId, ct);
        if (role == null) throw new InvalidOperationException("roleId not found.");
        if (!role.IsActive) throw new InvalidOperationException("Role is inactive.");
    }

    private async Task<bool> ExistsSamePersonRole(Guid workOrderId, Guid personId, Guid roleId, Guid? exceptAssignmentId, CancellationToken ct)
    {
        return await _db.WorkOrderAssignments.AnyAsync(x =>
            x.WorkOrderId == workOrderId &&
            x.PersonId == personId &&
            x.RoleId == roleId &&
            (!exceptAssignmentId.HasValue || x.Id != exceptAssignmentId.Value),
            ct);
    }

    private async Task BridgeLegacyAssignedTo(Guid workOrderId, Guid personId, CancellationToken ct)
    {
        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == workOrderId, ct);
        if (wo == null) return;

        if (!wo.AssignedToPersonId.HasValue)
        {
            wo.AssignedToPersonId = personId;
        }
    }

    // ---------------- Endpoints ----------------

    // GET /api/work-orders/{id}/assignments
    [HttpGet("{id:guid}/assignments")]
    public async Task<ActionResult<List<AssignmentDto>>> List(Guid id, CancellationToken ct)
    {
        if (!await WorkOrderExists(id, ct)) return NotFound("WorkOrder not found.");

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
        if (!await WorkOrderExists(id, ct)) return NotFound("WorkOrder not found.");

        if (req.PersonId == Guid.Empty) return BadRequest("personId is required.");
        if (req.RoleId == Guid.Empty) return BadRequest("roleId is required.");
        if (!req.PlannedFrom.HasValue || !req.PlannedTo.HasValue)
            return BadRequest("plannedFrom and plannedTo are required.");

        var fromUtc = ToUtc(req.PlannedFrom.Value);
        var toUtc = ToUtc(req.PlannedTo.Value);
        if (!IsValidWindow(fromUtc, toUtc)) return BadRequest("plannedTo must be after plannedFrom.");

        try
        {
            await EnsureRoleIsActive(req.RoleId, ct);
        }
        catch (InvalidOperationException ex)
        {
            return ex.Message == "Role is inactive." ? Conflict(ex.Message) : BadRequest(ex.Message);
        }

        var avail = await _availability.CanAssignAsync(req.PersonId, fromUtc, toUtc, ct);
        if (!avail.IsOk) return Conflict(avail.Reason);

        var exists = await ExistsSamePersonRole(id, req.PersonId, req.RoleId, exceptAssignmentId: null, ct);
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

        await BridgeLegacyAssignedTo(id, req.PersonId, ct);
        await _db.SaveChangesAsync(ct);

        var dto = await LoadDto(a.Id, ct);
        return Ok(dto);
    }

    // PUT /api/work-orders/{workOrderId}/assignments/{assignmentId}
    [HttpPut("{workOrderId:guid}/assignments/{assignmentId:guid}")]
    public async Task<ActionResult<AssignmentDto>> Update(Guid workOrderId, Guid assignmentId, [FromBody] UpdateAssignmentReq req, CancellationToken ct)
    {
        if (!await WorkOrderExists(workOrderId, ct)) return NotFound("WorkOrder not found.");

        if (req.PersonId == Guid.Empty) return BadRequest("personId is required.");
        if (req.RoleId == Guid.Empty) return BadRequest("roleId is required.");
        if (!req.PlannedFrom.HasValue || !req.PlannedTo.HasValue)
            return BadRequest("plannedFrom and plannedTo are required.");

        var fromUtc = ToUtc(req.PlannedFrom.Value);
        var toUtc = ToUtc(req.PlannedTo.Value);
        if (!IsValidWindow(fromUtc, toUtc)) return BadRequest("plannedTo must be after plannedFrom.");

        var a = await _db.WorkOrderAssignments
            .FirstOrDefaultAsync(x => x.Id == assignmentId && x.WorkOrderId == workOrderId, ct);

        if (a == null) return NotFound();

        try
        {
            await EnsureRoleIsActive(req.RoleId, ct);
        }
        catch (InvalidOperationException ex)
        {
            return ex.Message == "Role is inactive." ? Conflict(ex.Message) : BadRequest(ex.Message);
        }

        var avail = await _availability.CanAssignAsync(req.PersonId, fromUtc, toUtc, ct);
        if (!avail.IsOk) return Conflict(avail.Reason);

        var exists = await ExistsSamePersonRole(workOrderId, req.PersonId, req.RoleId, exceptAssignmentId: assignmentId, ct);
        if (exists) return Conflict("This person already has this role on this work order.");

        // update fields
        a.PersonId = req.PersonId;
        a.RoleId = req.RoleId;
        a.PlannedFrom = fromUtc;
        a.PlannedTo = toUtc;
        a.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();

        await BridgeLegacyAssignedTo(workOrderId, req.PersonId, ct);

        await _db.SaveChangesAsync(ct);

        var dto = await LoadDto(a.Id, ct);
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

    // ---------------- DTOs ----------------

    public sealed class CreateAssignmentReq
    {
        public Guid PersonId { get; set; }
        public Guid RoleId { get; set; }
        public DateTimeOffset? PlannedFrom { get; set; }
        public DateTimeOffset? PlannedTo { get; set; }
        public string? Notes { get; set; }
    }

    public sealed class UpdateAssignmentReq
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
