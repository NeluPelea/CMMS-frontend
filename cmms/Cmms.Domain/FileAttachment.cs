namespace Cmms.Domain;

public sealed class FileAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Polymorphic association (e.g. WorkOrder, Asset)
    public Guid WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }

    public string FileName { get; set; } = "";
    public string StoredFileName { get; set; } = ""; // minimal security (guid based name)
    public string ContentType { get; set; } = "";
    public long SizeBytes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? UploadedByUserId { get; set; }
}
