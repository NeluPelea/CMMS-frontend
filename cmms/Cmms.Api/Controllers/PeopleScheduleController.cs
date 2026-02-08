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

    public PeopleScheduleController(AppDbContext db)
    {
        _db = db;
    }

    // PUT /api/people/{id}/schedule
    [HttpPut("{id:guid}/schedule")]
    public async Task<IActionResult> UpdateSchedule(Guid id, UpdateScheduleReq req, CancellationToken ct)
    {
        if (req is null) return BadRequest("Missing body.");

        // person exists?
        var personExists = await _db.People.AnyAsync(x => x.Id == id, ct);
        if (!personExists) return NotFound("Person not found.");

        // validate Mon-Fri
        ValidateRequiredRange(
            req.MonFriStartMinutes,
            req.MonFriEndMinutes,
            "MonFri",
            out var monFriStart,
            out var monFriEnd);

        // validate Sat/Sun (optional)
        ValidateOptionalRange(req.SatStartMinutes, req.SatEndMinutes, "Saturday", out var satStart, out var satEnd);
        ValidateOptionalRange(req.SunStartMinutes, req.SunEndMinutes, "Sunday", out var sunStart, out var sunEnd);

        var tz = NormalizeTimezone(req.Timezone);

        var s = await _db.PersonWorkSchedules.FirstOrDefaultAsync(x => x.PersonId == id, ct);

        if (s == null)
        {
            s = new Cmms.Domain.PersonWorkSchedule
            {
                PersonId = id,
                MonFriStart = monFriStart,
                MonFriEnd = monFriEnd,
                SatStart = satStart,
                SatEnd = satEnd,
                SunStart = sunStart,
                SunEnd = sunEnd,
                Timezone = tz
            };

            _db.PersonWorkSchedules.Add(s);
        }
        else
        {
            s.MonFriStart = monFriStart;
            s.MonFriEnd = monFriEnd;

            s.SatStart = satStart;
            s.SatEnd = satEnd;

            s.SunStart = sunStart;
            s.SunEnd = sunEnd;

            s.Timezone = tz;
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static void ValidateRequiredRange(
        int startMinutes,
        int endMinutes,
        string label,
        out TimeSpan start,
        out TimeSpan end)
    {
        if (!IsValidMinute(startMinutes) || !IsValidMinute(endMinutes))
            throw new BadHttpRequestException($"Invalid {label} minutes.");

        if (endMinutes <= startMinutes)
            throw new BadHttpRequestException($"{label}End must be after {label}Start.");

        start = TimeSpan.FromMinutes(startMinutes);
        end = TimeSpan.FromMinutes(endMinutes);
    }

    private static void ValidateOptionalRange(
        int? startMinutes,
        int? endMinutes,
        string label,
        out TimeSpan? start,
        out TimeSpan? end)
    {
        if (!startMinutes.HasValue && !endMinutes.HasValue)
        {
            start = null;
            end = null;
            return;
        }

        if (!startMinutes.HasValue || !endMinutes.HasValue)
            throw new BadHttpRequestException($"Provide both {label}StartMinutes and {label}EndMinutes, or neither.");

        var s = startMinutes.Value;
        var e = endMinutes.Value;

        if (!IsValidMinute(s) || !IsValidMinute(e))
            throw new BadHttpRequestException($"Invalid {label} minutes.");

        if (e <= s)
            throw new BadHttpRequestException($"{label}End must be after {label}Start.");

        start = TimeSpan.FromMinutes(s);
        end = TimeSpan.FromMinutes(e);
    }

    private static bool IsValidMinute(int x) => x >= 0 && x < 24 * 60;

    private static string NormalizeTimezone(string? tz)
        => string.IsNullOrWhiteSpace(tz) ? "Europe/Bucharest" : tz.Trim();

    public sealed class UpdateScheduleReq
    {
        public int MonFriStartMinutes { get; set; }
        public int MonFriEndMinutes { get; set; }

        public int? SatStartMinutes { get; set; }
        public int? SatEndMinutes { get; set; }

        public int? SunStartMinutes { get; set; }
        public int? SunEndMinutes { get; set; }

        public string? Timezone { get; set; }
    }
}
