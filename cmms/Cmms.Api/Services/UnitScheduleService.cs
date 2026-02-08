using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Services;

public interface IUnitScheduleService
{
    Task<(bool IsOpen, TimeOnly? Start, TimeOnly? End)> GetUnitScheduleForDateAsync(DateTime date, CancellationToken ct = default);
    Task<List<DateTime>> GetActiveNationalHolidaysAsync(DateTime from, DateTime to, CancellationToken ct = default);
    Task<List<DateTime>> GetActiveCompanyClosedDaysAsync(DateTime from, DateTime to, CancellationToken ct = default);
    Task<bool> IsFactoryClosedAsync(DateTime date, CancellationToken ct = default);
}

public sealed class UnitScheduleService : IUnitScheduleService
{
    private readonly AppDbContext _db;

    public UnitScheduleService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(bool IsOpen, TimeOnly? Start, TimeOnly? End)> GetUnitScheduleForDateAsync(DateTime date, CancellationToken ct = default)
    {
        if (await IsFactoryClosedAsync(date, ct))
            return (false, null, null);

        var schedule = await _db.UnitWorkSchedule.AsNoTracking().FirstOrDefaultAsync(ct);
        
        // Default if not saved in DB yet
        if (schedule == null)
        {
            if (date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday)
                return (false, null, null);
            
            return (true, new TimeOnly(8, 0), new TimeOnly(17, 0));
        }

        switch (date.DayOfWeek)
        {
            case DayOfWeek.Saturday:
                return schedule.SatStart.HasValue && schedule.SatEnd.HasValue 
                    ? (true, schedule.SatStart, schedule.SatEnd) 
                    : (false, null, null);
            
            case DayOfWeek.Sunday:
                return schedule.SunStart.HasValue && schedule.SunEnd.HasValue 
                    ? (true, schedule.SunStart, schedule.SunEnd) 
                    : (false, null, null);
            
            default:
                return (true, schedule.MonFriStart, schedule.MonFriEnd);
        }
    }

    public async Task<List<DateTime>> GetActiveNationalHolidaysAsync(DateTime from, DateTime to, CancellationToken ct = default)
    {
        var f = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
        var t = DateTime.SpecifyKind(to.Date, DateTimeKind.Utc);
        return await _db.NationalHolidays.AsNoTracking()
            .Where(x => x.Date >= f && x.Date <= t)
            .OrderBy(x => x.Date)
            .Select(x => x.Date)
            .ToListAsync(ct);
    }

    public async Task<List<DateTime>> GetActiveCompanyClosedDaysAsync(DateTime from, DateTime to, CancellationToken ct = default)
    {
        var f = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
        var t = DateTime.SpecifyKind(to.Date, DateTimeKind.Utc);
        return await _db.CompanyBlackoutDays.AsNoTracking()
            .Where(x => x.Date >= f && x.Date <= t)
            .OrderBy(x => x.Date)
            .Select(x => x.Date)
            .ToListAsync(ct);
    }

    public async Task<bool> IsFactoryClosedAsync(DateTime date, CancellationToken ct = default)
    {
        var dayUtc = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);

        // Note: Global Query Filters in AppDbContext handle x.IsAct filtering automatically.
        var isHoliday = await _db.NationalHolidays.AsNoTracking()
            .AnyAsync(x => x.Date == dayUtc, ct);
        if (isHoliday) return true;

        var isBlackout = await _db.CompanyBlackoutDays.AsNoTracking()
            .AnyAsync(x => x.Date == dayUtc, ct);
        return isBlackout;
    }
}
