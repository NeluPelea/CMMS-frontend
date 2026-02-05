using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/work-orders/{workOrderId:guid}/parts")]
[Authorize]
public sealed class WorkOrderPartsController : ControllerBase
{
    private readonly AppDbContext _db;
    public WorkOrderPartsController(AppDbContext db) => _db = db;

    public sealed record WoPartDto(
        Guid Id,
        Guid WorkOrderId,
        Guid PartId,
        string PartName,
        string? PartCode,
        string? Uom,
        decimal QtyUsed
    );

    public sealed record AddReq(Guid PartId, decimal QtyUsed);
    public sealed record SetQtyReq(decimal QtyUsed);

    // GET /api/work-orders/{workOrderId}/parts
    [HttpGet]
    public async Task<IActionResult> List(Guid workOrderId)
    {
        var ok = await _db.WorkOrders.AsNoTracking().AnyAsync(x => x.Id == workOrderId);
        if (!ok) return NotFound("work order not found");

        var items = await _db.WorkOrderParts.AsNoTracking()
            .Where(x => x.WorkOrderId == workOrderId)
            .Join(_db.Parts.AsNoTracking(),
                wop => wop.PartId,
                p => p.Id,
                (wop, p) => new WoPartDto(
                    wop.Id,
                    wop.WorkOrderId,
                    wop.PartId,
                    p.Name,
                    p.Code,
                    p.Uom,
                    wop.QtyUsed
                ))
            .OrderBy(x => x.PartName)
            .ToListAsync();

        return Ok(items);
    }

    // POST /api/work-orders/{workOrderId}/parts
    // Adauga consum si scade inventar GLOBAL (fara locatie).
    [HttpPost]
    public async Task<IActionResult> Add(Guid workOrderId, [FromBody] AddReq req)
    {
        if (req.PartId == Guid.Empty) return BadRequest("PartId required");
        if (req.QtyUsed <= 0m) return BadRequest("QtyUsed must be > 0");

        await using var tx = await _db.Database.BeginTransactionAsync();

        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == workOrderId);
        if (wo == null) return NotFound("work order not found");

        var partOk = await _db.Parts.AsNoTracking()
            .AnyAsync(x => x.Id == req.PartId && x.IsAct);
        if (!partOk) return BadRequest("bad partId");

        // inventory GLOBAL: gasim rand pe PartId; daca nu exista, il cream
        var inv = await _db.Inventory.FirstOrDefaultAsync(x => x.PartId == req.PartId);
        if (inv == null)
        {
            inv = new InventoryItem
            {
                PartId = req.PartId,
                QtyOnHand = 0m,
                MinQty = null
            };
            _db.Inventory.Add(inv);
            await _db.SaveChangesAsync();
        }

        if (inv.QtyOnHand < req.QtyUsed)
            return BadRequest($"insufficient stock. onHand={inv.QtyOnHand}");

        // upsert: daca exista deja rand pentru (WO, Part), adunam
        var row = await _db.WorkOrderParts
            .FirstOrDefaultAsync(x => x.WorkOrderId == workOrderId && x.PartId == req.PartId);

        if (row == null)
        {
            row = new WorkOrderPart
            {
                WorkOrderId = workOrderId,
                PartId = req.PartId,
                QtyUsed = req.QtyUsed
            };
            _db.WorkOrderParts.Add(row);
        }
        else
        {
            row.QtyUsed += req.QtyUsed;
        }

        inv.QtyOnHand -= req.QtyUsed;

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return NoContent();
    }

    // DELETE /api/work-orders/{workOrderId}/parts/{id}
    // Sterge consum si returneaza cantitatea in inventar GLOBAL.
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid workOrderId, Guid id)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var row = await _db.WorkOrderParts
            .FirstOrDefaultAsync(x => x.Id == id && x.WorkOrderId == workOrderId);
        if (row == null) return NotFound();

        var inv = await _db.Inventory.FirstOrDefaultAsync(x => x.PartId == row.PartId);
        if (inv == null)
        {
            inv = new InventoryItem
            {
                PartId = row.PartId,
                QtyOnHand = 0m,
                MinQty = null
            };
            _db.Inventory.Add(inv);
            await _db.SaveChangesAsync();
        }

        inv.QtyOnHand += row.QtyUsed;

        _db.WorkOrderParts.Remove(row);

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return NoContent();
    }

    // POST /api/work-orders/{workOrderId}/parts/{id}/set-qty
    // Ajusteaza QtyUsed; diferenta se scade/returneaza in inventar GLOBAL.
    [HttpPost("{id:guid}/set-qty")]
    public async Task<IActionResult> SetQty(Guid workOrderId, Guid id, [FromBody] SetQtyReq req)
    {
        if (req.QtyUsed < 0m) return BadRequest("QtyUsed must be >= 0");

        await using var tx = await _db.Database.BeginTransactionAsync();

        var row = await _db.WorkOrderParts
            .FirstOrDefaultAsync(x => x.Id == id && x.WorkOrderId == workOrderId);
        if (row == null) return NotFound();

        var inv = await _db.Inventory.FirstOrDefaultAsync(x => x.PartId == row.PartId);
        if (inv == null)
        {
            inv = new InventoryItem
            {
                PartId = row.PartId,
                QtyOnHand = 0m,
                MinQty = null
            };
            _db.Inventory.Add(inv);
            await _db.SaveChangesAsync();
        }

        var oldQty = row.QtyUsed;
        var newQty = req.QtyUsed;
        var delta = newQty - oldQty; // + consuma, - returneaza

        if (delta > 0m && inv.QtyOnHand < delta)
            return BadRequest($"insufficient stock. need={delta} onHand={inv.QtyOnHand}");

        row.QtyUsed = newQty;
        inv.QtyOnHand -= delta;

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return NoContent();
    }
}
