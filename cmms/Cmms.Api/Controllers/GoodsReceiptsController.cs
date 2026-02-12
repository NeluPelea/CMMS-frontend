using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

public class CreateGoodsReceiptDto
{
    public DateOnly ReceiptDate { get; set; }
    public Guid? SupplierId { get; set; }
    public string DocNo { get; set; } = "";
    public string Currency { get; set; } = "RON";
    public decimal FxRonEur { get; set; } = 1;
    public decimal FxRonUsd { get; set; } = 1;
    public string? Notes { get; set; }
    public List<CreateGoodsReceiptLineDto> Lines { get; set; } = new();
}

public class CreateGoodsReceiptLineDto
{
    public Guid PartId { get; set; }
    public decimal Qty { get; set; }
    public decimal UnitPrice { get; set; }
}

[ApiController]
[Route("api/goods-receipts")]
public class GoodsReceiptsController : ControllerBase
{
    private readonly AppDbContext _db;

    public GoodsReceiptsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int take = 50, [FromQuery] int skip = 0)
    {
        var query = _db.GoodsReceipts
            .AsNoTracking()
            .OrderByDescending(x => x.ReceiptDate)
            .ThenByDescending(x => x.CreatedAt);

        var total = await query.CountAsync();
        
        var items = await query
            .Skip(skip)
            .Take(take)
            .Select(x => new
            {
                x.Id,
                x.DocNo,
                x.ReceiptDate,
                SupplierName = x.Supplier == null ? null : x.Supplier.Name,
                x.Currency,
                TotalAmount = x.Lines.Sum(l => l.LineTotal),
                x.Notes
            })
            .ToListAsync();

        return Ok(new { total, items });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var item = await _db.GoodsReceipts
            .AsNoTracking()
            .Select(x => new
            {
                x.Id,
                x.ReceiptDate,
                Supplier = x.Supplier == null ? null : new { x.Supplier.Id, x.Supplier.Name },
                x.DocNo,
                x.Currency,
                x.FxRonEur,
                x.FxRonUsd,
                x.Notes,
                x.CreatedAt,
                x.CreatedBy,
                Lines = x.Lines.Select(l => new
                {
                    l.Id,
                    l.PartId,
                    PartName = l.Part.Name,
                    PartCode = l.Part.Code,
                    Uom = l.Part.Uom,
                    l.Qty,
                    l.UnitPrice,
                    l.Currency,
                    l.LineTotal
                })
            })
            .FirstOrDefaultAsync(x => x.Id == id);

        if (item == null) return NotFound();

        return Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGoodsReceiptDto dto)
    {
        if (dto.Lines == null || dto.Lines.Count == 0)
            return BadRequest("Receptia trebuie sa contina cel putin o linie.");

        // Transaction
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var receipt = new GoodsReceipt
            {
                Id = Guid.NewGuid(),
                ReceiptDate = dto.ReceiptDate,
                SupplierId = dto.SupplierId,
                DocNo = dto.DocNo,
                Currency = dto.Currency,
                FxRonEur = dto.FxRonEur,
                FxRonUsd = dto.FxRonUsd,
                Notes = dto.Notes,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "System"
            };
            
            _db.GoodsReceipts.Add(receipt); // Add parent first to context

            foreach (var lineDto in dto.Lines)
            {
                if (lineDto.Qty <= 0) throw new Exception($"Cantitate invalida pentru piesa {lineDto.PartId}");
                
                var part = await _db.Parts.FindAsync(lineDto.PartId);
                if (part == null) throw new Exception($"Piesa {lineDto.PartId} nu exista.");

                var lineTotal = lineDto.Qty * lineDto.UnitPrice;
                
                var line = new GoodsReceiptLine
                {
                    Id = Guid.NewGuid(),
                    GoodsReceiptId = receipt.Id,
                    PartId = lineDto.PartId,
                    Qty = lineDto.Qty,
                    UnitPrice = lineDto.UnitPrice,
                    Currency = dto.Currency,
                    LineTotal = lineTotal
                };
                
                _db.GoodsReceiptLines.Add(line);

                // 1. Update Inventory
                var invItem = await _db.Inventory.FirstOrDefaultAsync(x => x.PartId == lineDto.PartId);
                if (invItem == null)
                {
                    invItem = new InventoryItem
                    {
                        Id = Guid.NewGuid(),
                        PartId = lineDto.PartId,
                        QtyOnHand = 0,
                        MinQty = part.MinQty
                    };
                    _db.Inventory.Add(invItem);
                }
                invItem.QtyOnHand += lineDto.Qty;

                // 2. Update Part Last Price
                part.PurchasePrice = lineDto.UnitPrice;
                part.PurchaseCurrency = dto.Currency;
                // Don't change UOM

                // 3. Stock Movement
                var movement = new StockMovement
                {
                    Id = Guid.NewGuid(),
                    PartId = lineDto.PartId,
                    QtyDelta = lineDto.Qty, // IN is positive
                    Type = "IN",
                    RefType = "GoodsReceipt",
                    RefId = receipt.Id,
                    UnitPrice = lineDto.UnitPrice,
                    Currency = dto.Currency,
                    CreatedAt = DateTimeOffset.UtcNow,
                    CreatedBy = "System"
                };
                _db.StockMovements.Add(movement);
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { id = receipt.Id });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { message = ex.Message });
        }
    }
}
