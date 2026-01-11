namespace Cmms.Domain;

public enum PmIntervalUnit
{
    Days = 1,
    Weeks = 2,
    Months = 3
}

public sealed class PmPlan
{
    public Guid Id { get; set; }

    public bool IsAct { get; set; } = true;

    public Guid AssetId { get; set; }
    public Asset? Asset { get; set; }

    public string Title { get; set; } = "";
    public string? Description { get; set; }

    public int Every { get; set; } = 1;
    public PmIntervalUnit Unit { get; set; } = PmIntervalUnit.Weeks;

    public DateTimeOffset StartFrom { get; set; }
    public DateTimeOffset? LastGeneratedAt { get; set; }
    public DateTimeOffset NextDueAt { get; set; }
}
