using Cmms.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();

    // PM + Parts + Inventory (le definim mai jos in Entities.cs)
    public DbSet<PmPlan> PmPlans => Set<PmPlan>();
    public DbSet<PmPlanItem> PmPlanItems => Set<PmPlanItem>();
    public DbSet<Part> Parts => Set<Part>();
    public DbSet<InventoryItem> Inventory => Set<InventoryItem>();
    public DbSet<WorkOrderPart> WorkOrderParts => Set<WorkOrderPart>();


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

        b.Entity<InventoryItem>()
            .HasOne(i => i.Part)
            .WithMany()
            .HasForeignKey(i => i.PartId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<WorkOrderPart>()
            .HasOne(x => x.WorkOrder)
            .WithMany()
            .HasForeignKey(x => x.WorkOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<WorkOrderPart>()
            .HasOne(x => x.Part)
            .WithMany()
            .HasForeignKey(x => x.PartId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<WorkOrderPart>()
            .HasIndex(x => new { x.WorkOrderId, x.PartId });
    }
}
