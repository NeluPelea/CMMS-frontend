using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Cmms.Domain;

public enum NcOrderStatus
{
    Draft,
    Sent,
    Confirmed,
    PartiallyReceived,
    Received,
    Cancelled
}

// Supplier class moved to Supplier.cs

public sealed class NcOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required, MaxLength(50)]
    public string NcNumber { get; set; } = ""; // Unique number
    
    public NcOrderStatus Status { get; set; } = NcOrderStatus.Draft;
    
    public Guid SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    
    [Required, MaxLength(10)]
    public string Currency { get; set; } = "RON";
    
    public DateTime OrderDate { get; set; } = DateTime.UtcNow;
    public DateTime? NeededByDate { get; set; }
    
    public int Priority { get; set; } = 1; // 1=Normal, 2=High, 3=Urgent
    
    public string? Notes { get; set; }
    
    public Guid? DeliveryLocationId { get; set; }
    public Location? DeliveryLocation { get; set; }
    
    public string? DeliveryAddressOverride { get; set; }
    
    public Guid? ReceiverPersonId { get; set; }
    public Person? ReceiverPerson { get; set; }
    
    public string? ReceiverPhone { get; set; }
    
    public Guid? WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }
    
    public Guid? AssetId { get; set; }
    public Asset? Asset { get; set; }
    
    public string? Reason { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal Subtotal { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal VatPercent { get; set; } = 19;
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal VatAmount { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal Total { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<NcOrderLine> Lines { get; set; } = new List<NcOrderLine>();
    public ICollection<NcOrderAttachment> Attachments { get; set; } = new List<NcOrderAttachment>();
}

public sealed class NcOrderLine
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid NcOrderId { get; set; }
    public NcOrder? NcOrder { get; set; }
    
    public Guid? PartId { get; set; }
    public Part? Part { get; set; }
    
    // Link to supplier catalog (if exists)
    public Guid? SupplierPartId { get; set; }
    public SupplierPart? SupplierPart { get; set; }
    
    public string? PartNameManual { get; set; } // If not linked to a Part entity
    
    // Snapshot of supplier SKU at order time
    [MaxLength(100)]
    public string? SupplierSku { get; set; }
    
    [Required, MaxLength(20)]
    public string Uom { get; set; } = "";
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal Qty { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal UnitPrice { get; set; }
    
    // Snapshot of currency at order time (can differ from NC header)
    [MaxLength(10)]
    public string? Currency { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal DiscountPercent { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal LineTotal { get; set; }
    
    public int? LeadTimeDays { get; set; }
    public string? Notes { get; set; }
    public int SortOrder { get; set; }
}

public sealed class NcOrderAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid NcOrderId { get; set; }
    public NcOrder? NcOrder { get; set; }
    
    [Required, MaxLength(255)]
    public string FileName { get; set; } = "";
    
    [MaxLength(100)]
    public string ContentType { get; set; } = "";
    
    [Required, MaxLength(500)]
    public string StorageKey { get; set; } = ""; // Path in storage
    
    public Guid UploadedByUserId { get; set; }
    public User? UploadedByUser { get; set; }
    
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
