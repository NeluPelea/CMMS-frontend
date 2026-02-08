using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Services;

public sealed class PeopleAvailability
{
    private const string DefaultTzId = "Europe/Bucharest";
    private readonly AppDbContext _db;
    private readonly IUnitScheduleService _unitSchedule;

    public PeopleAvailability(AppDbContext db, IUnitScheduleService unitSchedule)
    {
        _db = db;
        _unitSchedule = unitSchedule;
    }

    /// <summary>
    /// v1 rules:
    /// - interval must be within the same LOCAL calendar day (based on schedule timezone; default Europe/Bucharest)
    /// - person must exist and be active
    /// - company must not be closed (national holiday / blackout day) on that date
    /// - person must not be on leave (CO/CM) for that date (DateOnly)
    /// - interval must be within working hours for that weekday (Mon-Fri, Sat optional, Sun optional)
    /// </summary>
    public async Task<AvailabilityResult> CanAssignAsync(
        Guid personId,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc,
        CancellationToken ct = default)
    {
        if (toUtc <= fromUtc)
            return AvailabilityResult.Fail("plannedTo must be after plannedFrom.");

        // person exists + active
        var person = await _db.People.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == personId, ct);

        if (person is null)
            return AvailabilityResult.Fail("Person not found.");

        if (!person.IsActive)
            return AvailabilityResult.Fail("Person is inactive.");

