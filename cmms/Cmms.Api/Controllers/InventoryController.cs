using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/inventory")]
[Authorize]
public sealed class InventoryController : ControllerBase
{
    private readonly AppDbContext _db;
    public InventoryController(AppDbContext db) => _db = db;

    [HttpGet]
    [Authorize(Policy = "Perm:INV_READ")]
    public async Task<IActionResult> List([FromQuery] string? q = null, [FromQuery] int take = 200)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var qry = _db.Inventory.AsNoTracking()
            .Include(x => x.Part)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            qry = qry.Where(x =>
                x.Part != null &&
                (EF.Functions.ILike(x.Part.Name, $"%{s}%") ||
                 (x.Part.Code != null && EF.Functions.ILike(x.Part.Code, $"%{s}%")))
            );
        }

        // 1) Fetch FX rates
        var rates = await _db.AppSettings
            .Where(x => x.Key == "FX_RON_EUR" || x.Key == "FX_RON_USD")
            .ToDictionaryAsync(x => x.Key, x => x.Value);

        decimal fxEur = 4.95m; // fallback
        decimal fxUsd = 4.60m; // fallback

        if (rates.TryGetValue("FX_RON_EUR", out var sEur) && decimal.TryParse(sEur, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var vEur))
            fxEur = vEur;
        if (rates.TryGetValue("FX_RON_USD", out var sUsd) && decimal.TryParse(sUsd, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var vUsd))
            fxUsd = vUsd;
            
        var dbItems = await qry
            .OrderBy(x => x.Part!.Name)
            .Take(take)
            .Select(x => new
            {
                id = x.Id,
                partId = x.PartId,
                partName = x.Part != null ? x.Part.Name : "",
                partCode = x.Part != null ? x.Part.Code : null,
                skuCode = x.Part != null ? x.Part.Code : null, 
                uom = x.Part != null ? x.Part.Uom : null,
                qtyOnHand = x.QtyOnHand,
                minQty = x.Part != null ? x.Part.MinQty : 0m,
                purchasePrice = x.Part != null ? x.Part.PurchasePrice : null,
                purchaseCurrency = x.Part != null ? x.Part.PurchaseCurrency : "RON"
            })
            .ToListAsync();

        // 2) Compute values in memory (simplified)
        var result = dbItems.Select(x =>
        {
            decimal price = x.purchasePrice ?? 0m;
            string curr = (x.purchaseCurrency ?? "RON").ToUpper();
            
            decimal ronPrice = price;
            if (curr == "EUR") ronPrice = price * fxEur;
            else if (curr == "USD") ronPrice = price * fxUsd;
            // else RON or unknown => 1:1

            // Round to 2 decimals
            ronPrice = Math.Round(ronPrice, 2);
            decimal valRon = Math.Round(x.qtyOnHand * ronPrice, 2);

            return new
            {
                x.id,
                x.partId,
                x.partName,
                x.partCode,
                x.skuCode,
                x.uom,
                x.qtyOnHand,
                x.minQty,
                x.purchasePrice,
                x.purchaseCurrency,
                unitPriceRon = ronPrice,
                valueRon = valRon
            };
        });

        return Ok(result);
    }

    public sealed record AdjustReq(decimal Delta);

    [HttpPost("{id:guid}/adjust")]
    [Authorize(Policy = "Perm:INV_ADJUST")]
    public async Task<IActionResult> Adjust(Guid id, [FromBody] AdjustReq req)
    {
        var it = await _db.Inventory.FirstOrDefaultAsync(x => x.Id == id);
        if (it == null) return NotFound();

        it.QtyOnHand += req.Delta;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
