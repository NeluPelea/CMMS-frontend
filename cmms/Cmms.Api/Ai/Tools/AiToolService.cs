using System.Text.Json;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Ai.Tools;

/*
 * CMMS Copilot Tool Definitions
 * 
 * Schema scan findings:
 * - Assets: Asset (Id, Name, Code, LocationId)
 * - WorkOrders: WorkOrder (Id, Title, Status, Type, Classification, AssetId, StartAt, StopAt, DurationMinutes, Defect, Cause, Solution)
 * - Parts: Part (Id, Name, Code, Uom), Inventory (QtyOnHand, MinQty), WorkOrderPart (QtyUsed)
 * - People: Person (Id, DisplayName, FullName, JobTitle, IsActive), WorkOrderLabor, WorkOrderAssignment
 * - Relations: Asset->Location, WorkOrder->Asset, WorkOrder->Person, WorkOrderPart->Part
 * 
 * All tools are READ-ONLY (v1).
 */

// Tool parameter and result DTOs
public record FindAssetsParams(string Query, int? Limit = 20);
public record AssetMatch(string AssetId, string DisplayName, string? LocationName);
public record FindAssetsResult(List<AssetMatch> Matches, int TotalFound);

public record GetAssetDetailsParams(string AssetId);
public record AssetDetails(
    string AssetId,
    string DisplayName,
    string? Code,
    string? Location,
    string? LocationCode
);

public record GetMaintenanceHistoryParams(string AssetId, string FromUtc, string ToUtc, int? Limit = 20);
public record MaintenanceItem(
    string WoId,
    string? StartUtc,
    string? StopUtc,
    string Type,
    string Classification,
    string Status,
    string Summary,
    string? Defect,
    string? Cause,
    string? Solution,
    int? DowntimeMinutes,
    List<string> PeopleNames
);
public record GetMaintenanceHistoryResult(List<MaintenanceItem> Items, int Total);

public record GetTodayMaintenanceByAssetNameParams(string AssetName, string? Timezone = "Europe/Bucharest");
public record TodayMaintenanceResult(
    bool NeedClarification,
    string? Message,
    List<AssetMatch>? Options,
    List<MaintenanceItem>? Items
);

public record GetOpenWorkOrdersParams(string? Status = null, string? Priority = null, string? AssetId = null, int? Limit = 20);
public record OpenWorkOrderItem(
    string WoId,
    string? AssetName,
    string CreatedUtc,
    string? DueUtc,
    string Status,
    string Type,
    string Classification,
    string Summary
);
public record GetOpenWorkOrdersResult(List<OpenWorkOrderItem> Items, int Total);

public record GetOverdueWorkOrdersParams(string? NowUtc = null, int? Limit = 20);

public record GetPartStockParams(string PartQuery, int? Limit = 20);
public record PartStockMatch(string PartId, string PartName, decimal? StockQty, decimal? MinQty, string? Um, string? LocationName);
public record GetPartStockResult(List<PartStockMatch> Matches, int TotalFound);

public record GetLowStockPartsParams(int? Limit = 20);
public record LowStockPartItem(string PartId, string PartName, decimal? StockQty, decimal? MinQty, string? Um, decimal DeficitQty);
public record GetLowStockPartsResult(List<LowStockPartItem> Items, int Total);

public record GetPartsUsedForAssetParams(string AssetId, string FromUtc, string ToUtc, int? Limit = 20);
public record PartUsageItem(string PartName, string PartId, decimal QtyTotal, string? Um);
public record GetPartsUsedForAssetResult(List<PartUsageItem> Items, int Total);

public record GetAssetKpisParams(string AssetId, int Days = 90);
public record AssetKpisResult(
    double? MttrHours,
    double? MtbfHours,
    int FailuresCount,
    double? DowntimeHours,
    string? RepeatedFailureSignals
);

/// <summary>
/// Tool registry and handlers for CMMS Copilot
/// </summary>
public class AiToolService
{
    private readonly AppDbContext _db;
    private readonly ILogger<AiToolService> _logger;

    public AiToolService(AppDbContext db, ILogger<AiToolService> logger)
    {
        _db = db;
        _logger = logger;
    }

