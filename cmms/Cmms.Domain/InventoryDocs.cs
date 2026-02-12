using System;
using System.Collections.Generic;

namespace Cmms.Domain;

public sealed class GoodsReceipt
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateOnly ReceiptDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);

    public Guid? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    public string DocNo { get; set; } = "";
    public string Currency { get; set; } = "RON";

    public decimal FxRonEur { get; set; } = 1m;
    public decimal FxRonUsd { get; set; } = 1m;

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? CreatedBy { get; set; }

    public ICollection<GoodsReceiptLine> Lines { get; set; } = new List<GoodsReceiptLine>();
}

public sealed class GoodsReceiptLine
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid GoodsReceiptId { get; set; }
    public GoodsReceipt? GoodsReceipt { get; set; }

    public Guid PartId { get; set; }
    public Part? Part { get; set; }

    public decimal Qty { get; set; }
    public decimal UnitPrice { get; set; }
    public string Currency { get; set; } = "RON";
    public decimal LineTotal { get; set; }

    public string? Notes { get; set; }
}

public sealed class StockMovement
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PartId { get; set; }
    public Part? Part { get; set; }

    public decimal QtyDelta { get; set; }
    
    // "IN", "OUT", "ADJ"
    public string Type { get; set; } = "IN"; 
    
    // "GoodsReceipt", "WorkOrder", "Adjustment", "Initial"
    public string RefType { get; set; } = "";
    public Guid? RefId { get; set; }

    public decimal? UnitPrice { get; set; }
    public string? Currency { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? CreatedBy { get; set; }
}
