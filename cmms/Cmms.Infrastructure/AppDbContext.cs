using Cmms.Domain;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Infrastructure;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Asset> Assets => Set<Asset>();

    public DbSet<Person> People => Set<Person>();
    public DbSet<PersonWorkSchedule> PersonWorkSchedules => Set<PersonWorkSchedule>();
    public DbSet<PersonLeave> PersonLeaves => Set<PersonLeave>();

    public DbSet<NationalHoliday> NationalHolidays => Set<NationalHoliday>();
    public DbSet<CompanyBlackoutDay> CompanyBlackoutDays => Set<CompanyBlackoutDay>();

    public DbSet<AssignmentRole> AssignmentRoles => Set<AssignmentRole>();
    public DbSet<WorkOrderAssignment> WorkOrderAssignments => Set<WorkOrderAssignment>();
    public DbSet<PmPlanAssignment> PmPlanAssignments => Set<PmPlanAssignment>();

    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();

    // PM
    public DbSet<PmPlan> PmPlans => Set<PmPlan>();
    public DbSet<PmPlanItem> PmPlanItems => Set<PmPlanItem>();

    // Parts + Inventory (conform migratiei InitFull)
    public DbSet<Part> Parts => Set<Part>();
    public DbSet<InventoryItem> Inventory => Set<InventoryItem>();
    public DbSet<WorkOrderPart> WorkOrderParts => Set<WorkOrderPart>();
    public DbSet<AssetPart> AssetParts => Set<AssetPart>();

    public DbSet<WorkOrderEvent> WorkOrderEvents => Set<WorkOrderEvent>();
    public DbSet<FileAttachment> FileAttachments => Set<FileAttachment>();
    public DbSet<WorkOrderLabor> WorkOrderLaborLogs => Set<WorkOrderLabor>();
    public DbSet<ExtraJob> ExtraJobs => Set<ExtraJob>();


    protected override void OnModelCreating(ModelBuilder b)

    {
        base.OnModelCreating(b);

        b.Entity<FileAttachment>(e =>
        {
            e.ToTable("FileAttachments");
            e.HasKey(x => x.Id);
            
            e.HasOne(x => x.WorkOrder)
                .WithMany(w => w.Attachments)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);

            e.Property(x => x.FileName).HasMaxLength(255).IsRequired();
            e.Property(x => x.StoredFileName).HasMaxLength(255).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(100);
        });

        b.Entity<WorkOrderEvent>(e =>
        {
            e.ToTable("work_order_events");
            e.HasKey(x => x.Id);

            e.Property(x => x.ActorId).HasMaxLength(200);
            e.Property(x => x.Field).HasMaxLength(80);
            e.Property(x => x.OldValue).HasMaxLength(400);
            e.Property(x => x.NewValue).HasMaxLength(400);
            e.Property(x => x.Message).HasMaxLength(2000);

            e.HasIndex(x => new { x.WorkOrderId, x.CreatedAtUtc });
            e.HasIndex(x => x.CreatedAtUtc);

            e.HasOne(x => x.WorkOrder)
              .WithMany() // nu adaugam navigation pe WorkOrder (optional)
              .HasForeignKey(x => x.WorkOrderId)
              .OnDelete(DeleteBehavior.Cascade);
        });


        // ---------------- Index / existing ----------------
        b.Entity<Location>().HasIndex(x => x.Name);
        b.Entity<Asset>().HasIndex(x => x.Name);

        // optional: soft delete global pe Location/Asset
        b.Entity<Location>().HasQueryFilter(x => x.IsAct);
        // b.Entity<Asset>().HasQueryFilter(x => x.IsAct);

        b.Entity<Asset>()
            .HasOne(a => a.Location)
            .WithMany()
            .HasForeignKey(a => a.LocationId)
            .OnDelete(DeleteBehavior.SetNull);

        b.Entity<WorkOrder>()
            .HasOne(w => w.Asset)
            .WithMany()
            .HasForeignKey(w => w.AssetId)
            .OnDelete(DeleteBehavior.SetNull);

        // legacy single-assign
        b.Entity<WorkOrder>()
            .HasOne(w => w.AssignedToPerson)
            .WithMany()
            .HasForeignKey(w => w.AssignedToPersonId)
            .OnDelete(DeleteBehavior.SetNull);

        // ---------------- NEW: People ----------------

        b.Entity<Person>()
            .Property(x => x.DisplayName)
            .HasMaxLength(200);

        b.Entity<Person>()
            .Property(x => x.FullName)
            .HasMaxLength(200);

        b.Entity<Person>()
            .Property(x => x.JobTitle)
            .HasMaxLength(200);

        b.Entity<Person>()
            .Property(x => x.Specialization)
            .HasMaxLength(200);

        b.Entity<Person>()
            .Property(x => x.Phone)
            .HasMaxLength(50);

        b.Entity<Person>()
            .Property(x => x.Email)
            .HasMaxLength(200);

        // 1:1 schedule: PK = PersonId
        b.Entity<PersonWorkSchedule>()
            .HasKey(x => x.PersonId);

        b.Entity<PersonWorkSchedule>()
            .HasOne(x => x.Person)
            .WithOne(p => p.WorkSchedule!)
            .HasForeignKey<PersonWorkSchedule>(x => x.PersonId)
            .OnDelete(DeleteBehavior.Cascade);

        // Leaves 1:N + DateOnly mapping
        b.Entity<PersonLeave>(e =>
        {
            e.ToTable("person_leaves");
            e.HasKey(x => x.Id);

            e.Property(x => x.Type).HasConversion<int>();

            // DateOnly -> SQL date
            e.Property(x => x.StartDate).HasColumnType("date");
            e.Property(x => x.EndDate).HasColumnType("date");

            e.Property(x => x.Notes).HasMaxLength(500);

            e.HasOne(x => x.Person)
                .WithMany(p => p.Leaves)
                .HasForeignKey(x => x.PersonId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.PersonId, x.StartDate, x.EndDate });
        });

        // ---------------- NEW: Calendar ----------------
        b.Entity<NationalHoliday>()
            .HasKey(x => x.Date);

        b.Entity<CompanyBlackoutDay>()
            .HasKey(x => x.Date);

        // ---------------- NEW: Roles ----------------
        b.Entity<AssignmentRole>()
            .Property(x => x.Name)
            .IsRequired()
            .HasMaxLength(100);

        b.Entity<AssignmentRole>()
            .HasIndex(x => x.Name)
            .IsUnique();

        // ---------------- NEW: WorkOrderAssignments ----------------
        b.Entity<WorkOrderAssignment>()
            .HasOne(x => x.WorkOrder)
            .WithMany(w => w.Assignments)
            .HasForeignKey(x => x.WorkOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<WorkOrderAssignment>()
            .HasOne(x => x.Person)
            .WithMany()
            .HasForeignKey(x => x.PersonId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<WorkOrderAssignment>()
            .HasOne(x => x.Role)
            .WithMany()
            .HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<WorkOrderAssignment>()
            .HasIndex(x => new { x.WorkOrderId, x.PersonId });

        // optional: previne duplicate simple (aceeasi persoana+rol pe WO)
        b.Entity<WorkOrderAssignment>()
            .HasIndex(x => new { x.WorkOrderId, x.PersonId, x.RoleId })
            .IsUnique();

        // Domain are: public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        b.Entity<WorkOrderAssignment>()
            .Property(x => x.CreatedAt)
            .HasColumnType("timestamptz")
            .HasDefaultValueSql("now()");

        // ---------------- PM (existing) ----------------
        b.Entity<PmPlan>()
            .HasOne(p => p.Asset)
            .WithMany()
            .HasForeignKey(p => p.AssetId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<PmPlanItem>()
            .HasOne(i => i.PmPlan)
            .WithMany(p => p.Items)
            .HasForeignKey(i => i.PmPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        // ---------------- NEW: PmPlanAssignments ----------------
        b.Entity<PmPlanAssignment>()
            .HasOne(x => x.PmPlan)
            .WithMany(p => p.Assignments)
            .HasForeignKey(x => x.PmPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<PmPlanAssignment>()
            .HasOne(x => x.Person)
            .WithMany()
            .HasForeignKey(x => x.PersonId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<PmPlanAssignment>()
            .HasOne(x => x.Role)
            .WithMany()
            .HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<PmPlanAssignment>()
            .HasIndex(x => new { x.PmPlanId, x.PersonId, x.RoleId })
            .IsUnique();

        // ---------------- Parts (existing) ----------------
        b.Entity<Part>(e =>
        {
            e.ToTable("Parts");
            e.HasKey(x => x.Id);

            e.Property(x => x.Name).IsRequired();
            e.HasIndex(x => x.Name);
        });

        b.Entity<InventoryItem>(e =>
        {
            e.ToTable("Inventory");
            e.HasKey(x => x.Id);

            e.Property(x => x.QtyOnHand).HasColumnType("numeric");
            e.Property(x => x.MinQty).HasColumnType("numeric");

            e.HasOne(i => i.Part)
                .WithMany()
                .HasForeignKey(i => i.PartId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => x.PartId);
        });

        b.Entity<WorkOrderPart>(e =>
        {
            e.ToTable("WorkOrderParts");
            e.HasKey(x => x.Id);

            e.Property(x => x.QtyUsed).HasColumnType("numeric");

            e.HasOne(x => x.WorkOrder)
                .WithMany()
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Part)
                .WithMany()
                .HasForeignKey(x => x.PartId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(x => new { x.WorkOrderId, x.PartId });
        });

        b.Entity<AssetPart>(e =>
        {
            e.ToTable("asset_parts");
            e.HasKey(x => x.Id);

            // soft delete pt compatibilitate
            e.HasQueryFilter(x => x.IsAct);

            e.HasOne(x => x.Asset)
                .WithMany()
                .HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Part)
                .WithMany()
                .HasForeignKey(x => x.PartId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.AssetId, x.PartId }).IsUnique();
            e.HasIndex(x => new { x.AssetId, x.IsAct });
        });
    }
}
