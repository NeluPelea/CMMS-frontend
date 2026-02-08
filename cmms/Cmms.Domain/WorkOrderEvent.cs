namespace Cmms.Domain;

public enum WorkOrderEventKind
{
    Created = 1,
    Updated = 2,
    StatusChanged = 3,
    AssignedChanged = 4,
    Started = 5,
    Stopped = 6,
    Cancelled = 7,
    Reopened = 8,
    Comment = 9,
    PartAdded = 10,
    PartRemoved = 11
}

public sealed class WorkOrderEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkOrderId { get; set; }
    public WorkOrder WorkOrder { get; set; } = null!;

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    // Actor din JWT (sub / nameidentifier). Optional.
    public string? ActorId { get; set; }

    public WorkOrderEventKind Kind { get; set; }

    // pentru diffs
    public string? Field { get; set; }     // ex: "status", "assignedToPersonId", "title"
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }

    // mesaj optional (comment)
    public string? Message { get; set; }

    // optional: group events in same operation
    public Guid? CorrelationId { get; set; }
}
