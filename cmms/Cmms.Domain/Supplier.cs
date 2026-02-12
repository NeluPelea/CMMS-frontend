using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Cmms.Domain;

public sealed class Supplier
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required, MaxLength(200)]
    public string Name { get; set; } = "";
    
    [MaxLength(50)]
    public string? Code { get; set; }
    
    public bool IsActive { get; set; } = true;
    public bool IsPreferred { get; set; }
    
    public string? WebsiteUrl { get; set; }
    
    public string? TaxId { get; set; } // CUI/VAT
    public string? RegCom { get; set; }
    
    public string? AddressLine1 { get; set; }
    public string? City { get; set; }
    public string? County { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
    
    public int? PaymentTermsDays { get; set; }
    public string? Currency { get; set; } // Default currency (RON/EUR/USD)
    
    public string? Iban { get; set; }
    public string? BankName { get; set; }
    
    public string? Notes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Relatii
    public ICollection<SupplierContact> Contacts { get; set; } = new List<SupplierContact>();
    public ICollection<SupplierPart> SupplierParts { get; set; } = new List<SupplierPart>();

    // Backward compatibility for NC module (optional but helpful during transition)
    public string? Address { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Website { get; set; }
    public string? ContactName { get; set; }
}

public sealed class SupplierContact
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    
    [Required, MaxLength(200)]
    public string FullName { get; set; } = "";
    
    public string? RoleTitle { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    
    public bool IsPrimary { get; set; }
    public bool IsActive { get; set; } = true;
    
    public string? Notes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class SupplierPart
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    
    public Guid PartId { get; set; }
    public Part? Part { get; set; }
    
    [MaxLength(100)]
    public string? SupplierSku { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal? LastUnitPrice { get; set; }
    
    [MaxLength(10)]
    public string? Currency { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal? DiscountPercent { get; set; }
    
    public int? LeadTimeDays { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal? Moq { get; set; }
    
    public string? ProductUrl { get; set; }
    public string? Notes { get; set; }
    
    public DateTimeOffset? LastPriceUpdatedAt { get; set; }
    
    public bool IsActive { get; set; } = true;
}
