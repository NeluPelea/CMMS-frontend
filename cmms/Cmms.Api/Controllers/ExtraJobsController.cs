using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/extra-jobs")]
[Authorize]
public sealed class ExtraJobsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ExtraJobsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<List<ExtraJobDto>>> List(
        [FromQuery] bool? done = null, 
        [FromQuery] int take = 50, 
        [FromQuery] int skip = 0)
    {
        var q = _db.ExtraJobs.AsNoTracking();
        if (done.HasValue) q = q.Where(x => x.IsDone == done.Value);

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
                IsDone = x.IsDone,
                AssignedToPersonId = x.AssignedToPersonId,
                AssignedToPersonName = x.AssignedToPerson != null ? x.AssignedToPerson.DisplayName : null,
                CreatedAt = x.CreatedAt,
                FinishedAt = x.FinishedAt
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
            IsDone = false,
            AssignedToPersonId = req.AssignedToPersonId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.ExtraJobs.Add(ent);
        await _db.SaveChangesAsync();

        return Ok(new ExtraJobDto
        {
            Id = ent.Id,
            Title = ent.Title,
            Description = ent.Description,
            IsDone = ent.IsDone,
            AssignedToPersonId = ent.AssignedToPersonId,
            CreatedAt = ent.CreatedAt
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ExtraJobDto>> Update(Guid id, [FromBody] CreateExtraJobReq req)
    {
         var ent = await _db.ExtraJobs.FirstOrDefaultAsync(x => x.Id == id);
         if (ent == null) return NotFound();

         if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("Title required");

         ent.Title = req.Title.Trim();
         ent.Description = req.Description;
         ent.AssignedToPersonId = req.AssignedToPersonId;

         await _db.SaveChangesAsync();
         return Ok(new ExtraJobDto
         {
             Id = ent.Id,
             Title = ent.Title,
             Description = ent.Description,
             IsDone = ent.IsDone,
             AssignedToPersonId = ent.AssignedToPersonId,
             CreatedAt = ent.CreatedAt,
             FinishedAt = ent.FinishedAt
         });
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

    [HttpPost("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id)
    {
        var ent = await _db.ExtraJobs.FirstOrDefaultAsync(x => x.Id == id);
        if (ent == null) return NotFound();

        ent.IsDone = !ent.IsDone;
        ent.FinishedAt = ent.IsDone ? DateTimeOffset.UtcNow : null;

        await _db.SaveChangesAsync();
        return Ok(new { ent.IsDone, ent.FinishedAt });
    }

    public sealed class ExtraJobDto
    {
        public Guid Id { get; set; }
        // Initialize to avoid CS8618 warnings
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public bool IsDone { get; set; }
        public Guid? AssignedToPersonId { get; set; }
        public string? AssignedToPersonName { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? FinishedAt { get; set; }
    }

    public sealed class CreateExtraJobReq
    {
        // Initialize to avoid CS8618 warnings
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public Guid? AssignedToPersonId { get; set; }
    }
}
