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
    [Authorize(Policy = "Perm:CALENDAR_READ")]
    public async Task<ActionResult<List<DayDto>>> ListHolidays(
        [FromQuery] int? year = null, 
        [FromQuery] bool includeDeleted = false,
        CancellationToken ct = default)
    {
        IQueryable<NationalHoliday> q = _db.NationalHolidays.AsNoTracking();
        if (includeDeleted) q = q.IgnoreQueryFilters();

        if (year.HasValue && year.Value >= 2000 && year.Value <= 2100)
        {
            var y = year.Value;
            q = q.Where(x => x.Date.Year == y);
        }
        var items = await q
            .OrderBy(x => x.Date)
            .Select(x => new DayDto { Date = x.Date, Name = x.Name, IsAct = x.IsAct })
            .ToListAsync(ct);

        return items;
    }

    // POST /api/calendar/holidays
    [HttpPost("holidays")]
    [Authorize(Policy = "Perm:CALENDAR_UPDATE")]
    public async Task<IActionResult> AddHoliday([FromBody] AddDayReq req, CancellationToken ct)
    {
        var d = DateTime.SpecifyKind(req.Date.Date, DateTimeKind.Utc);
        var name = string.IsNullOrWhiteSpace(req.Name) ? null : req.Name.Trim();

        var existing = await _db.NationalHolidays.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Date == d, ct);
        if (existing != null)
        {
            if (existing.IsAct) return Conflict("Holiday already exists for that date.");
            
            // Re-activate
            existing.IsAct = true;
            existing.Name = name;
        }
        else
        {
            _db.NationalHolidays.Add(new NationalHoliday
            {
                Date = d,
                Name = name,
                IsAct = true
            });
        }

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
        var e = await _db.NationalHolidays.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Date == d, ct);
        if (e == null) return NotFound();

        // soft delete
        if (e.IsAct)
        {
            e.IsAct = false;
            await _db.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    // PUT /api/calendar/holidays/{date}
    [HttpPut("holidays/{date}")]
    public async Task<IActionResult> UpdateHoliday(string date, [FromBody] AddDayReq req, CancellationToken ct)
    {
        if (!DateTime.TryParse(date, out var parsed))
            return BadRequest("Invalid date. Use yyyy-MM-dd.");

        var oldD = DateTime.SpecifyKind(parsed.Date, DateTimeKind.Utc);
        var newD = DateTime.SpecifyKind(req.Date.Date, DateTimeKind.Utc);
        var name = string.IsNullOrWhiteSpace(req.Name) ? null : req.Name.Trim();

        var e = await _db.NationalHolidays.FirstOrDefaultAsync(x => x.Date == oldD, ct);
        if (e == null) return NotFound();

        if (newD != oldD)
        {
            var exists = await _db.NationalHolidays.AnyAsync(x => x.Date == newD, ct);
            if (exists) return Conflict("Holiday already exists for that new date.");
            e.Date = newD;
        }

        e.Name = name;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // PUT /api/calendar/blackouts/{date}
    [HttpPut("blackouts/{date}")]
    public async Task<IActionResult> UpdateBlackout(string date, [FromBody] AddDayReq req, CancellationToken ct)
    {
        if (!DateTime.TryParse(date, out var parsed))
            return BadRequest("Invalid date. Use yyyy-MM-dd.");

        var oldD = DateTime.SpecifyKind(parsed.Date, DateTimeKind.Utc);
        var newD = DateTime.SpecifyKind(req.Date.Date, DateTimeKind.Utc);
        var name = string.IsNullOrWhiteSpace(req.Name) ? null : req.Name.Trim();

        var e = await _db.CompanyBlackoutDays.FirstOrDefaultAsync(x => x.Date == oldD, ct);
        if (e == null) return NotFound();

        if (newD != oldD)
        {
            var exists = await _db.CompanyBlackoutDays.AnyAsync(x => x.Date == newD, ct);
            if (exists) return Conflict("Blackout already exists for that new date.");
            e.Date = newD;
        }

        e.Name = name;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------------- Company Blackouts ----------------

    // GET /api/calendar/blackouts?year=2026
    [HttpGet("blackouts")]
    public async Task<ActionResult<List<DayDto>>> ListBlackouts(
        [FromQuery] int? year = null, 
        [FromQuery] bool includeDeleted = false,
        CancellationToken ct = default)
    {
        IQueryable<CompanyBlackoutDay> q = _db.CompanyBlackoutDays.AsNoTracking();
        if (includeDeleted) q = q.IgnoreQueryFilters();

        if (year.HasValue && year.Value >= 2000 && year.Value <= 2100)
        {
            var y = year.Value;
            q = q.Where(x => x.Date.Year == y);
        }

        var items = await q
            .OrderBy(x => x.Date)
            .Select(x => new DayDto { Date = x.Date, Name = x.Name, IsAct = x.IsAct })
            .ToListAsync(ct);

        return items;
    }

    // POST /api/calendar/blackouts
    [HttpPost("blackouts")]
    public async Task<IActionResult> AddBlackout([FromBody] AddDayReq req, CancellationToken ct)
    {
        var d = DateTime.SpecifyKind(req.Date.Date, DateTimeKind.Utc);
        var name = string.IsNullOrWhiteSpace(req.Name) ? null : req.Name.Trim();

        var existing = await _db.CompanyBlackoutDays.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Date == d, ct);
        if (existing != null)
        {
            if (existing.IsAct) return Conflict("Blackout already exists for that date.");
            
            // Re-activate
            existing.IsAct = true;
            existing.Name = name;
        }
        else
        {
            _db.CompanyBlackoutDays.Add(new CompanyBlackoutDay
            {
                Date = d,
                Name = name,
                IsAct = true
            });
        }

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
        var e = await _db.CompanyBlackoutDays.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Date == d, ct);
        if (e == null) return NotFound();

        // soft delete
        if (e.IsAct)
        {
            e.IsAct = false;
            await _db.SaveChangesAsync(ct);
        }

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
            .Where(x => x.Date >= f && x.Date <= t && x.IsAct)
            .OrderBy(x => x.Date)
            .Select(x => new DayDto { Date = x.Date, Name = x.Name, IsAct = x.IsAct })
            .ToListAsync(ct);

        var blackouts = await _db.CompanyBlackoutDays.AsNoTracking()
            .Where(x => x.Date >= f && x.Date <= t && x.IsAct)
            .OrderBy(x => x.Date)
            .Select(x => new DayDto { Date = x.Date, Name = x.Name, IsAct = x.IsAct })
            .ToListAsync(ct);

        return new NonWorkingDto { Holidays = holidays, Blackouts = blackouts };
    }

    // ---------------- Production Unit Work Schedule ----------------

    // GET /api/calendar/unit-work-schedule
    [HttpGet("unit-work-schedule")]
    public async Task<ActionResult<UnitWorkSchedule>> GetUnitWorkSchedule(CancellationToken ct)
    {
        var schedule = await _db.UnitWorkSchedule.AsNoTracking().FirstOrDefaultAsync(ct);
        if (schedule == null)
        {
            // Return default sensible values
            return new UnitWorkSchedule
            {
                MonFriStart = new TimeOnly(8, 0),
                MonFriEnd = new TimeOnly(17, 0),
                SatStart = null,
                SatEnd = null,
                SunStart = null,
                SunEnd = null
            };
        }
        return schedule;
    }

    // PUT /api/calendar/unit-work-schedule
    [HttpPut("unit-work-schedule")]
    public async Task<ActionResult<UnitWorkSchedule>> UpdateUnitWorkSchedule([FromBody] UnitWorkScheduleUpdateReq req, CancellationToken ct)
    {
        // Validation
        if (req.MonFriEnd <= req.MonFriStart)
            return BadRequest("Luni-Vineri: Ora pana la trebuie sa fie dupa ora de la.");

        if (req.SatStart.HasValue && req.SatEnd.HasValue)
        {
            if (req.SatEnd <= req.SatStart)
                return BadRequest("Sambata: Ora pana la trebuie sa fie dupa ora de la.");
        }
        else if (req.SatStart.HasValue || req.SatEnd.HasValue)
        {
            return BadRequest("Sambata: Ambele ore trebuie sa fie prezente sau ambele sa fie nule.");
        }

        if (req.SunStart.HasValue && req.SunEnd.HasValue)
        {
            if (req.SunEnd <= req.SunStart)
                return BadRequest("Duminica: Ora pana la trebuie sa fie dupa ora de la.");
        }
        else if (req.SunStart.HasValue || req.SunEnd.HasValue)
        {
            return BadRequest("Duminica: Ambele ore trebuie sa fie prezente sau ambele sa fie nule.");
        }

        var schedule = await _db.UnitWorkSchedule.FirstOrDefaultAsync(ct);
        if (schedule == null)
        {
            schedule = new UnitWorkSchedule();
            _db.UnitWorkSchedule.Add(schedule);
        }

        schedule.MonFriStart = req.MonFriStart;
        schedule.MonFriEnd = req.MonFriEnd;
        schedule.SatStart = req.SatStart;
        schedule.SatEnd = req.SatEnd;
        schedule.SunStart = req.SunStart;
        schedule.SunEnd = req.SunEnd;
        schedule.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return schedule;
    }

    // DTOs
    public sealed class UnitWorkScheduleUpdateReq
    {
        public TimeOnly MonFriStart { get; set; }
        public TimeOnly MonFriEnd { get; set; }
        public TimeOnly? SatStart { get; set; }
        public TimeOnly? SatEnd { get; set; }
        public TimeOnly? SunStart { get; set; }
        public TimeOnly? SunEnd { get; set; }
    }
    public sealed class AddDayReq
    {
        public DateTime Date { get; set; } // date-only
        public string? Name { get; set; }
    }

    public sealed class DayDto
    {
        public DateTime Date { get; set; }
        public string? Name { get; set; }
        public bool IsAct { get; set; }
    }

    public sealed class NonWorkingDto
    {
        public List<DayDto> Holidays { get; set; } = new();
        public List<DayDto> Blackouts { get; set; } = new();
    }
}
