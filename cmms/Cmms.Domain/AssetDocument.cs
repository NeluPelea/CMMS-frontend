using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Cmms.Domain;

public sealed class AssetDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid AssetId { get; set; }
    public Asset? Asset { get; set; }

    [Required, MaxLength(200)]
    public string Title { get; set; } = "";

    [Required, MaxLength(255)]
    public string FileName { get; set; } = "";

    [Required, MaxLength(500)]
    public string StoragePath { get; set; } = "";

    [MaxLength(100)]
    public string ContentType { get; set; } = "";

    public long SizeBytes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }
}
