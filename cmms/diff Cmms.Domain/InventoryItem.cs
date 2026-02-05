--- a/Cmms.Domain/InventoryItem.cs
+++ b/Cmms.Domain/InventoryItem.cs
@@
 namespace Cmms.Domain;
 
 public sealed class InventoryItem
 {
     public Guid Id { get; set; } = Guid.NewGuid();
 
     public Guid PartId { get; set; }
     public Part? Part { get; set; }
+
+    // Optional location for per-location inventory. Null = global stock.
+    public Guid? LocationId { get; set; }
+    public Location? Location { get; set; }
 
     public decimal QtyOnHand { get; set; } = 0m;
     public decimal? MinQty { get; set; }
 }