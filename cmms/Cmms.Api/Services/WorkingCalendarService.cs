using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Services;

public class WorkingCalendarService : IWorkingCalendar
{
    private readonly AppDbContext _db;
    
    // Hardcoded Romanian holidays (fixed dates)
    // Month, Day
    private static readonly HashSet<(int Month, int Day)> FixedHolidays = new()
    {
        (1, 1),   // Anul Nou
        (1, 2),   // Anul Nou
        (1, 6),   // Boboteaza
        (1, 7),   // Sf. Ion
        (1, 24),  // Unirea Principatelor
        (5, 1),   // Ziua Muncii
        (6, 1),   // Ziua Copilului
        (8, 15),  // Adormirea Maicii Domnului
        (11, 30), // Sf. Andrei
        (12, 1),  // Ziua Nationala
        (12, 25), // Craciun
        (12, 26)  // Craciun
    };

    public WorkingCalendarService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<bool> IsWorkingDay(DateOnly day)
    {
        // 1. Check Weekend
        if (day.DayOfWeek == DayOfWeek.Saturday || day.DayOfWeek == DayOfWeek.Sunday)
            return false;

        // 2. Check Fixed Holidays
        if (FixedHolidays.Contains((day.Month, day.Day)))
            return false;

        // 3. Check Orthodox Easter (Moveable) - Simple alg or hardcoded for recent years
        if (IsOrthodoxEasterHoliday(day))
            return false;

        // 4. Check Company Blackout / National Holidays from DB
        // Treating both NationalHoliday entity and CompanyBlackoutDay as "days off"
        // Since the prompt mentioned storing company closed days in DB.
        // We'll check both tables if they exist and are active.
        
        // Note: Using ToDateTime to match DB storage (Date stored as DateTime at midnight)
        var dateDt = DateTime.SpecifyKind(day.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

        // Check NationalHoliday table
        var isNationalHoliday = await _db.NationalHolidays
            .AnyAsync(x => x.IsAct && x.Date == dateDt);
        if (isNationalHoliday) return false;

        // Check CompanyBlackoutDay table
        var isBlackout = await _db.CompanyBlackoutDays
            .AnyAsync(x => x.IsAct && x.Date == dateDt);
        if (isBlackout) return false;

        return true;
    }

    public async Task<DateOnly> GetNextWorkingDay(DateOnly day)
    {
        var current = day;
        // Limit loop to avoid infinite loops (e.g. 1 year)
        for (int i = 0; i < 366; i++)
        {
            if (await IsWorkingDay(current))
            {
                return current;
            }
            current = current.AddDays(1);
        }
        // Fallback
        return day;
    }

    private static bool IsOrthodoxEasterHoliday(DateOnly d)
    {
        // Simple logic: Hardcode 2024-2030 to be safe and simple
        // Orthodox Easter Sunday dates:
        // 2024: May 5
        // 2025: April 20
        // 2026: April 12
        // 2027: May 2
        // 2028: April 16
        // 2029: April 8
        // 2030: April 28

        // Holidays are usually Easter Sunday + Monday (maybe Friday before?)
        // Let's assume Sunday + Monday are official holidays.
        
        var year = d.Year;
        // Get Easter Sunday for the year
        DateOnly? easterSunday = year switch
        {
            2024 => new DateOnly(2024, 5, 5),
            2025 => new DateOnly(2025, 4, 20),
            2026 => new DateOnly(2026, 4, 12),
            2027 => new DateOnly(2027, 5, 2),
            2028 => new DateOnly(2028, 4, 16),
            2029 => new DateOnly(2029, 4, 8),
            2030 => new DateOnly(2030, 4, 28),
            _ => null
        };

        if (easterSunday == null) return false; // Out of range, ignore

        var easterMonday = easterSunday.Value.AddDays(1);
        // Good Friday is also a holiday in Romania since recently?
        var goodFriday = easterSunday.Value.AddDays(-2);

        return d == easterSunday || d == easterMonday || d == goodFriday;
    }
}
