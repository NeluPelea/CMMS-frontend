using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Services;

public class PmBackgroundService : BackgroundService
{
    private readonly PmSchedulingService _scheduler;
    private readonly ILogger<PmBackgroundService> _logger;

    public PmBackgroundService(PmSchedulingService scheduler, ILogger<PmBackgroundService> logger)
    {
        _scheduler = scheduler;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PmBackgroundService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Run generation logic
                await _scheduler.GenerateDuePlans(500, "Background", stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred in PM background cycle.");
            }

            // check every hour
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
