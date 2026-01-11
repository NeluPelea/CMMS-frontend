namespace Cmms.Domain;

public sealed class Part
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public bool IsAct { get; set; } = true;

    public string Name { get; set; } = "";
    public string? Code { get; set; }
    public string? ExternalCode { get; set; }

    public decimal? UnitCost { get; set; }
    public string? Uom { get; set; }
}
