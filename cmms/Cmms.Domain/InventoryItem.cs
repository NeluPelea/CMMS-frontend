namespace Cmms.Domain;

public sealed class InventoryItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PartId { get; set; }
    public Part? Part { get; set; }

    public decimal QtyOnHand { get; set; } = 0m;
    public decimal? MinQty { get; set; }
}
