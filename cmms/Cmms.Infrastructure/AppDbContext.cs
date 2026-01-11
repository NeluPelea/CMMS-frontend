using Cmms.Domain;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();

    // PM
    public DbSet<PmPlan> PmPlans => Set<PmPlan>();
    public DbSet<PmPlanItem> PmPlanItems => Set<PmPlanItem>();

    // Parts + Inventory
    public DbSet<Part> Parts => Set<Part>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<WorkOrderPart> WorkOrderParts => Set<WorkOrderPart>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // ---- Base entities ----
        b.Entity<Location>(e =>
        {
            e.HasIndex(x => x.Name);
        });

        b.Entity<Asset>(e =>
        {
            e.HasIndex(x => x.Name);

            e.HasOne(a => a.Location)
                .WithMany()
                .HasForeignKey(a => a.LocationId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<WorkOrder>(e =>
        {
            e.HasOne(w => w.Asset)
                .WithMany()
                .HasForeignKey(w => w.AssetId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasOne(w => w.AssignedToPerson)
                .WithMany()
                .HasForeignKey(w => w.AssignedToPersonId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ---- PM ----
        b.Entity<PmPlan>(e =>
        {
            e.HasOne(p => p.Asset)
                .WithMany()
                .HasForeignKey(p => p.AssetId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.AssetId, x.IsAct });
            e.HasIndex(x => new { x.IsAct, x.NextDueAt });
        });

        b.Entity<PmPlanItem>(e =>
        {
            e.HasOne(i => i.PmPlan)
                .WithMany(p => p.Items)
                .HasForeignKey(i => i.PmPlanId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.PmPlanId, x.Sort });
        });

        // ---- Parts ----
        b.Entity<Part>(e =>
        {
            e.ToTable("parts");
            e.HasKey(x => x.Id);

            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Code).HasMaxLength(50);
            e.Property(x => x.ExternalCode).HasMaxLength(80);
            e.Property(x => x.Uom).HasMaxLength(20);

            e.Property(x => x.UnitCost).HasColumnType("numeric(18,4)");

            e.HasIndex(x => x.Name);
            e.HasIndex(x => x.Code);
            e.HasIndex(x => x.ExternalCode);
        });

        // ---- Inventory ----
        b.Entity<InventoryItem>(e =>
        {
            e.ToTable("inventory_items");
            e.HasKey(x => x.Id);

            e.Property(x => x.QtyOnHand).HasColumnType("numeric(18,4)");

            e.HasOne(i => i.Part)
                .WithMany()
                .HasForeignKey(i => i.PartId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(i => i.Location)
                .WithMany()
                .HasForeignKey(i => i.LocationId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(x => new { x.PartId, x.LocationId }).IsUnique();
        });

        // ---- WorkOrderParts ----
        b.Entity<WorkOrderPart>(e =>
        {
            e.ToTable("work_order_parts");
            e.HasKey(x => x.Id);

            e.Property(x => x.Qty).HasColumnType("numeric(18,4)");
            e.Property(x => x.UnitCost).HasColumnType("numeric(18,4)");

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
    }
}