    // Tool definitions (Groq OpenAI-compatible format)
    public static List<object> GetToolDefinitions()
    {
        return new List<object>
        {
            new
            {
                type = "function",
                function = new
                {
                    name = "findAssets",
                    description = "Search for assets/equipment by name or code. Returns matching assets with their IDs and locations.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            query = new { type = "string", description = "Search query (asset name or code)" },
                            limit = new { type = "integer", description = "Maximum results to return (default 20)" }
                        },
                        required = new[] { "query" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "getAssetDetails",
                    description = "Get detailed information about a specific asset by ID.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            assetId = new { type = "string", description = "Asset GUID" }
                        },
                        required = new[] { "assetId" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "getMaintenanceHistory",
                    description = "Get maintenance/intervention history for an asset within a date range.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            assetId = new { type = "string", description = "Asset GUID" },
                            fromUtc = new { type = "string", description = "Start date (ISO 8601 UTC)" },
                            toUtc = new { type = "string", description = "End date (ISO 8601 UTC)" },
                            limit = new { type = "integer", description = "Maximum results (default 20)" }
                        },
                        required = new[] { "assetId", "fromUtc", "toUtc" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "getTodayMaintenanceByAssetName",
                    description = "Get today's maintenance for an asset by name. Handles asset name resolution automatically.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            assetName = new { type = "string", description = "Asset name to search" },
                            timezone = new { type = "string", description = "Timezone (default 'Europe/Bucharest')" }
                        },
                        required = new[] { "assetName" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "getOpenWorkOrders",
                    description = "Get open work orders, optionally filtered by status, asset, or other criteria.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            status = new { type = "string", description = "Filter by status (Open, InProgress, Done, Cancelled)" },
                            assetId = new { type = "string", description = "Filter by asset ID" },
                            limit = new { type = "integer", description = "Maximum results (default 20)" }
                        }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "getOverdueWorkOrders",
                    description = "Get work orders that are overdue (past due date and not completed).",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            nowUtc = new { type = "string", description = "Current time (ISO 8601 UTC, defaults to now)" },
                            limit = new { type = "integer", description = "Maximum results (default 20)" }
                        }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "getPartStock",
                    description = "Search for parts by name and get current stock levels.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            partQuery = new { type = "string", description = "Part name search query" },
                            limit = new { type = "integer", description = "Maximum results (default 20)" }
                        },
                        required = new[] { "partQuery" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "getLowStockParts",
                    description = "Get parts that are below minimum stock levels.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            limit = new { type = "integer", description = "Maximum results (default 20)" }
                        }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "getPartsUsedForAsset",
                    description = "Get parts consumed by an asset within a date range.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            assetId = new { type = "string", description = "Asset GUID" },
                            fromUtc = new { type = "string", description = "Start date (ISO 8601 UTC)" },
                            toUtc = new { type = "string", description = "End date (ISO 8601 UTC)" },
                            limit = new { type = "integer", description = "Maximum results (default 20)" }
                        },
                        required = new[] { "assetId", "fromUtc", "toUtc" }
                    }
                }
            },
            new
            {
                type = "function",
                function = new
                {
                    name = "getAssetKpis",
                    description = "Calculate maintenance KPIs for an asset (MTTR, MTBF, failure count, downtime). Computed deterministically in backend.",
                    parameters = new
                    {
                        type = "object",
                        properties = new
                        {
                            assetId = new { type = "string", description = "Asset GUID" },
                            days = new { type = "integer", description = "Number of days to analyze (default 90)" }
                        },
                        required = new[] { "assetId" }
                    }
                }
            }
        };
    }

    public async Task<object> ExecuteToolAsync(string toolName, string argumentsJson)
    {
        _logger.LogInformation("Executing tool: {ToolName}", toolName);

        try
        {
            return toolName switch
            {
                "findAssets" => await FindAssetsAsync(JsonSerializer.Deserialize<FindAssetsParams>(argumentsJson)!),
                "getAssetDetails" => await GetAssetDetailsAsync(JsonSerializer.Deserialize<GetAssetDetailsParams>(argumentsJson)!),
                "getMaintenanceHistory" => await GetMaintenanceHistoryAsync(JsonSerializer.Deserialize<GetMaintenanceHistoryParams>(argumentsJson)!),
                "getTodayMaintenanceByAssetName" => await GetTodayMaintenanceByAssetNameAsync(JsonSerializer.Deserialize<GetTodayMaintenanceByAssetNameParams>(argumentsJson)!),
                "getOpenWorkOrders" => await GetOpenWorkOrdersAsync(JsonSerializer.Deserialize<GetOpenWorkOrdersParams>(argumentsJson)!),
                "getOverdueWorkOrders" => await GetOverdueWorkOrdersAsync(JsonSerializer.Deserialize<GetOverdueWorkOrdersParams>(argumentsJson)!),
                "getPartStock" => await GetPartStockAsync(JsonSerializer.Deserialize<GetPartStockParams>(argumentsJson)!),
                "getLowStockParts" => await GetLowStockPartsAsync(JsonSerializer.Deserialize<GetLowStockPartsParams>(argumentsJson)!),
                "getPartsUsedForAsset" => await GetPartsUsedForAssetAsync(JsonSerializer.Deserialize<GetPartsUsedForAssetParams>(argumentsJson)!),
                "getAssetKpis" => await GetAssetKpisAsync(JsonSerializer.Deserialize<GetAssetKpisParams>(argumentsJson)!),
                _ => new { error = $"Unknown tool: {toolName}" }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tool execution failed: {ToolName}", toolName);
            return new { error = ex.Message };
        }
    }

    // Tool handler implementations
    private async Task<FindAssetsResult> FindAssetsAsync(FindAssetsParams p)
    {
        var limit = Math.Min(p.Limit ?? 20, 50);
        var query = p.Query.ToLower();

        var matches = await _db.Assets
            .AsNoTracking()
            .Where(a => a.IsAct && (a.Name.ToLower().Contains(query) || (a.Code != null && a.Code.ToLower().Contains(query))))
            .OrderBy(a => a.Name)
            .Take(limit)
            .Select(a => new AssetMatch(
                a.Id.ToString(),
                a.Name,
                a.Location != null ? a.Location.Name : null
            ))
            .ToListAsync();

        return new FindAssetsResult(matches, matches.Count);
    }

    private async Task<AssetDetails?> GetAssetDetailsAsync(GetAssetDetailsParams p)
    {
        if (!Guid.TryParse(p.AssetId, out var assetGuid))
            return null;

        var asset = await _db.Assets
            .AsNoTracking()
            .Where(a => a.Id == assetGuid)
            .Select(a => new AssetDetails(
                a.Id.ToString(),
                a.Name,
                a.Code,
                a.Location != null ? a.Location.Name : null,
                a.Location != null ? a.Location.Code : null
            ))
            .FirstOrDefaultAsync();

        return asset;
    }

    private async Task<GetMaintenanceHistoryResult> GetMaintenanceHistoryAsync(GetMaintenanceHistoryParams p)
    {
        if (!Guid.TryParse(p.AssetId, out var assetGuid))
            return new GetMaintenanceHistoryResult(new List<MaintenanceItem>(), 0);

        var from = DateTimeOffset.Parse(p.FromUtc);
        var to = DateTimeOffset.Parse(p.ToUtc);
        var limit = Math.Min(p.Limit ?? 20, 50);

        var items = await _db.WorkOrders
            .AsNoTracking()
            .Where(wo => wo.AssetId == assetGuid && wo.StartAt >= from && wo.StartAt <= to)
            .OrderByDescending(wo => wo.StartAt)
            .Take(limit)
            .Select(wo => new MaintenanceItem(
                wo.Id.ToString(),
                wo.StartAt.HasValue ? wo.StartAt.Value.ToString("o") : null,
                wo.StopAt.HasValue ? wo.StopAt.Value.ToString("o") : null,
                wo.Type.ToString(),
                wo.Classification.ToString(),
                wo.Status.ToString(),
                wo.Title.Length > 200 ? wo.Title.Substring(0, 200) : wo.Title,
                wo.Defect != null && wo.Defect.Length > 200 ? wo.Defect.Substring(0, 200) : wo.Defect,
                wo.Cause != null && wo.Cause.Length > 200 ? wo.Cause.Substring(0, 200) : wo.Cause,
                wo.Solution != null && wo.Solution.Length > 200 ? wo.Solution.Substring(0, 200) : wo.Solution,
                wo.DurationMinutes,
                wo.Assignments.Select(a => a.Person != null ? a.Person.DisplayName : "Unknown").ToList()
            ))
            .ToListAsync();

        return new GetMaintenanceHistoryResult(items, items.Count);
    }

    private async Task<TodayMaintenanceResult> GetTodayMaintenanceByAssetNameAsync(GetTodayMaintenanceByAssetNameParams p)
    {
        // Find asset
        var findResult = await FindAssetsAsync(new FindAssetsParams(p.AssetName, 5));

        if (findResult.Matches.Count == 0)
            return new TodayMaintenanceResult(true, $"No asset found matching '{p.AssetName}'", null, null);

        if (findResult.Matches.Count > 1)
            return new TodayMaintenanceResult(true, $"Multiple assets found. Please clarify which one:", findResult.Matches, null);

        // Get today's range in specified timezone
        var tz = TimeZoneInfo.FindSystemTimeZoneById(p.Timezone ?? "Europe/Bucharest");
        var nowInTz = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var todayStart = new DateTime(nowInTz.Year, nowInTz.Month, nowInTz.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var todayEnd = todayStart.AddDays(1);

        var fromUtc = TimeZoneInfo.ConvertTimeToUtc(todayStart, tz);
        var toUtc = TimeZoneInfo.ConvertTimeToUtc(todayEnd, tz);

        var history = await GetMaintenanceHistoryAsync(new GetMaintenanceHistoryParams(
            findResult.Matches[0].AssetId,
            fromUtc.ToString("o"),
            toUtc.ToString("o"),
            20
        ));

        return new TodayMaintenanceResult(false, null, null, history.Items);
    }

    private async Task<GetOpenWorkOrdersResult> GetOpenWorkOrdersAsync(GetOpenWorkOrdersParams p)
    {
        var limit = Math.Min(p.Limit ?? 20, 50);
        var query = _db.WorkOrders.AsNoTracking().Where(wo => wo.Status != Domain.WorkOrderStatus.Done && wo.Status != Domain.WorkOrderStatus.Cancelled);

        if (!string.IsNullOrEmpty(p.Status) && Enum.TryParse<Domain.WorkOrderStatus>(p.Status, out var status))
            query = query.Where(wo => wo.Status == status);

        if (!string.IsNullOrEmpty(p.AssetId) && Guid.TryParse(p.AssetId, out var assetGuid))
            query = query.Where(wo => wo.AssetId == assetGuid);

        var items = await query
            .OrderBy(wo => wo.CreatedAt)
            .Take(limit)
            .Select(wo => new OpenWorkOrderItem(
                wo.Id.ToString(),
                wo.Asset != null ? wo.Asset.Name : null,
                wo.CreatedAt.ToString("o"),
                wo.StartAt.HasValue ? wo.StartAt.Value.ToString("o") : null,
                wo.Status.ToString(),
                wo.Type.ToString(),
                wo.Classification.ToString(),
                wo.Title.Length > 200 ? wo.Title.Substring(0, 200) : wo.Title
            ))
            .ToListAsync();

        return new GetOpenWorkOrdersResult(items, items.Count);
    }

    private async Task<GetOpenWorkOrdersResult> GetOverdueWorkOrdersAsync(GetOverdueWorkOrdersParams p)
    {
        var now = string.IsNullOrEmpty(p.NowUtc) ? DateTimeOffset.UtcNow : DateTimeOffset.Parse(p.NowUtc);
        var limit = Math.Min(p.Limit ?? 20, 50);

        var items = await _db.WorkOrders
            .AsNoTracking()
            .Where(wo => wo.Status != Domain.WorkOrderStatus.Done
                      && wo.Status != Domain.WorkOrderStatus.Cancelled
                      && wo.StartAt.HasValue
                      && wo.StartAt.Value < now)
            .OrderBy(wo => wo.StartAt)
            .Take(limit)
            .Select(wo => new OpenWorkOrderItem(
                wo.Id.ToString(),
                wo.Asset != null ? wo.Asset.Name : null,
                wo.CreatedAt.ToString("o"),
                wo.StartAt.HasValue ? wo.StartAt.Value.ToString("o") : null,
                wo.Status.ToString(),
                wo.Type.ToString(),
                wo.Classification.ToString(),
                wo.Title.Length > 200 ? wo.Title.Substring(0, 200) : wo.Title
            ))
            .ToListAsync();

        return new GetOpenWorkOrdersResult(items, items.Count);
    }

    private async Task<GetPartStockResult> GetPartStockAsync(GetPartStockParams p)
    {
        var limit = Math.Min(p.Limit ?? 20, 50);
        var query = p.PartQuery.ToLower();

        var matches = await _db.Parts
            .AsNoTracking()
            .Where(part => part.Name.ToLower().Contains(query) || (part.Code != null && part.Code.ToLower().Contains(query)))
            .OrderBy(part => part.Name)
            .Take(limit)
            .Select(part => new
            {
                Part = part,
                Inventory = _db.Inventory.FirstOrDefault(inv => inv.PartId == part.Id)
            })
            .ToListAsync();

        var result = matches.Select(m => new PartStockMatch(
            m.Part.Id.ToString(),
            m.Part.Name,
            m.Inventory?.QtyOnHand,
            m.Inventory?.MinQty,
            m.Part.Uom,
            null // InventoryItem doesn't have Location property
        )).ToList();

        return new GetPartStockResult(result, result.Count);
    }

    private async Task<GetLowStockPartsResult> GetLowStockPartsAsync(GetLowStockPartsParams p)
    {
        var limit = Math.Min(p.Limit ?? 20, 50);

        var items = await _db.Inventory
            .AsNoTracking()
            .Where(inv => inv.MinQty.HasValue && inv.QtyOnHand <= inv.MinQty.Value)
            .OrderBy(inv => inv.QtyOnHand)
            .Take(limit)
            .Select(inv => new LowStockPartItem(
                inv.PartId.ToString(),
                inv.Part!.Name,
                inv.QtyOnHand,
                inv.MinQty,
                inv.Part.Uom,
                inv.MinQty!.Value - inv.QtyOnHand
            ))
            .ToListAsync();

        return new GetLowStockPartsResult(items, items.Count);
    }

    private async Task<GetPartsUsedForAssetResult> GetPartsUsedForAssetAsync(GetPartsUsedForAssetParams p)
    {
        if (!Guid.TryParse(p.AssetId, out var assetGuid))
            return new GetPartsUsedForAssetResult(new List<PartUsageItem>(), 0);

        var from = DateTimeOffset.Parse(p.FromUtc);
        var to = DateTimeOffset.Parse(p.ToUtc);
        var limit = Math.Min(p.Limit ?? 20, 50);

        var items = await _db.WorkOrderParts
            .AsNoTracking()
            .Where(wop => wop.WorkOrder!.AssetId == assetGuid
                       && wop.WorkOrder.StartAt >= from
                       && wop.WorkOrder.StartAt <= to)
            .GroupBy(wop => new { wop.PartId, wop.Part!.Name, wop.Part.Uom })
            .Select(g => new PartUsageItem(
                g.Key.Name,
                g.Key.PartId.ToString(),
                g.Sum(wop => wop.QtyUsed),
                g.Key.Uom
            ))
            .OrderByDescending(item => item.QtyTotal)
            .Take(limit)
            .ToListAsync();

        return new GetPartsUsedForAssetResult(items, items.Count);
    }

    private async Task<AssetKpisResult> GetAssetKpisAsync(GetAssetKpisParams p)
    {
        if (!Guid.TryParse(p.AssetId, out var assetGuid))
            return new AssetKpisResult(null, null, 0, null, "Invalid asset ID");

        var cutoff = DateTimeOffset.UtcNow.AddDays(-p.Days);

        var failures = await _db.WorkOrders
            .AsNoTracking()
            .Where(wo => wo.AssetId == assetGuid
                      && wo.Classification == Domain.WorkOrderClassification.Reactive
                      && wo.Status == Domain.WorkOrderStatus.Done
                      && wo.CreatedAt >= cutoff)
            .OrderBy(wo => wo.CreatedAt)
            .Select(wo => new {
                wo.CreatedAt,
                wo.DurationMinutes,
                wo.Defect,
                wo.Cause
            })
            .ToListAsync();

        if (failures.Count == 0)
            return new AssetKpisResult(null, null, 0, 0, "No reactive failures in period");

        // MTTR (Mean Time To Repair)
        var totalRepairMinutes = failures.Where(f => f.DurationMinutes.HasValue).Sum(f => f.DurationMinutes!.Value);
        var repairCount = failures.Count(f => f.DurationMinutes.HasValue);
        var mttrHours = repairCount > 0 ? totalRepairMinutes / 60.0 / repairCount : (double?)null;

        // MTBF (Mean Time Between Failures)
        double? mtbfHours = null;
        if (failures.Count > 1)
        {
            var intervals = new List<double>();
            for (int i = 1; i < failures.Count; i++)
            {
                var diff = (failures[i].CreatedAt - failures[i - 1].CreatedAt).TotalHours;
                intervals.Add(diff);
            }
            mtbfHours = intervals.Average();
        }

        // Total downtime
        var downtimeHours = totalRepairMinutes / 60.0;

        // Detect repeated failures (simple heuristic: look for common words in defect/cause)
        var defectWords = failures
            .Where(f => !string.IsNullOrEmpty(f.Defect))
            .SelectMany(f => f.Defect!.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .Where(w => w.Length > 4)
            .GroupBy(w => w)
            .Where(g => g.Count() > 1)
            .OrderByDescending(g => g.Count())
            .Take(3)
            .Select(g => $"{g.Key}({g.Count()})")
            .ToList();

        var repeatedSignal = defectWords.Any()
            ? $"Possible repeated issues: {string.Join(", ", defectWords)}"
            : null;

        return new AssetKpisResult(mttrHours, mtbfHours, failures.Count, downtimeHours, repeatedSignal);
    }
}
