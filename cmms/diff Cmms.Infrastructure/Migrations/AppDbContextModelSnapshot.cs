--- a/Cmms.Infrastructure/Migrations/AppDbContextModelSnapshot.cs
+++ b/Cmms.Infrastructure/Migrations/AppDbContextModelSnapshot.cs
@@
             modelBuilder.Entity("Cmms.Domain.InventoryItem", b =>
                 {
-                    b.Property<Guid>("Id")
-                        .ValueGeneratedOnAdd()
-                        .HasColumnType("uuid");
-
-                    b.Property<decimal?>("MinQty")
-                        .HasColumnType("numeric");
-
-                    b.Property<Guid>("PartId")
-                        .HasColumnType("uuid");
-
-                    b.Property<decimal>("QtyOnHand")
-                        .HasColumnType("numeric");
-
-                    b.HasKey("Id");
-
-                    b.HasIndex("PartId");
-
-                    b.ToTable("Inventory", (string)null);
+                    b.Property<Guid>("Id")
+                        .ValueGeneratedOnAdd()
+                        .HasColumnType("uuid");
+
+                    b.Property<Guid?>("LocationId")
+                        .HasColumnType("uuid");
+
+                    b.Property<decimal?>("MinQty")
+                        .HasColumnType("numeric");
+
+                    b.Property<Guid>("PartId")
+                        .HasColumnType("uuid");
+
+                    b.Property<decimal>("QtyOnHand")
+                        .HasColumnType("numeric");
+
+                    b.HasKey("Id");
+
+                    b.HasIndex("PartId", "LocationId");
+
+                    b.ToTable("Inventory", (string)null);
                 });
@@
             modelBuilder.Entity("Cmms.Domain.InventoryItem", b =>
                 {
                     b.HasOne("Cmms.Domain.Part", "Part")
                         .WithMany()
                         .HasForeignKey("PartId")
                         .OnDelete(DeleteBehavior.Cascade)
                         .IsRequired();
-
-                    b.Navigation("Part");
+                    b.HasOne("Cmms.Domain.Location", "Location")
+                        .WithMany()
+                        .HasForeignKey("LocationId")
+                        .OnDelete(DeleteBehavior.SetNull);
+
+                    b.Navigation("Part");
+                    b.Navigation("Location");
                 });