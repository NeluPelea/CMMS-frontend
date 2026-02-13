using Cmms.Api.Services;
using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Cmms.Tests.Services;

public class WorkingCalendarServiceTests
{
    private AppDbContext GetDb(string dbName)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task IsWorkingDay_Weekend_ReturnsFalse()
    {
        using var db = GetDb(Guid.NewGuid().ToString());
        var svc = new WorkingCalendarService(db);

        var saturday = new DateOnly(2024, 6, 1); // June 1st 2024 is Saturday
        // Also June 1st is Children's Day (Holiday), so let's pick a plain weekend.
        // June 8th 2024 is Saturday.
        var sat = new DateOnly(2024, 6, 8);
        var sun = new DateOnly(2024, 6, 9);

        Assert.False(await svc.IsWorkingDay(sat));
        Assert.False(await svc.IsWorkingDay(sun));
    }

    [Fact]
    public async Task IsWorkingDay_FixedHoliday_ReturnsFalse()
    {
        using var db = GetDb(Guid.NewGuid().ToString());
        var svc = new WorkingCalendarService(db);

        var newYear = new DateOnly(2024, 1, 1);
        Assert.False(await svc.IsWorkingDay(newYear));
    }

    [Fact]
    public async Task IsWorkingDay_CompanyBlackout_ReturnsFalse()
    {
        using var db = GetDb(Guid.NewGuid().ToString());
        var date = new DateOnly(2024, 5, 20); // Random Monday
        
        db.CompanyBlackoutDays.Add(new CompanyBlackoutDay 
        { 
            Date = date.ToDateTime(TimeOnly.MinValue), 
            Name = "Company Picnic",
            IsAct = true
        });
        await db.SaveChangesAsync();

        var svc = new WorkingCalendarService(db);
        Assert.False(await svc.IsWorkingDay(date));
    }

    [Fact]
    public async Task GetNextWorkingDay_FromWeekend_ReturnsMonday()
    {
        using var db = GetDb(Guid.NewGuid().ToString());
        var svc = new WorkingCalendarService(db);

        var sat = new DateOnly(2024, 6, 8); // Saturday
        var mon = new DateOnly(2024, 6, 10); // Monday

        var result = await svc.GetNextWorkingDay(sat);
        Assert.Equal(mon, result);
    }
}
