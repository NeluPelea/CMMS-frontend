namespace Cmms.Domain;

public sealed class Location
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Code { get; set; }
    public bool IsAct { get; set; } = true;
}

public sealed class Asset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Code { get; set; }

    public Guid? LocationId { get; set; }
    public Location? Location { get; set; }

    public bool IsAct { get; set; } = true;
}

public sealed class Person
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string DisplayName { get; set; } = "";
}

public enum WorkOrderType
{
    AdHoc = 1,
    Preventive = 2,
    Extra = 3
}

public enum WorkOrderStatus
{
    Open = 1,
    InProgress = 2,
    Done = 3,
    Cancelled = 4
}

public sealed class WorkOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public WorkOrderType Type { get; set; } = WorkOrderType.AdHoc;
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Open;

    public string Title { get; set; } = "";
    public string? Description { get; set; }

    public Guid? AssetId { get; set; }
    public Asset? Asset { get; set; }

    public Guid? AssignedToPersonId { get; set; }
    public Person? AssignedToPerson { get; set; }

    public DateTimeOffset? StartAt { get; set; }
    public DateTimeOffset? StopAt { get; set; }

    public int? DurationMinutes { get; set; }

    public Guid? PmPlanId { get; set; }
    public Guid? ExtraRequestId { get; set; }
}

public enum PmFrequency
{
    Daily = 1,
    Weekly = 2,
    Monthly = 3
}

public sealed class PmPlan
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid AssetId { get; set; }
    public Asset? Asset { get; set; }

    public string Name { get; set; } = "";
    public PmFrequency Frequency { get; set; } = PmFrequency.Monthly;

    public DateTimeOffset NextDueAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsAct { get; set; } = true;

    public List<PmPlanItem> Items { get; set; } = new();
}

public sealed class PmPlanItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PmPlanId { get; set; }
    public PmPlan? PmPlan { get; set; }

    public string Text { get; set; } = "";
    public int Sort { get; set; } = 0;
}

// Part si InventoryItem NU sunt aici (sunt in Part.cs si InventoryItem.cs)

public sealed class WorkOrderPart
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }

    public Guid PartId { get; set; }
    public Part? Part { get; set; }

    public decimal QtyUsed { get; set; } = 0m;
}
