namespace Cmms.Domain;

public sealed class Part
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = "";
    public string? Code { get; set; }
    public string? Uom { get; set; }

    public bool IsAct { get; set; } = true;
    
    // New fields
    public decimal? PurchasePrice { get; set; }
    public string PurchaseCurrency { get; set; } = "RON";

    public decimal MinQty { get; set; } = 0;
}
