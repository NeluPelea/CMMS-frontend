using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/work-orders/{woId:guid}/labor")]
[Authorize(Policy = "Perm:WO_EXECUTE")]
public sealed class LaborController : ControllerBase
{
    private readonly AppDbContext _db;
    public LaborController(AppDbContext db) => _db = db;

    // GET /api/work-orders/{woId}/labor
    [HttpGet]
    public async Task<ActionResult<List<LaborLogDto>>> List(Guid woId, CancellationToken ct = default)
    {
        var logs = await _db.WorkOrderLaborLogs.AsNoTracking()
            .Where(x => x.WorkOrderId == woId)
            .OrderByDescending(x => x.CreatedAt)
            .Include(x => x.Person)
            .Select(x => new LaborLogDto
            {
                Id = x.Id,
                WorkOrderId = x.WorkOrderId,
                PersonId = x.PersonId,
                PersonName = x.Person != null ? x.Person.DisplayName ?? x.Person.FullName : "Unknown",
                Minutes = x.Minutes,
                Description = x.Description,
                CreatedAt = x.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(logs);
    }

    // POST /api/work-orders/{woId}/labor
    [HttpPost]
    public async Task<ActionResult<LaborLogDto>> Create(Guid woId, [FromBody] CreateLaborReq req, CancellationToken ct = default)
    {
        // validate wo
        var woExists = await _db.WorkOrders.AnyAsync(x => x.Id == woId, ct);
        if (!woExists) return NotFound("Work Order not found.");

        // validate person
        var person = await _db.People.FirstOrDefaultAsync(x => x.Id == req.PersonId, ct);
        if (person == null) return BadRequest("Person not found.");

        if (req.Minutes <= 0) return BadRequest("Minutes must be > 0.");

        var log = new WorkOrderLabor
        {
            Id = Guid.NewGuid(),
            WorkOrderId = woId,
            PersonId = req.PersonId,
            Minutes = req.Minutes,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.WorkOrderLaborLogs.Add(log);
        await _db.SaveChangesAsync(ct);

        var dto = new LaborLogDto
        {
            Id = log.Id,
            WorkOrderId = log.WorkOrderId,
            PersonId = log.PersonId,
            PersonName = person.DisplayName ?? person.FullName,
            Minutes = log.Minutes,
            Description = log.Description,
            CreatedAt = log.CreatedAt
        };

        return CreatedAtAction(nameof(List), new { woId }, dto);
    }

    // DELETE /api/work-orders/{woId}/labor/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid woId, Guid id, CancellationToken ct = default)
    {
        var log = await _db.WorkOrderLaborLogs.FirstOrDefaultAsync(x => x.Id == id && x.WorkOrderId == woId, ct);
        if (log == null) return NotFound();

        _db.WorkOrderLaborLogs.Remove(log);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // DTOs
    public sealed class LaborLogDto
    {
        public Guid Id { get; set; }
        public Guid WorkOrderId { get; set; }
        public Guid PersonId { get; set; }
        public string? PersonName { get; set; }
        public int Minutes { get; set; }
        public string? Description { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }

    public sealed class CreateLaborReq
    {
        public Guid PersonId { get; set; }
        public int Minutes { get; set; }
        public string? Description { get; set; }
    }
}
