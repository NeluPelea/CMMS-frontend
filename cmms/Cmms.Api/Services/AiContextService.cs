using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Services;

// Compact context DTOs (read-only)
public record AssetWorkOrderSummary(
    string Id,
    string Title,
    string Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    int? DurationMinutes
);

public record AssetPartUsage(
    string PartName,
    decimal? TotalQtyUsed
);

public record LowStockPartInfo(
    string PartName,
    decimal? OnHand,
    decimal? MinQty
);

public class AiContextService
{
    private readonly AppDbContext _db;

    public AiContextService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<AssetWorkOrderSummary>> GetAssetRecentWorkOrders(string assetId, int limit = 20)
    {
        if (!Guid.TryParse(assetId, out var assetGuid))
            return new List<AssetWorkOrderSummary>();

        var wos = await _db.WorkOrders
            .AsNoTracking()
            .Where(x => x.AssetId == assetGuid)
            .OrderByDescending(x => x.CreatedAt)
            .Take(limit)
            .Select(x => new AssetWorkOrderSummary(
                x.Id.ToString(),
                x.Title.Length > 100 ? x.Title.Substring(0, 100) : x.Title,
                x.Status.ToString(),
                x.StartAt,
                x.StopAt,
                x.DurationMinutes
            ))
            .ToListAsync();

        return wos;
    }

    public async Task<List<AssetPartUsage>> GetAssetTopPartsUsed(string assetId, int days = 90, int limit = 10)
    {
        if (!Guid.TryParse(assetId, out var assetGuid))
            return new List<AssetPartUsage>();

        var cutoffDate = DateTimeOffset.UtcNow.AddDays(-days);

        var parts = await _db.WorkOrderParts
            .AsNoTracking()
            .Where(x => x.WorkOrder!.AssetId == assetGuid && x.WorkOrder.CreatedAt >= cutoffDate)
            .GroupBy(x => x.Part!.Name)
            .Select(g => new AssetPartUsage(
                g.Key,
                g.Sum(x => x.QtyUsed)
            ))
            .OrderByDescending(x => x.TotalQtyUsed)
            .Take(limit)
            .ToListAsync();

        return parts;
    }

    public async Task<List<LowStockPartInfo>> GetLowStockPartsForAsset(string assetId)
    {
        if (!Guid.TryParse(assetId, out var assetGuid))
            return new List<LowStockPartInfo>();

        // Get parts associated with this asset's WOs that are low in stock
        var assetPartIds = await _db.WorkOrderParts
            .AsNoTracking()
            .Where(x => x.WorkOrder!.AssetId == assetGuid)
            .Select(x => x.PartId)
            .Distinct()
            .ToListAsync();

        if (!assetPartIds.Any())
            return new List<LowStockPartInfo>();

        var lowStock = await _db.Inventory
            .AsNoTracking()
            .Where(x => assetPartIds.Contains(x.PartId) && x.QtyOnHand <= x.MinQty)
            .Select(x => new LowStockPartInfo(
                x.Part!.Name,
                x.QtyOnHand,
                x.MinQty
            ))
            .OrderBy(x => x.OnHand)
            .Take(10)
            .ToListAsync();

        return lowStock;
    }
}
