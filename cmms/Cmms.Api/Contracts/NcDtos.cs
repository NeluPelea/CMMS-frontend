using Cmms.Domain;

namespace Cmms.Api.Contracts;

public record SupplierDto(
    Guid Id,
    string Name,
    string? Code,
    string? ContactName,
    string? Email,
    string? Phone,
    string? Address,
    string? Website,
    bool IsActive
);

public record CreateNcOrderReq(
    string? NcNumber, // Optional, can be auto-generated
    Guid SupplierId,
    string Currency,
    DateTime OrderDate,
    DateTime? NeededByDate,
    int Priority,
    string? Notes,
    Guid? DeliveryLocationId,
    string? DeliveryAddressOverride,
    Guid? ReceiverPersonId,
    string? ReceiverPhone,
    Guid? WorkOrderId,
    Guid? AssetId,
    string? Reason
);

public record UpdateNcOrderReq(
    Guid SupplierId,
    string Currency,
    DateTime OrderDate,
    DateTime? NeededByDate,
    int Priority,
    string? Notes,
    Guid? DeliveryLocationId,
    string? DeliveryAddressOverride,
    Guid? ReceiverPersonId,
    string? ReceiverPhone,
    Guid? WorkOrderId,
    Guid? AssetId,
    string? Reason
);

public record NcOrderLineDto(
    Guid Id,
    Guid? PartId,
    Guid? SupplierPartId,
    string? PartNameManual,
    string? SupplierSku,
    string Uom,
    decimal Qty,
    decimal UnitPrice,
    string? Currency,
    decimal DiscountPercent,
    decimal LineTotal,
    int? LeadTimeDays,
    string? Notes,
    int SortOrder
);

public record SaveNcOrderLineReq(
    Guid? PartId,
    Guid? SupplierPartId,
    string? PartNameManual,
    string? SupplierSku,
    string Uom,
    decimal Qty,
    decimal UnitPrice,
    string? Currency,
    decimal DiscountPercent,
    int? LeadTimeDays,
    string? Notes,
    int SortOrder
);

public record NcOrderAttachmentDto(
    Guid Id,
    string FileName,
    string ContentType,
    Guid UploadedByUserId,
    string UploadedByUserName,
    DateTime UploadedAt
);

public record NcOrderDetailsDto(
    Guid Id,
    string NcNumber,
    NcOrderStatus Status,
    Guid SupplierId,
    string SupplierName,
    string Currency,
    DateTime OrderDate,
    DateTime? NeededByDate,
    int Priority,
    string? Notes,
    Guid? DeliveryLocationId,
    string? DeliveryLocationName,
    string? DeliveryAddressOverride,
    Guid? ReceiverPersonId,
    string? ReceiverPersonName,
    string? ReceiverPhone,
    Guid? WorkOrderId,
    string? WorkOrderTitle,
    Guid? AssetId,
    string? AssetName,
    string? Reason,
    decimal Subtotal,
    decimal VatPercent,
    decimal VatAmount,
    decimal Total,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<NcOrderLineDto> Lines,
    List<NcOrderAttachmentDto> Attachments
);

public record NcOrderSummaryDto(
    Guid Id,
    string NcNumber,
    NcOrderStatus Status,
    string SupplierName,
    string Currency,
    decimal Total,
    DateTime OrderDate,
    DateTime? NeededByDate,
    int Priority
);
