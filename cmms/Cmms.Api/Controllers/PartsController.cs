using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/parts")]
[Authorize]
public sealed class PartsController : ControllerBase
{
    private readonly AppDbContext _db;
    public PartsController(AppDbContext db) => _db = db;

    public sealed record PartDto(
        Guid Id,
        string Name,
        string? Code,
        string? Uom,
        bool IsAct,
        bool HasStock,
        bool HasConsumption,
        decimal? PurchasePrice,
        string PurchaseCurrency,
        decimal MinQty
    );

    public sealed record CreateReq(
        string? Name,
        string? Code,
        string? Uom,
        decimal? PurchasePrice,
        string? PurchaseCurrency,
        decimal? MinQty
    );

    public sealed record UpdateReq(
        decimal? MinQty
    );

    [HttpGet]
    [Authorize(Policy = "Perm:PART_READ")]
    public async Task<IActionResult> List(
        [FromQuery] string? q = null,
        [FromQuery] int take = 200,
        [FromQuery] bool ia = false)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var qry = _db.Parts.AsNoTracking().AsQueryable();

        if (!ia)
            qry = qry.Where(x => x.IsAct);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            qry = qry.Where(x =>
                EF.Functions.ILike(x.Name, $"%{s}%") ||
                (x.Code != null && EF.Functions.ILike(x.Code, $"%{s}%"))
            );
        }

        var items = await qry
            .OrderBy(x => x.Name)
            .Take(take)
            .Select(x => new PartDto(
                x.Id,
                x.Name,
                x.Code,
                x.Uom,
                x.IsAct,
                _db.Inventory.Where(i => i.PartId == x.Id).Sum(i => i.QtyOnHand) > 0,
                _db.WorkOrderParts.Any(wp => wp.PartId == x.Id),
                x.PurchasePrice,
                x.PurchaseCurrency,
                x.MinQty))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    [Authorize(Policy = "Perm:PART_CREATE")]
    public async Task<IActionResult> Create([FromBody] CreateReq req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2)
            return BadRequest("name too short");

        decimal? price = null;
        if (req.PurchasePrice.HasValue)
        {
            if (req.PurchasePrice.Value < 0) return BadRequest("Price cannot be negative");
            price = Math.Round(req.PurchasePrice.Value, 2);
        }

        decimal minQty = 0;
        if (req.MinQty.HasValue)
        {
            if (req.MinQty.Value < 0) return BadRequest("MinQty cannot be negative");
            minQty = Math.Round(req.MinQty.Value, 2);
        }

        var part = new Part
        {
            Name = name,
            Code = string.IsNullOrWhiteSpace(req.Code) ? null : req.Code.Trim(),
            Uom = string.IsNullOrWhiteSpace(req.Uom) ? null : req.Uom.Trim(),
            IsAct = true,
            PurchasePrice = price,
            PurchaseCurrency = string.IsNullOrWhiteSpace(req.PurchaseCurrency) ? "RON" : req.PurchaseCurrency.Trim().ToUpper(),
            MinQty = minQty
        };

        _db.Parts.Add(part);

        _db.Inventory.Add(new InventoryItem
        {
            PartId = part.Id,
            QtyOnHand = 0m,
            MinQty = null
        });

        await _db.SaveChangesAsync();

        return Ok(new PartDto(
            part.Id,
            part.Name,
            part.Code,
            part.Uom,
            part.IsAct,
            false,
            false,
            part.PurchasePrice,
            part.PurchaseCurrency,
            part.MinQty));
    }

    [HttpPut("{id}")]
    [Authorize(Policy = "Perm:PART_CREATE")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReq req)
    {
        var part = await _db.Parts.FindAsync(id);
        if (part == null) return NotFound();

        if (req.MinQty.HasValue)
        {
             if (req.MinQty.Value < 0) return BadRequest("MinQty cannot be negative");
             part.MinQty = Math.Round(req.MinQty.Value, 2);
        }

        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPut("{id}/status")]
    // Allowed for everyone who can create parts or specific permission
    [Authorize(Policy = "Perm:PART_CREATE")] 
    public async Task<IActionResult> ToggleStatus(Guid id, [FromBody] bool isActive)
    {
        var part = await _db.Parts.FindAsync(id);
        if (part == null) return NotFound();

        // Protect deactivation
        if (!isActive && part.IsAct)
        {
            var hasStock = await _db.Inventory
                .Where(i => i.PartId == id)
                .SumAsync(i => i.QtyOnHand) > 0;
            
            if (hasStock)
                return Conflict("Nu poti inactiva piesa: exista stoc.");

            var hasCons = await _db.WorkOrderParts
                .AnyAsync(wp => wp.PartId == id);

            if (hasCons)
                return Conflict("Nu poti inactiva piesa: exista consum in istoric.");
        }

        part.IsAct = isActive;
        await _db.SaveChangesAsync();
        return Ok();
    }
}
