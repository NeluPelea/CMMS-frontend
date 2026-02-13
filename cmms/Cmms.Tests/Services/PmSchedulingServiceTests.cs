using Cmms.Api.Services;
using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Cmms.Tests.Services;

public class PmSchedulingServiceTests
{
    private ServiceProvider _provider;
    private AppDbContext _db;

    public PmSchedulingServiceTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(opt => opt.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddScoped<IWorkingCalendar, WorkingCalendarService>();
        services.AddLogging();
        
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<AppDbContext>();
    }

    private PmSchedulingService CreateSvc(IWorkingCalendar? mockCalendar = null)
    {
        var logger = Mock.Of<ILogger<PmSchedulingService>>();
        // Create scope factory wrapper
        var scopeFactory = _provider.GetRequiredService<IServiceScopeFactory>();
        
        // Use real calendar if not mocked
        // But internal logic uses scope resolution.
        // We can't easily inject mock calendar into strict internal scope resolution without replacing usage.
        // However, we registered WorkingCalendarService above.
        // To mock it, we would need to replace it in DI.
        
        return new PmSchedulingService(scopeFactory, logger);
    }

    [Fact]
    public async Task CalculateNextDue_ShiftsTo0800Local()
    {
        // 2024-06-03 is Monday.
        // Current due: 2024-06-03 10:00 UTC. 
        // Romania is UTC+3 in June (DST). So 13:00 Local.
        // Frequency: Daily.
        // Target: 2024-06-04 (Tuesday). 
        // 08:00 Local -> 05:00 UTC.
        
        var svc = CreateSvc();
        var cal = _provider.GetRequiredService<IWorkingCalendar>(); // resolution for helper method

        var current = new DateTimeOffset(2024, 6, 3, 10, 0, 0, TimeSpan.Zero); 
        var next = await svc.CalculateNextDue(current, PmFrequency.Daily, cal);

        // Expected: 2024-06-04 05:00:00 +00:00
        Assert.Equal(5, next.Hour);
        Assert.Equal(0, next.Minute);
        Assert.Equal(4, next.Day);
    }
}
