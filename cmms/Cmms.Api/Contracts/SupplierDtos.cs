namespace Cmms.Api.Contracts;

public record SupplierSummaryContactDto(
    string FullName,
    string? Phone,
    string? Email
);

public record SupplierSummaryDto(
    Guid Id,
    string Name,
    string? Code,
    bool IsActive,
    bool IsPreferred,
    string? City,
    string? WebsiteUrl,
    List<SupplierSummaryContactDto> Contacts
);

public record SupplierContactDto(
    Guid Id,
    string FullName,
    string? RoleTitle,
    string? Phone,
    string? Email,
    bool IsPrimary,
    bool IsActive,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record SupplierPartDto(
    Guid Id,
    Guid PartId,
    string PartName,
    string? PartCode,
    string? SupplierSku,
    decimal? LastUnitPrice,
    string? Currency,
    decimal? DiscountPercent,
    int? LeadTimeDays,
    decimal? Moq,
    string? ProductUrl,
    string? Notes,
    DateTimeOffset? LastPriceUpdatedAt,
    bool IsActive
);

public record SupplierDetailsDto(
    Guid Id,
    string Name,
    string? Code,
    bool IsActive,
    bool IsPreferred,
    string? WebsiteUrl,
    string? TaxId,
    string? RegCom,
    string? AddressLine1,
    string? City,
    string? County,
    string? Country,
    string? PostalCode,
    int? PaymentTermsDays,
    string? Currency,
    string? Iban,
    string? BankName,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<SupplierContactDto> Contacts,
    List<SupplierPartDto> Parts
);

public record SupplierCreateReq(
    string Name,
    string? Code,
    bool IsPreferred,
    string? WebsiteUrl,
    string? TaxId,
    string? RegCom,
    string? AddressLine1,
    string? City,
    string? County,
    string? Country,
    string? PostalCode,
    int? PaymentTermsDays,
    string? Currency,
    string? Iban,
    string? BankName,
    string? Notes
);

public record SupplierUpdateReq(
    string Name,
    string? Code,
    bool IsActive,
    bool IsPreferred,
    string? WebsiteUrl,
    string? TaxId,
    string? RegCom,
    string? AddressLine1,
    string? City,
    string? County,
    string? Country,
    string? PostalCode,
    int? PaymentTermsDays,
    string? Currency,
    string? Iban,
    string? BankName,
    string? Notes
);

public record ContactSaveReq(
    string FullName,
    string? RoleTitle,
    string? Phone,
    string? Email,
    bool IsPrimary,
    string? Notes,
    bool IsActive = true
);

public record SupplierPartSaveReq(
    Guid PartId,
    string? SupplierSku,
    decimal? LastUnitPrice,
    string? Currency,
    decimal? DiscountPercent,
    int? LeadTimeDays,
    decimal? Moq,
    string? ProductUrl,
    string? Notes,
    bool IsActive = true
);