        // schedule must exist
        var sched = await _db.PersonWorkSchedules.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PersonId == personId, ct);

        if (sched is null)
            return AvailabilityResult.Fail("Person has no work schedule.");

        // timezone
        if (!TryGetTimeZone(sched.Timezone, out var tz, out var tzReason))
            return AvailabilityResult.Fail(tzReason);

        // local-day rule
        if (!TryGetSameLocalDay(fromUtc, toUtc, tz,
                out var localDate, out var localDow, out var localFromMin, out var localToMin, out var reason))
            return AvailabilityResult.Fail(reason);

        // company closed? (holiday/blackout)
        if (await _unitSchedule.IsFactoryClosedAsync(localDate.ToDateTime(TimeOnly.MinValue), ct))
            return AvailabilityResult.Fail("Date is a national holiday or company blackout day.");

        // leave? (CO/CM)
        if (await IsOnLeaveAsync(personId, localDate, ct))
            return AvailabilityResult.Fail("Person is on leave (CO/CM).");

        // working window
        return CheckWorkingWindow(localDow, localFromMin, localToMin, sched);
    }

    /// <summary>
    /// Returns available people for interval (v1 = same local day based on each person's timezone).
    /// NOTE: timezone is per-person, so we evaluate per person.
    /// For 10 users this is fine; we also add small caches to reduce DB roundtrips.
    /// </summary>
    public async Task<List<Person>> ListAvailableAsync(
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc,
        CancellationToken ct = default)
    {
        if (toUtc <= fromUtc)
            return new List<Person>();

        // load active people + schedules in one query (schedule may be missing)
        var rows = await (
            from p in _db.People.AsNoTracking()
            where p.IsActive
            join s in _db.PersonWorkSchedules.AsNoTracking()
                on p.Id equals s.PersonId into sj
            from s in sj.DefaultIfEmpty()
            select new { Person = p, Schedule = s }
        ).ToListAsync(ct);

        if (rows.Count == 0) return new List<Person>();

        // caches (reduce N calls to DB)
        var companyClosedCache = new Dictionary<DateOnly, bool>();
        var leaveCache = new Dictionary<(Guid personId, DateOnly day), bool>();

        var result = new List<Person>(capacity: rows.Count);

        foreach (var row in rows)
        {
            var p = row.Person;
            var sched = row.Schedule;
            if (sched is null)
                continue; // no schedule => not available

            if (!TryGetTimeZone(sched.Timezone, out var tz, out _))
                continue;

            if (!TryGetSameLocalDay(fromUtc, toUtc, tz,
                    out var localDate, out var localDow, out var localFromMin, out var localToMin, out _))
                continue;

            // company closed cache
            if (!companyClosedCache.TryGetValue(localDate, out var isClosed))
            {
                isClosed = await _unitSchedule.IsFactoryClosedAsync(localDate.ToDateTime(TimeOnly.MinValue), ct);
                companyClosedCache[localDate] = isClosed;
            }
            if (isClosed)
                continue;

            // leave cache
            var leaveKey = (p.Id, localDate);
            if (!leaveCache.TryGetValue(leaveKey, out var isOnLeave))
            {
                isOnLeave = await IsOnLeaveAsync(p.Id, localDate, ct);
                leaveCache[leaveKey] = isOnLeave;
            }
            if (isOnLeave)
                continue;

            var ok = CheckWorkingWindow(localDow, localFromMin, localToMin, sched);
            if (ok.IsOk)
                result.Add(p);
        }

        return result
            .OrderBy(x => x.FullName)
            .ToList();
    }

    // ---------------- Helpers ----------------

    private static bool TryGetTimeZone(string? tzId, out TimeZoneInfo tz, out string reason)
    {
        var id = string.IsNullOrWhiteSpace(tzId) ? DefaultTzId : tzId.Trim();

        try
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById(id);
            reason = "";
            return true;
        }
        catch
        {
            tz = TimeZoneInfo.Utc;
            reason = $"Invalid timezone '{id}'.";
            return false;
        }
    }

    private static bool TryGetSameLocalDay(
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc,
        TimeZoneInfo tz,
        out DateOnly localDate,
        out DayOfWeek localDow,
        out int localFromMin,
        out int localToMin,
        out string reason)
    {
        localDate = default;
        localDow = default;
        localFromMin = default;
        localToMin = default;
        reason = "";

        var fromLocal = TimeZoneInfo.ConvertTime(fromUtc, tz);
        var toLocal = TimeZoneInfo.ConvertTime(toUtc, tz);

        var fromDate = DateOnly.FromDateTime(fromLocal.DateTime);
        var toDate = DateOnly.FromDateTime(toLocal.DateTime);

        if (fromDate != toDate)
        {
            reason = "Interval must be within the same local day (v1).";
            return false;
        }

        localDate = fromDate;
        localDow = fromLocal.DayOfWeek;

        localFromMin = (int)fromLocal.TimeOfDay.TotalMinutes;
        localToMin = (int)toLocal.TimeOfDay.TotalMinutes;

        if (localToMin <= localFromMin)
        {
            reason = "plannedTo must be after plannedFrom.";
            return false;
        }

        return true;
    }

    // Your DB uses DateTime for holidays/blackouts; you store "date-only semantics at 00:00 UTC".
    // So we compare against UTC midnight for that calendar date.


    private async Task<bool> IsOnLeaveAsync(Guid personId, DateOnly day, CancellationToken ct)
    {
        return await _db.PersonLeaves.AsNoTracking()
            .AnyAsync(x => x.PersonId == personId && x.StartDate <= day && x.EndDate >= day, ct);
    }

    private static AvailabilityResult CheckWorkingWindow(
        DayOfWeek dow,
        int fromMin,
        int toMin,
        PersonWorkSchedule sched)
    {
        // Sunday optional
        if (dow == DayOfWeek.Sunday)
        {
            if (!sched.SunStart.HasValue || !sched.SunEnd.HasValue)
                return AvailabilityResult.Fail("No Sunday schedule.");

            return CheckWindow(fromMin, toMin,
                (int)sched.SunStart.Value.TotalMinutes,
                (int)sched.SunEnd.Value.TotalMinutes);
        }

        // Saturday optional
        if (dow == DayOfWeek.Saturday)
        {
            if (!sched.SatStart.HasValue || !sched.SatEnd.HasValue)
                return AvailabilityResult.Fail("No Saturday schedule.");

            return CheckWindow(fromMin, toMin,
                (int)sched.SatStart.Value.TotalMinutes,
                (int)sched.SatEnd.Value.TotalMinutes);
        }

        // Mon-Fri required
        return CheckWindow(fromMin, toMin,
            (int)sched.MonFriStart.TotalMinutes,
            (int)sched.MonFriEnd.TotalMinutes);
    }

    private static AvailabilityResult CheckWindow(int fromMin, int toMin, int startMin, int endMin)
    {
        // Only validate start time against working hours (allow overrunning end of shift)
        if (fromMin < startMin || fromMin >= endMin)
            return AvailabilityResult.Fail("Start time is outside working hours.");

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
