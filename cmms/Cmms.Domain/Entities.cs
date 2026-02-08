namespace Cmms.Domain;

// =========================
// Core: Locations / Assets
// =========================

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

// =========================
// People / Personal
// =========================

public sealed class Person
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Legacy field (exists in DB) - keep for backward compatibility.
    public string DisplayName { get; set; } = "";

    // New fields
    public string FullName { get; set; } = "";
    public string JobTitle { get; set; } = "";
    public string Specialization { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public PersonWorkSchedule? WorkSchedule { get; set; }
    public ICollection<PersonLeave> Leaves { get; set; } = new List<PersonLeave>();
}

public sealed class PersonWorkSchedule
{
    // PK = PersonId (1:1)
    public Guid PersonId { get; set; }
    public Person? Person { get; set; }

    // Time-of-day as TimeSpan (00:00..23:59)
    public TimeSpan MonFriStart { get; set; } = new TimeSpan(8, 0, 0);
    public TimeSpan MonFriEnd { get; set; } = new TimeSpan(16, 30, 0);

    // Optional: if null => not working that day
    public TimeSpan? SatStart { get; set; }
    public TimeSpan? SatEnd { get; set; }

    // Optional: if null => not working that day
    public TimeSpan? SunStart { get; set; }
    public TimeSpan? SunEnd { get; set; }

    public string Timezone { get; set; } = "Europe/Bucharest";
}

public enum LeaveType
{
    CO = 1,
    CM = 2,
    ZL = 3, // Zi liberă (manual)
    ZN = 4  // Recuperare zi liberă națională
}

public sealed class PersonLeave
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PersonId { get; set; }
    public Person? Person { get; set; }

    public LeaveType Type { get; set; } = LeaveType.CO;

    // Date-only semantics (stored as SQL 'date').
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public string? Notes { get; set; }
}

// =========================
// Calendar (company closed days)
// =========================

public sealed class NationalHoliday
{
    // Date-only semantics; currently stored as DateTime 00:00 UTC (keep as-is for DB compatibility).
    public DateTime Date { get; set; }
    public string? Name { get; set; }
    public bool IsAct { get; set; } = true;
}

public sealed class CompanyBlackoutDay
{
    // Date-only semantics; currently stored as DateTime 00:00 UTC (keep as-is for DB compatibility).
    public DateTime Date { get; set; }
    public string? Name { get; set; }
    public bool IsAct { get; set; } = true;
}

// =========================
// Roles & Assignments
// =========================

public sealed class AssignmentRole
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 0;
}

public sealed class WorkOrderAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Guid WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }

    public Guid PersonId { get; set; }
    public Person? Person { get; set; }

    public Guid RoleId { get; set; }
    public AssignmentRole? Role { get; set; }

    // Planned interval (required)
    public DateTimeOffset PlannedFrom { get; set; }
    public DateTimeOffset PlannedTo { get; set; }

    public string? Notes { get; set; }
}

public sealed class PmPlanAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PmPlanId { get; set; }
    public PmPlan? PmPlan { get; set; }

    public Guid PersonId { get; set; }
    public Person? Person { get; set; }

    public Guid RoleId { get; set; }
    public AssignmentRole? Role { get; set; }
}

// =========================
// Work Orders
// =========================

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

    // Creation timestamp (used by reports)
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public WorkOrderType Type { get; set; } = WorkOrderType.AdHoc;
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Open;

    public string Title { get; set; } = "";
    public string? Description { get; set; }

    public Guid? AssetId { get; set; }
    public Asset? Asset { get; set; }

    // Legacy single-assign (keep until UI fully migrated)
    public Guid? AssignedToPersonId { get; set; }
    public Person? AssignedToPerson { get; set; }

    // New multi-assign
    public ICollection<WorkOrderAssignment> Assignments { get; set; } = new List<WorkOrderAssignment>();

    public DateTimeOffset? StartAt { get; set; }
    public DateTimeOffset? StopAt { get; set; }

    public int? DurationMinutes { get; set; }

    public Guid? PmPlanId { get; set; }
    public Guid? ExtraRequestId { get; set; }

    // Intervention fields
    public string? Defect { get; set; }
    public string? Cause { get; set; }
    public string? Solution { get; set; }


    public ICollection<FileAttachment> Attachments { get; set; } = new List<FileAttachment>();
}

// =========================
// Preventive Maintenance
// =========================

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

    public ICollection<PmPlanItem> Items { get; set; } = new List<PmPlanItem>();

    // Default assignments
    public ICollection<PmPlanAssignment> Assignments { get; set; } = new List<PmPlanAssignment>();
}

public sealed class PmPlanItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PmPlanId { get; set; }
    public PmPlan? PmPlan { get; set; }

    public string Text { get; set; } = "";
    public int Sort { get; set; } = 0;
}

// =========================
// Parts usage (domain glue)
// =========================

public sealed class WorkOrderPart
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }

    public Guid PartId { get; set; }
    public Part? Part { get; set; }

    public decimal QtyUsed { get; set; } = 0m;

    public bool IsUniversal { get; set; } = false;
}

public sealed class AssetPart
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid AssetId { get; set; }
    public Asset? Asset { get; set; }

    public Guid PartId { get; set; }
    public Part? Part { get; set; }

    public bool IsAct { get; set; } = true; // soft delete
}

// =========================
// Labor Logs (Manopera)
// =========================

public sealed class WorkOrderLabor
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }

    public Guid PersonId { get; set; }
    public Person? Person { get; set; }

    // Minutes spent
    public int Minutes { get; set; } = 0;

    public string? Description { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// =========================
// Extra Jobs (IntExtra)
// =========================

public sealed class ExtraJob
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Title { get; set; } = "";
    public string? Description { get; set; }

    public bool IsDone { get; set; } = false;

    public Guid? AssignedToPersonId { get; set; }
    public Person? AssignedToPerson { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FinishedAt { get; set; }
}

