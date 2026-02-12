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
    public DbSet<ExtraJobEvent> ExtraJobEvents => Set<ExtraJobEvent>();
    public DbSet<DocumentTemplate> DocumentTemplates => Set<DocumentTemplate>();
    public DbSet<UnitWorkSchedule> UnitWorkSchedule => Set<UnitWorkSchedule>();

    // NC (Nota de Comanda)
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<NcOrder> NcOrders => Set<NcOrder>();
    public DbSet<NcOrderLine> NcOrderLines => Set<NcOrderLine>();
    public DbSet<NcOrderAttachment> NcOrderAttachments => Set<NcOrderAttachment>();
    public DbSet<SupplierContact> SupplierContacts => Set<SupplierContact>();
    public DbSet<SupplierPart> SupplierParts => Set<SupplierPart>();

    // Inventory Docs
    public DbSet<GoodsReceipt> GoodsReceipts => Set<GoodsReceipt>();
    public DbSet<GoodsReceiptLine> GoodsReceiptLines => Set<GoodsReceiptLine>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    // Security
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserPermissionOverride> UserPermissionOverrides => Set<UserPermissionOverride>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();


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

        b.Entity<WorkOrderLabor>()
            .HasOne(x => x.WorkOrder)
            .WithMany(w => w.LaborLogs)
            .HasForeignKey(x => x.WorkOrderId)
            .OnDelete(DeleteBehavior.Cascade);

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
        b.Entity<NationalHoliday>()
            .HasQueryFilter(x => x.IsAct);

        b.Entity<CompanyBlackoutDay>()
            .HasKey(x => x.Date);
        b.Entity<CompanyBlackoutDay>()
            .HasQueryFilter(x => x.IsAct);

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

            e.Property(x => x.PurchasePrice).HasColumnType("decimal(18,2)");
            e.Property(x => x.PurchaseCurrency).IsRequired().HasMaxLength(3).HasDefaultValue("RON");
            e.Property(x => x.MinQty).HasColumnType("decimal(18,2)");
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

        // ---------------- ExtraJobs ----------------
        b.Entity<ExtraJobEvent>(e =>
        {
            e.ToTable("extra_job_events");
            e.HasKey(x => x.Id);
            e.Property(x => x.ActorId).HasMaxLength(200);
            e.Property(x => x.Field).HasMaxLength(80);
            e.Property(x => x.OldValue).HasMaxLength(400);
            e.Property(x => x.NewValue).HasMaxLength(400);
            e.Property(x => x.Message).HasMaxLength(2000);

            e.HasIndex(x => x.ExtraJobId);
            e.HasIndex(x => x.CreatedAtUtc);

            e.HasOne(x => x.ExtraJob)
             .WithMany(j => j.ExtraJobEvents)
             .HasForeignKey(x => x.ExtraJobId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<DocumentTemplate>(e =>
        {
            e.ToTable("document_templates");
            e.HasKey(x => x.Id);
            e.Property(x => x.StoredFilePath).IsRequired().HasMaxLength(500);
            e.Property(x => x.OriginalFileName).IsRequired().HasMaxLength(255);
            e.Property(x => x.ContentType).IsRequired().HasMaxLength(100);
            e.HasIndex(x => x.Type).IsUnique();
        });

        b.Entity<UnitWorkSchedule>(e =>
        {
            e.ToTable("unit_work_schedule");
            e.HasKey(x => x.Id);
        });

        // Security Configurations
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.Username).HasMaxLength(100).IsRequired();
            e.Property(x => x.DisplayName).HasMaxLength(200);
            e.Property(x => x.PasswordHash).IsRequired();
        });

        b.Entity<Role>(e =>
        {
            e.ToTable("roles");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(50).IsRequired();
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
        });

        b.Entity<Permission>(e =>
        {
            e.ToTable("permissions");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(100).IsRequired();
            e.Property(x => x.GroupName).HasMaxLength(50);
        });

        b.Entity<UserRole>(e =>
        {
            e.ToTable("user_roles");
            e.HasKey(x => new { x.UserId, x.RoleId });
            e.HasOne(x => x.User).WithMany(u => u.UserRoles).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Role).WithMany(r => r.UserRoles).HasForeignKey(x => x.RoleId);
        });

        b.Entity<RolePermission>(e =>
        {
            e.ToTable("role_permissions");
            e.HasKey(x => new { x.RoleId, x.PermissionId });
            e.HasOne(x => x.Role).WithMany(r => r.RolePermissions).HasForeignKey(x => x.RoleId);
            e.HasOne(x => x.Permission).WithMany().HasForeignKey(x => x.PermissionId);
        });

        b.Entity<UserPermissionOverride>(e =>
        {
            e.ToTable("user_permission_overrides");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.PermissionId }).IsUnique();
            e.HasOne(x => x.User).WithMany(u => u.PermissionOverrides).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Permission).WithMany().HasForeignKey(x => x.PermissionId);
        });

        b.Entity<AuditLog>(e =>
        {
            e.ToTable("security_audit_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Action).HasMaxLength(100);
            e.Property(x => x.TargetType).HasMaxLength(100);
            e.HasIndex(x => x.CreatedAt);
        });

        // ---------------- NC / Suppliers ----------------
        b.Entity<Supplier>(e =>
        {
            e.ToTable("suppliers");
            e.HasIndex(x => x.Name);
            e.HasIndex(x => x.Code).IsUnique();
        });

        b.Entity<NcOrder>(e =>
        {
            e.ToTable("nc_orders");
            e.HasIndex(x => x.NcNumber).IsUnique();
            e.HasIndex(x => x.OrderDate);
            e.HasIndex(x => x.Status);

            e.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.DeliveryLocation).WithMany().HasForeignKey(x => x.DeliveryLocationId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.ReceiverPerson).WithMany().HasForeignKey(x => x.ReceiverPersonId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.WorkOrder).WithMany().HasForeignKey(x => x.WorkOrderId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Asset).WithMany().HasForeignKey(x => x.AssetId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<NcOrderLine>(e =>
        {
            e.ToTable("nc_order_lines");
            e.HasOne(x => x.NcOrder).WithMany(o => o.Lines).HasForeignKey(x => x.NcOrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Part).WithMany().HasForeignKey(x => x.PartId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.SupplierPart).WithMany().HasForeignKey(x => x.SupplierPartId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<NcOrderAttachment>(e =>
        {
            e.ToTable("nc_order_attachments");
            e.HasOne(x => x.NcOrder).WithMany(o => o.Attachments).HasForeignKey(x => x.NcOrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.UploadedByUser).WithMany().HasForeignKey(x => x.UploadedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<SupplierContact>(e =>
        {
            e.ToTable("supplier_contacts");
            e.HasOne(x => x.Supplier).WithMany(s => s.Contacts).HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<SupplierPart>(e =>
        {
            e.ToTable("supplier_parts");
            e.HasOne(x => x.Supplier).WithMany(s => s.SupplierParts).HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Part).WithMany().HasForeignKey(x => x.PartId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.SupplierId, x.PartId }).IsUnique();
        });

        // ---------------- Inventory Docs ----------------
        b.Entity<GoodsReceipt>(e =>
        {
            e.ToTable("goods_receipts");
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<GoodsReceiptLine>(e =>
        {
            e.ToTable("goods_receipt_lines");
            e.HasKey(x => x.Id);
            e.HasOne(x => x.GoodsReceipt).WithMany(r => r.Lines).HasForeignKey(x => x.GoodsReceiptId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Part).WithMany().HasForeignKey(x => x.PartId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<StockMovement>(e =>
        {
            e.ToTable("stock_movements");
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Part).WithMany().HasForeignKey(x => x.PartId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.CreatedAt);
        });


        b.Entity<AppSetting>(e =>
        {
            e.ToTable("app_settings");
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(50);

            e.HasData(
                new AppSetting { Key = "VAT_RATE", Value = "19", Description = "Cota TVA (%)" },
                new AppSetting { Key = "FX_RON_EUR", Value = "4.950000", Description = "Curs RON/EUR" },
                new AppSetting { Key = "FX_RON_USD", Value = "4.600000", Description = "Curs RON/USD" }
            );
        });
    }
}
