using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/calendar")]
[Authorize]
public sealed class CalendarController : ControllerBase
{
    private readonly AppDbContext _db;
    public CalendarController(AppDbContext db) => _db = db;

    // ---------------- National Holidays ----------------

    // GET /api/calendar/holidays?year=2026
    [HttpGet("holidays")]
    public async Task<ActionResult<List<DayDto>>> ListHolidays([FromQuery] int? year = null, CancellationToken ct = default)
    {
        var q = _db.NationalHolidays.AsNoTracking();

        if (year.HasValue && year.Value >= 2000 && year.Value <= 2100)
        {
            var y = year.Value;
            q = q.Where(x => x.Date.Year == y);
        }

        var items = await q
            .OrderBy(x => x.Date)
            .Select(x => new DayDto { Date = x.Date, Name = x.Name })
            .ToListAsync(ct);

        return items;
    }

    // POST /api/calendar/holidays
    [HttpPost("holidays")]
    public async Task<IActionResult> AddHoliday([FromBody] AddDayReq req, CancellationToken ct)
    {
        var d = DateTime.SpecifyKind(req.Date.Date, DateTimeKind.Utc);
        var name = string.IsNullOrWhiteSpace(req.Name) ? null : req.Name.Trim();

        var exists = await _db.NationalHolidays.AnyAsync(x => x.Date == d, ct);
        if (exists) return Conflict("Holiday already exists for that date.");

        _db.NationalHolidays.Add(new NationalHoliday
        {
            Date = d,
            Name = name
        });

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // DELETE /api/calendar/holidays/2026-01-01
    [HttpDelete("holidays/{date}")]
    public async Task<IActionResult> DeleteHoliday(string date, CancellationToken ct)
    {
        if (!DateTime.TryParse(date, out var parsed))
            return BadRequest("Invalid date. Use yyyy-MM-dd.");

        var d = DateTime.SpecifyKind(parsed.Date, DateTimeKind.Utc);

        var e = await _db.NationalHolidays.FirstOrDefaultAsync(x => x.Date == d, ct);
        if (e == null) return NotFound();

        _db.NationalHolidays.Remove(e);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------------- Company Blackouts ----------------

    // GET /api/calendar/blackouts?year=2026
    [HttpGet("blackouts")]
    public async Task<ActionResult<List<DayDto>>> ListBlackouts([FromQuery] int? year = null, CancellationToken ct = default)
    {
        var q = _db.CompanyBlackoutDays.AsNoTracking();

        if (year.HasValue && year.Value >= 2000 && year.Value <= 2100)
        {
            var y = year.Value;
            q = q.Where(x => x.Date.Year == y);
        }

        var items = await q
            .OrderBy(x => x.Date)
            .Select(x => new DayDto { Date = x.Date, Name = x.Name })
            .ToListAsync(ct);

        return items;
    }

    // POST /api/calendar/blackouts
    [HttpPost("blackouts")]
    public async Task<IActionResult> AddBlackout([FromBody] AddDayReq req, CancellationToken ct)
    {
        var d = DateTime.SpecifyKind(req.Date.Date, DateTimeKind.Utc);
        var name = string.IsNullOrWhiteSpace(req.Name) ? null : req.Name.Trim();

        var exists = await _db.CompanyBlackoutDays.AnyAsync(x => x.Date == d, ct);
        if (exists) return Conflict("Blackout already exists for that date.");

        _db.CompanyBlackoutDays.Add(new CompanyBlackoutDay
        {
            Date = d,
            Name = name
        });

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // DELETE /api/calendar/blackouts/2026-08-17
    [HttpDelete("blackouts/{date}")]
    public async Task<IActionResult> DeleteBlackout(string date, CancellationToken ct)
    {
        if (!DateTime.TryParse(date, out var parsed))
            return BadRequest("Invalid date. Use yyyy-MM-dd.");

        var d = DateTime.SpecifyKind(parsed.Date, DateTimeKind.Utc);

        var e = await _db.CompanyBlackoutDays.FirstOrDefaultAsync(x => x.Date == d, ct);
        if (e == null) return NotFound();

        _db.CompanyBlackoutDays.Remove(e);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------------- Combined (useful for PM/WO UI) ----------------

    // GET /api/calendar/nonworking?from=2026-01-01&to=2026-12-31
    [HttpGet("nonworking")]
    public async Task<ActionResult<NonWorkingDto>> ListNonWorking([FromQuery] DateTime from, [FromQuery] DateTime to, CancellationToken ct)
    {
        var f = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
        var t = DateTime.SpecifyKind(to.Date, DateTimeKind.Utc);
        if (t < f) return BadRequest("to must be >= from");

        var holidays = await _db.NationalHolidays.AsNoTracking()
            .Where(x => x.Date >= f && x.Date <= t)
            .OrderBy(x => x.Date)
            .Select(x => new DayDto { Date = x.Date, Name = x.Name })
            .ToListAsync(ct);

        var blackouts = await _db.CompanyBlackoutDays.AsNoTracking()
            .Where(x => x.Date >= f && x.Date <= t)
            .OrderBy(x => x.Date)
            .Select(x => new DayDto { Date = x.Date, Name = x.Name })
            .ToListAsync(ct);

        return new NonWorkingDto { Holidays = holidays, Blackouts = blackouts };
    }

    // DTOs
    public sealed class AddDayReq
    {
        public DateTime Date { get; set; } // date-only
        public string? Name { get; set; }
    }

    public sealed class DayDto
    {
        public DateTime Date { get; set; }
        public string? Name { get; set; }
    }

    public sealed class NonWorkingDto
    {
        public List<DayDto> Holidays { get; set; } = new();
        public List<DayDto> Blackouts { get; set; } = new();
    }
}
