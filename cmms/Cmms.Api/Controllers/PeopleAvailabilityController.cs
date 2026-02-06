using Cmms.Api.Services;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/people")]
[Authorize]
public sealed class PeopleAvailabilityController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PeopleAvailability _availability;

    public PeopleAvailabilityController(AppDbContext db, PeopleAvailability availability)
    {
        _db = db;
        _availability = availability;
    }

    // GET /api/people/available?fromUtc=...&toUtc=...&q=...
    [HttpGet("available")]
    public async Task<ActionResult<List<PersonLiteDto>>> Available(
        [FromQuery] DateTimeOffset fromUtc,
        [FromQuery] DateTimeOffset toUtc,
        [FromQuery] string? q = null,
        [FromQuery] int take = 200,
        CancellationToken ct = default)
    {
        if (toUtc <= fromUtc) return BadRequest("toUtc must be after fromUtc.");

        take = Math.Clamp(take, 1, 500);
        q = (q ?? "").Trim();

        // baza: oameni activi + optional search
        var query = _db.People.AsNoTracking().Where(p => p.IsActive);

        if (q.Length > 0)
        {
            query = query.Where(p =>
                p.FullName.Contains(q) ||
                p.DisplayName.Contains(q) ||
                p.JobTitle.Contains(q) ||
                p.Specialization.Contains(q) ||
                p.Phone.Contains(q));
        }

        var people = await query
            .OrderBy(p => p.FullName)
            .Take(take)
            .Select(p => new { p.Id, p.FullName, p.JobTitle, p.Specialization })
            .ToListAsync(ct);

        var list = new List<PersonLiteDto>(people.Count);

        // Simplu (si suficient la ~10-50 oameni):
        foreach (var p in people)
        {
            var ok = await _availability.CanAssignAsync(p.Id, fromUtc.ToUniversalTime(), toUtc.ToUniversalTime(), ct);
            if (ok.IsOk)
            {
                list.Add(new PersonLiteDto
                {
                    Id = p.Id,
                    FullName = p.FullName,
                    JobTitle = p.JobTitle,
                    Specialization = p.Specialization
                });
            }
        }

        return Ok(list);
    }

    public sealed class PersonLiteDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = "";
        public string JobTitle { get; set; } = "";
        public string Specialization { get; set; } = "";
    }
}
