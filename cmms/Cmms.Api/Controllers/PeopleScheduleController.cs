using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/people")]
[Authorize]
public sealed class PeopleScheduleController : ControllerBase
{
    private readonly AppDbContext _db;
    public PeopleScheduleController(AppDbContext db) => _db = db;

    // PUT /api/people/{id}/schedule
    [HttpPut("{id:guid}/schedule")]
    public async Task<IActionResult> UpdateSchedule(Guid id, UpdateScheduleReq req, CancellationToken ct)
    {
        // person exists?
        var personExists = await _db.People.AnyAsync(x => x.Id == id, ct);
        if (!personExists) return NotFound("Person not found.");

        // validate minutes
        if (!IsValidMinute(req.MonFriStartMinutes) || !IsValidMinute(req.MonFriEndMinutes))
            return BadRequest("Invalid MonFri minutes.");

        if (req.MonFriEndMinutes <= req.MonFriStartMinutes)
            return BadRequest("MonFriEnd must be after MonFriStart.");

        if (req.SatStartMinutes.HasValue || req.SatEndMinutes.HasValue)
        {
            if (!req.SatStartMinutes.HasValue || !req.SatEndMinutes.HasValue)
                return BadRequest("Provide both SatStartMinutes and SatEndMinutes, or neither.");

            if (!IsValidMinute(req.SatStartMinutes.Value) || !IsValidMinute(req.SatEndMinutes.Value))
                return BadRequest("Invalid Saturday minutes.");

            if (req.SatEndMinutes.Value <= req.SatStartMinutes.Value)
                return BadRequest("SatEnd must be after SatStart.");
        }

        var s = await _db.PersonWorkSchedules.FirstOrDefaultAsync(x => x.PersonId == id, ct);

        if (s == null)
        {
            // create schedule row if missing
            s = new Cmms.Domain.PersonWorkSchedule
            {
                PersonId = id,
                MonFriStart = TimeSpan.FromMinutes(req.MonFriStartMinutes),
                MonFriEnd = TimeSpan.FromMinutes(req.MonFriEndMinutes),
                SatStart = req.SatStartMinutes.HasValue ? TimeSpan.FromMinutes(req.SatStartMinutes.Value) : (TimeSpan?)null,
                SatEnd = req.SatEndMinutes.HasValue ? TimeSpan.FromMinutes(req.SatEndMinutes.Value) : (TimeSpan?)null,
                Timezone = string.IsNullOrWhiteSpace(req.Timezone) ? "Europe/Bucharest" : req.Timezone.Trim()
            };

            _db.PersonWorkSchedules.Add(s);
        }
        else
        {
            s.MonFriStart = TimeSpan.FromMinutes(req.MonFriStartMinutes);
            s.MonFriEnd = TimeSpan.FromMinutes(req.MonFriEndMinutes);

            if (req.SatStartMinutes.HasValue && req.SatEndMinutes.HasValue)
            {
                s.SatStart = TimeSpan.FromMinutes(req.SatStartMinutes.Value);
                s.SatEnd = TimeSpan.FromMinutes(req.SatEndMinutes.Value);
            }
            else
            {
                s.SatStart = null;
                s.SatEnd = null;
            }

            s.Timezone = string.IsNullOrWhiteSpace(req.Timezone) ? "Europe/Bucharest" : req.Timezone.Trim();
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static bool IsValidMinute(int x) => x >= 0 && x < 24 * 60;

    public sealed class UpdateScheduleReq
    {
        public int MonFriStartMinutes { get; set; }
        public int MonFriEndMinutes { get; set; }
        public int? SatStartMinutes { get; set; }
        public int? SatEndMinutes { get; set; }
        public string? Timezone { get; set; }
    }
}
