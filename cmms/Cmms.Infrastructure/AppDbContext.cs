using Cmms.Domain;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Infrastructure;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();

    // PM
    public DbSet<PmPlan> PmPlans => Set<PmPlan>();
    public DbSet<PmPlanItem> PmPlanItems => Set<PmPlanItem>();

    // Parts + Inventory (conform migratiei InitFull)
    public DbSet<Part> Parts => Set<Part>();
    public DbSet<InventoryItem> Inventory => Set<InventoryItem>();
    public DbSet<WorkOrderPart> WorkOrderParts => Set<WorkOrderPart>();

    public DbSet<AssetPart> AssetParts => Set<AssetPart>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<Location>().HasIndex(x => x.Name);
        b.Entity<Asset>().HasIndex(x => x.Name);

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

        b.Entity<WorkOrder>()
            .HasOne(w => w.AssignedToPerson)
            .WithMany()
            .HasForeignKey(w => w.AssignedToPersonId)
            .OnDelete(DeleteBehavior.SetNull);

        // PM
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

        // Parts (tabela "Parts")
        b.Entity<Part>(e =>
        {
            e.ToTable("Parts");
            e.HasKey(x => x.Id);

            e.Property(x => x.Name).IsRequired();
            e.HasIndex(x => x.Name);
        });

        // Inventory (tabela "Inventory")
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

        // WorkOrderParts (tabela "WorkOrderParts" + coloana QtyUsed)
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

            e.HasOne(x => x.Asset)
                .WithMany()
                .HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Part)
                .WithMany()
                .HasForeignKey(x => x.PartId)
                .OnDelete(DeleteBehavior.Cascade);

            // un singur rand activ per (Asset, Part)
            e.HasIndex(x => new { x.AssetId, x.PartId }).IsUnique();
            e.HasIndex(x => new { x.AssetId, x.IsAct });
        });

    }
}
