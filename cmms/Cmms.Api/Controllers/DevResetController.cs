using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/dev")]
public sealed class DevResetController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public DevResetController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    public sealed record ResetReq(string confirm);

    [HttpPost("reset-parts")]
    [Authorize(Policy = "Perm:SECURITY_USERS_READ")] // R0-equivalent policy
    public async Task<IActionResult> ResetParts([FromBody] ResetReq req)
    {
        if (!_env.IsDevelopment())
            return BadRequest("This endpoint is available in Development environment only.");

        if (req.confirm != "RESET_PARTS")
            return BadRequest("Invalid confirmation code.");

        using var tx = await _db.Database.BeginTransactionAsync();

        try
        {
            // 1. Check for references in WorkOrders (BLOCKING)
            // WorkOrderParts (Strict restrict)
            if (await _db.WorkOrderParts.AnyAsync())
            {
                return Conflict("Cannot reset parts: References exist in WorkOrders (WorkOrderParts).");
            }

            // NC Orders (SetNull usually, but prompt asked to BLOCK if references exist)
            if (await _db.NcOrderLines.AnyAsync(x => x.PartId != null))
            {
                return Conflict("Cannot reset parts: References exist in NC Orders (NcOrderLines).");
            }

            // 2. Clear dependencies
            // Inventory (Cascade) but deleting explicitly as requested
            var inventory = await _db.Inventory.ToListAsync();
            _db.Inventory.RemoveRange(inventory);

            // SupplierParts (Cascade)
            var supplierParts = await _db.SupplierParts.ToListAsync();
            _db.SupplierParts.RemoveRange(supplierParts);

            // AssetParts (Cascade) - cleaning up just in case
            var assetParts = await _db.AssetParts.ToListAsync();
            _db.AssetParts.RemoveRange(assetParts);

            // 3. Clear Parts
            var parts = await _db.Parts.ToListAsync();
            _db.Parts.RemoveRange(parts);

            await _db.SaveChangesAsync();

            // 4. Seed 100 Parts
            var newParts = new List<Part>();
            var newInventory = new List<InventoryItem>();
            var rng = new Random(12345); // Seed for reproducibility

            for (int i = 1; i <= 100; i++)
            {
                var sku = $"SKU-{i:D4}"; // SKU-0001
                var name = $"Part {i} Description (Generic)"; // Realistic numeric name

                var p = new Part
                {
                    Id = Guid.NewGuid(),
                    Name = name,
                    Code = sku, // Mapping SKU to Code as per model limitation
                    Uom = "buc",
                    IsAct = true
                };
                newParts.Add(p);

                // 5. Seed Inventory
                var qty = rng.Next(10, 501); // 10..500
                var inv = new InventoryItem
                {
                    Id = Guid.NewGuid(),
                    PartId = p.Id,
                    QtyOnHand = (decimal)qty, // Model uses decimal
                    MinQty = 5
                };
                newInventory.Add(inv);
            }

            _db.Parts.AddRange(newParts);
            _db.Inventory.AddRange(newInventory);

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(new
            {
                message = "Parts reset and seeded successfully.",
                deletedParts = parts.Count,
                createdParts = newParts.Count,
                stockMin = 10,
                stockMax = 500,
                note = "Used 'Code' field for SKU. 'Part model' does not have a separate 'Code' field distinguishable from SKU."
            });
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            return StatusCode(500, $"Error resetting parts: {ex.Message}");
        }
    }
}
