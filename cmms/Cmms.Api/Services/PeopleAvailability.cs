using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Services;

public sealed class PeopleAvailability
{
    private readonly AppDbContext _db;

    public PeopleAvailability(AppDbContext db) => _db = db;

    /// <summary>
    /// Returns true if person can be assigned in [fromUtc, toUtc) interval.
    /// Rules:
    /// - person must exist and be active
    /// - must not be on leave (CO/CM) on that day
    /// - day must not be a holiday or company blackout day
    /// - time window must be inside working hours for that weekday (Mon-Fri) or Saturday
    /// Notes:
    /// - v1 supports intervals within the same calendar day (UTC date).
    /// </summary>
    public async Task<AvailabilityResult> CanAssignAsync(Guid personId, DateTimeOffset fromUtc, DateTimeOffset toUtc, CancellationToken ct = default)
    {
        if (toUtc <= fromUtc)
            return AvailabilityResult.Fail("plannedTo must be after plannedFrom.");

        // enforce same-day (v1)
        var day = fromUtc.UtcDateTime.Date;
        if (toUtc.UtcDateTime.Date != day)
            return AvailabilityResult.Fail("Interval must be within the same day (v1).");

        var person = await _db.People.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == personId, ct);

        if (person == null)
            return AvailabilityResult.Fail("Person not found.");

        if (!person.IsActive)
            return AvailabilityResult.Fail("Person is inactive.");

        var d = DateTime.SpecifyKind(day, DateTimeKind.Utc);

        // holiday / blackout
        var isHoliday = await _db.NationalHolidays.AsNoTracking().AnyAsync(x => x.Date == d, ct);
        if (isHoliday) return AvailabilityResult.Fail("Date is a national holiday.");

        var isBlackout = await _db.CompanyBlackoutDays.AsNoTracking().AnyAsync(x => x.Date == d, ct);
        if (isBlackout) return AvailabilityResult.Fail("Date is a company blackout day.");

        // leave CO/CM
        var onLeave = await _db.PersonLeaves.AsNoTracking()
            .AnyAsync(x => x.PersonId == personId && x.StartDate <= d && x.EndDate >= d, ct);

        if (onLeave) return AvailabilityResult.Fail("Person is on leave (CO/CM).");

        // schedule
        var sched = await _db.PersonWorkSchedules.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PersonId == personId, ct);

        // if missing schedule: treat as not available (safe)
        if (sched == null)
            return AvailabilityResult.Fail("Person has no work schedule.");

        var dow = fromUtc.UtcDateTime.DayOfWeek;

        // Sunday = never
        if (dow == DayOfWeek.Sunday)
            return AvailabilityResult.Fail("Sunday is non-working.");

        // Saturday uses SatStart/SatEnd (optional)
        if (dow == DayOfWeek.Saturday)
        {
            if (!sched.SatStart.HasValue || !sched.SatEnd.HasValue)
                return AvailabilityResult.Fail("No Saturday schedule.");

            return CheckWindow(fromUtc, toUtc, sched.SatStart.Value, sched.SatEnd.Value);
        }

        // Mon-Fri
        return CheckWindow(fromUtc, toUtc, sched.MonFriStart, sched.MonFriEnd);
    }

    /// <summary>
    /// Returns list of available people for a given interval.
    /// </summary>
    public async Task<List<Person>> ListAvailableAsync(DateTimeOffset fromUtc, DateTimeOffset toUtc, CancellationToken ct = default)
    {
        if (toUtc <= fromUtc) return new List<Person>();

        var day = fromUtc.UtcDateTime.Date;
        if (toUtc.UtcDateTime.Date != day) return new List<Person>();

        var d = DateTime.SpecifyKind(day, DateTimeKind.Utc);

        // if holiday/blackout => nobody available
        var isHoliday = await _db.NationalHolidays.AsNoTracking().AnyAsync(x => x.Date == d, ct);
        if (isHoliday) return new List<Person>();

        var isBlackout = await _db.CompanyBlackoutDays.AsNoTracking().AnyAsync(x => x.Date == d, ct);
        if (isBlackout) return new List<Person>();

        var dow = fromUtc.UtcDateTime.DayOfWeek;
        if (dow == DayOfWeek.Sunday) return new List<Person>();

        var fromMin = (int)fromUtc.UtcDateTime.TimeOfDay.TotalMinutes;
        var toMin = (int)toUtc.UtcDateTime.TimeOfDay.TotalMinutes;

        // People active
        var activePeople = _db.People.AsNoTracking().Where(p => p.IsActive);

        // Exclude on leave
        var leavePeople = _db.PersonLeaves.AsNoTracking()
            .Where(l => l.StartDate <= d && l.EndDate >= d)
            .Select(l => l.PersonId);

        activePeople = activePeople.Where(p => !leavePeople.Contains(p.Id));

        // Join schedules and filter by time window
        var q = from p in activePeople
                join s in _db.PersonWorkSchedules.AsNoTracking() on p.Id equals s.PersonId
                select new { p, s };

        if (dow == DayOfWeek.Saturday)
        {
            q = q.Where(x => x.s.SatStart.HasValue && x.s.SatEnd.HasValue);

            q = q.Where(x =>
                fromMin >= (int)x.s.SatStart!.Value.TotalMinutes &&
                toMin <= (int)x.s.SatEnd!.Value.TotalMinutes);
        }
        else
        {
            q = q.Where(x =>
                fromMin >= (int)x.s.MonFriStart.TotalMinutes &&
                toMin <= (int)x.s.MonFriEnd.TotalMinutes);
        }

        return await q
            .OrderBy(x => x.p.FullName)
            .Select(x => x.p)
            .ToListAsync(ct);
    }

    private static AvailabilityResult CheckWindow(DateTimeOffset fromUtc, DateTimeOffset toUtc, TimeSpan start, TimeSpan end)
    {
        var fromMin = (int)fromUtc.UtcDateTime.TimeOfDay.TotalMinutes;
        var toMin = (int)toUtc.UtcDateTime.TimeOfDay.TotalMinutes;

        var startMin = (int)start.TotalMinutes;
        var endMin = (int)end.TotalMinutes;

        if (fromMin < startMin || toMin > endMin)
            return AvailabilityResult.Fail("Outside working hours.");

        return AvailabilityResult.Ok();
    }
}

public sealed class AvailabilityResult
{
    public bool IsOk { get; private set; }
    public string? Reason { get; private set; }

    private AvailabilityResult() { }

    public static AvailabilityResult Ok() => new AvailabilityResult { IsOk = true };
    public static AvailabilityResult Fail(string reason) => new AvailabilityResult { IsOk = false, Reason = reason };
}
