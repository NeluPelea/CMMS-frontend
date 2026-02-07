using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Services;

public class PmBackgroundService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<PmBackgroundService> _logger;

    public PmBackgroundService(IServiceProvider services, ILogger<PmBackgroundService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PmBackgroundService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await GenerateDuePmPlans(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while generating PM plans.");
            }

            // check every hour
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task GenerateDuePmPlans(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTimeOffset.UtcNow;

        // Find plans due
        var duePlans = await db.PmPlans
            .Include(x => x.Items)
            .Where(x => x.IsAct && x.NextDueAt <= now)
            .OrderBy(x => x.NextDueAt)
            .Take(500) // safety limit
            .ToListAsync(ct);

        if (duePlans.Count == 0) return;

        _logger.LogInformation($"Found {duePlans.Count} due PM plans. Generating Work Orders...");

        foreach (var p in duePlans)
        {
            var desc = (p.Items == null || p.Items.Count == 0)
                ? null
                : string.Join("\n", p.Items.OrderBy(i => i.Sort).Select(i => "- " + i.Text));

            var wo = new WorkOrder
            {
                Title = $"PM: {p.Name}",
                Description = desc,
                Type = WorkOrderType.Preventive,
                Status = WorkOrderStatus.Open,
                AssetId = p.AssetId,
                PmPlanId = p.Id,
                StartAt = null, // Scheduled, but not started
                // Assign to default role/person if logic existed, for now leave empty
            };

            db.WorkOrders.Add(wo);

            // Update NextDueAt
            p.NextDueAt = NextAfterBump(p.NextDueAt.ToUniversalTime(), p.Frequency);
        }

        await db.SaveChangesAsync(ct);
        _logger.LogInformation("PM Generation complete.");
    }

    private static DateTimeOffset NextAfterBump(DateTimeOffset currentUtc, PmFrequency f)
    {
        return f switch
        {
            PmFrequency.Daily => currentUtc.AddDays(1),
            PmFrequency.Weekly => currentUtc.AddDays(7),
            _ => currentUtc.AddMonths(1)
        };
    }
}
