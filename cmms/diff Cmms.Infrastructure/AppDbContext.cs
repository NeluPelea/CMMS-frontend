--- a/Cmms.Infrastructure/AppDbContext.cs
+++ b/Cmms.Infrastructure/AppDbContext.cs
@@
         // Inventory (tabela "Inventory")
         b.Entity<InventoryItem>(e =>
         {
             e.ToTable("Inventory");
             e.HasKey(x => x.Id);
 
+            e.Property(x => x.LocationId).HasColumnType("uuid");
+
             e.Property(x => x.QtyOnHand).HasColumnType("numeric");
             e.Property(x => x.MinQty).HasColumnType("numeric");
 
             e.HasOne(i => i.Part)
                 .WithMany()
                 .HasForeignKey(i => i.PartId)
                 .OnDelete(DeleteBehavior.Cascade);
 
-            e.HasIndex(x => x.PartId);
+            // index on Part + Location for efficient per-location lookups (LocationId nullable -> global rows)
+            e.HasOne(i => i.Location)
+                .WithMany()
+                .HasForeignKey(i => i.LocationId)
+                .OnDelete(DeleteBehavior.SetNull);
+
+            e.HasIndex(x => new { x.PartId, x.LocationId });
         });