using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cmms.Api.Services;

public class PmSchedulingService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PmSchedulingService> _logger;

    // Fixed timezone for scheduling
    private static readonly TimeZoneInfo RoTimeZone = TimeZoneInfo.FindSystemTimeZoneById("E. Europe Standard Time"); // Windows ID for Europe/Bucharest

    public PmSchedulingService(IServiceScopeFactory scopeFactory, ILogger<PmSchedulingService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    /// <summary>
    /// Generates work orders for all PM plans that are due.
    /// Processing is done in batches but each plan is isolated in its own transaction/scope to prevent one failure from blocking others.
    /// </summary>
    public async Task<int> GenerateDuePlans(int limit, string triggeredBy, CancellationToken ct = default)
    {
        var nowUtc = DateTimeOffset.UtcNow;
        List<Guid> planIds;

        // 1. Fetch IDs of due plans in a quick scope
        using (var scope = _scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            planIds = await db.PmPlans
                .AsNoTracking()
                .Where(x => x.IsAct && x.NextDueAt <= nowUtc)
                .OrderBy(x => x.NextDueAt)
                .Select(x => x.Id)
                .Take(limit)
                .ToListAsync(ct);
        }

        if (planIds.Count == 0) return 0;

        _logger.LogInformation($"Found {planIds.Count} due PM plans.");

        int createdCount = 0;

        // 2. Process each plan in its own scope/transaction
        foreach (var planId in planIds)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var result = await ProcessSinglePlan(planId, triggeredBy, ct);
                if (result) createdCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Critical error processing PM Plan {planId}");
            }
        }

        return createdCount;
    }

    private async Task<bool> ProcessSinglePlan(Guid planId, string triggeredBy, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var calendar = scope.ServiceProvider.GetRequiredService<IWorkingCalendar>();

        // We use an explicit transaction for atomicity of (CreateWO + UpdatePlan)
        using var transaction = await db.Database.BeginTransactionAsync(ct);

        PmPlan? plan = null;
        bool created = false;
        string resultStatus = "Success";
        string? errorMsg = null;
        DateTimeOffset scheduledFor = DateTimeOffset.MinValue;
        Guid? woId = null;

        try
        {
            plan = await db.PmPlans
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.Id == planId, ct);

            if (plan == null) return false;

            scheduledFor = plan.NextDueAt;

            // Idempotency check
            var exists = await db.WorkOrders.AnyAsync(w => w.PmPlanId == plan.Id && w.ScheduledForUtc == scheduledFor, ct);
            
            if (!exists)
            {
                // Create WO
                var desc = (plan.Items == null || plan.Items.Count == 0)
                    ? null
                    : string.Join("\n", plan.Items.OrderBy(i => i.Sort).Select(i => "- " + i.Text));

                var wo = new WorkOrder
                {
                    Id = Guid.NewGuid(),
                    Title = $"PM: {plan.Name}",
                    Description = desc,
                    Type = WorkOrderType.Preventive,
                    Status = WorkOrderStatus.Open,
                    AssetId = plan.AssetId,
                    PmPlanId = plan.Id,
                    ScheduledForUtc = scheduledFor,
                    CreatedAt = DateTimeOffset.UtcNow
                };

                db.WorkOrders.Add(wo);
                await db.SaveChangesAsync(ct);
                woId = wo.Id;
                created = true;
            }
            else
            {
                resultStatus = "Skipped";
                errorMsg = "Already generated for this slot";
            }

            // Bump NextDueAt
            // Logic: 
            // 1. Convert current scheduled time (UTC) to Local
            // 2. Add Frequency (Month/Day/Week)
            // 3. Check if Working Day. Keep bumping until valid.
            // 4. Set 08:00 Local.
            // 5. Convert back to UTC.
            
            var localTime = TimeZoneInfo.ConvertTime(scheduledFor, RoTimeZone);
            var localDate = DateOnly.FromDateTime(localTime.DateTime);
            
            var candidateDate = plan.Frequency switch
            {
                PmFrequency.Daily => localDate.AddDays(1),
                PmFrequency.Weekly => localDate.AddDays(7),
                PmFrequency.Monthly => localDate.AddMonths(1),
                _ => localDate.AddMonths(1)
            };

            var nextWorkingDay = await calendar.GetNextWorkingDay(candidateDate);
            var nextDueLocal = nextWorkingDay.ToDateTime(new TimeOnly(8, 0, 0));
            var nextDueUtc = TimeZoneInfo.ConvertTimeToUtc(nextDueLocal, RoTimeZone);

            plan.NextDueAt = nextDueUtc;

            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            // Log Success (non-blocking)
            await LogExecution(planId, woId, scheduledFor, triggeredBy, resultStatus, errorMsg);

            return created;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(ct);
            errorMsg = ex.Message;
            await LogExecution(planId, null, scheduledFor, triggeredBy, "Error", errorMsg);
            throw; // rethrow to caller to count errors if needed
        }
    }

    private async Task LogExecution(Guid planId, Guid? woId, DateTimeOffset scheduledFor, string triggeredBy, string result, string? error)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var log = new PmPlanExecutionLog
            {
                Id = Guid.NewGuid(),
                PmPlanId = planId,
                WorkOrderId = woId,
                ScheduledForUtc = scheduledFor,
                GeneratedAtUtc = DateTimeOffset.UtcNow,
                TriggeredBy = triggeredBy,
                Result = result,
                Error = error?.Length > 500 ? error.Substring(0, 500) : error
            };

            db.PmPlanExecutionLogs.Add(log);
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write PM execution log");
        }
    }

    // Public method exposed for testing or other uses
    public async Task<DateTimeOffset> CalculateNextDue(DateTimeOffset currentDueUtc, PmFrequency frequency, IWorkingCalendar calendar)
    {
        var localTime = TimeZoneInfo.ConvertTime(currentDueUtc, RoTimeZone);
        var localDate = DateOnly.FromDateTime(localTime.DateTime);
            
        var candidateDate = frequency switch
        {
            PmFrequency.Daily => localDate.AddDays(1),
            PmFrequency.Weekly => localDate.AddDays(7),
            PmFrequency.Monthly => localDate.AddMonths(1),
            _ => localDate.AddMonths(1)
        };

        var nextWorkingDay = await calendar.GetNextWorkingDay(candidateDate);
        var nextDueLocal = nextWorkingDay.ToDateTime(new TimeOnly(8, 0, 0));
        return TimeZoneInfo.ConvertTimeToUtc(nextDueLocal, RoTimeZone);
    }
}

