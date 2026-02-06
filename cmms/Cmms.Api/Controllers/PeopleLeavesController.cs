using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/people")]
[Authorize]
public sealed class PeopleLeavesController : ControllerBase
{
    private readonly AppDbContext _db;
    public PeopleLeavesController(AppDbContext db) => _db = db;

    // GET /api/people/{id}/leaves?from=2026-02-01&to=2026-02-28
    [HttpGet("{id:guid}/leaves")]
    public async Task<ActionResult<List<LeaveDto>>> List(
        Guid id,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken ct = default)
    {
        var personExists = await _db.People.AnyAsync(x => x.Id == id, ct);
        if (!personExists) return NotFound("Person not found.");

        var q = _db.PersonLeaves.AsNoTracking().Where(x => x.PersonId == id);

        if (from.HasValue)
        {
            var f = DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc);
            q = q.Where(x => x.EndDate >= f);
        }

        if (to.HasValue)
        {
            var t = DateTime.SpecifyKind(to.Value.Date, DateTimeKind.Utc);
            q = q.Where(x => x.StartDate <= t);
        }

        var items = await q
            .OrderByDescending(x => x.StartDate)
            .Select(x => new LeaveDto
            {
                Id = x.Id,
                Type = x.Type.ToString(),
                StartDate = x.StartDate,
                EndDate = x.EndDate,
                Notes = x.Notes
            })
            .ToListAsync(ct);

        return items;
    }

    // POST /api/people/{id}/leaves
    [HttpPost("{id:guid}/leaves")]
    public async Task<ActionResult<LeaveDto>> Create(Guid id, [FromBody] CreateLeaveReq req, CancellationToken ct)
    {
        var personExists = await _db.People.AnyAsync(x => x.Id == id, ct);
        if (!personExists) return NotFound("Person not found.");

        if (!Enum.TryParse<LeaveType>((req.Type ?? "").Trim(), ignoreCase: true, out var type))
            return BadRequest("Invalid type. Allowed: CO, CM.");

        if (type != LeaveType.CO && type != LeaveType.CM)
            return BadRequest("Invalid type. Allowed: CO, CM.");

        var start = DateTime.SpecifyKind(req.StartDate.Date, DateTimeKind.Utc);
        var end = DateTime.SpecifyKind(req.EndDate.Date, DateTimeKind.Utc);
        if (end < start) return BadRequest("endDate must be >= startDate.");

        // prevent overlaps for same person
        var overlap = await _db.PersonLeaves.AnyAsync(x =>
            x.PersonId == id &&
            x.StartDate <= end &&
            x.EndDate >= start, ct);

        if (overlap) return Conflict("Overlapping leave already exists for this person.");

        var e = new PersonLeave
        {
            Id = Guid.NewGuid(),
            PersonId = id,
            Type = type,
            StartDate = start,
            EndDate = end,
            Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim()
        };

        _db.PersonLeaves.Add(e);
        await _db.SaveChangesAsync(ct);

        var dto = new LeaveDto
        {
            Id = e.Id,
            Type = e.Type.ToString(),
            StartDate = e.StartDate,
            EndDate = e.EndDate,
            Notes = e.Notes
        };

        return CreatedAtAction(nameof(List), new { id }, dto);
    }

    // DELETE /api/people/{personId}/leaves/{leaveId}
    [HttpDelete("{personId:guid}/leaves/{leaveId:guid}")]
    public async Task<IActionResult> Delete(Guid personId, Guid leaveId, CancellationToken ct)
    {
        var e = await _db.PersonLeaves.FirstOrDefaultAsync(x => x.Id == leaveId && x.PersonId == personId, ct);
        if (e == null) return NotFound();

        _db.PersonLeaves.Remove(e);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // DTOs
    public sealed class LeaveDto
    {
        public Guid Id { get; set; }
        public string Type { get; set; } = "CO";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? Notes { get; set; }
    }

    public sealed class CreateLeaveReq
    {
        public string? Type { get; set; } // "CO" or "CM"
        public DateTime StartDate { get; set; } // date-only
        public DateTime EndDate { get; set; }   // date-only
        public string? Notes { get; set; }
    }
}
