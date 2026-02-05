--- a/Cmms.Api\Controllers/WorkOrdersController.cs
+++ b/Cmms.Api\Controllers/WorkOrdersController.cs
@@
-        var inv = await _db.InventoryItems
-            .FirstOrDefaultAsync(x => x.PartId == req.PartId && x.LocationId == locId);
+        var inv = await _db.Inventory
+            .FirstOrDefaultAsync(x => x.PartId == req.PartId && x.LocationId == locId);
 
         if (inv == null)
         {
             inv = new InventoryItem
             {
                 PartId = req.PartId,
-                LocationId = locId,
+                LocationId = locId,
                 QtyOnHand = 0m,
                 MinQty = null
             };
-            _db.InventoryItems.Add(inv);
+            _db.Inventory.Add(inv);
             await _db.SaveChangesAsync();
         }
 
@@
-        var inv = await _db.InventoryItems
-            .FirstOrDefaultAsync(x => x.PartId == row.PartId && x.LocationId == locId);
+        var inv = await _db.Inventory
+            .FirstOrDefaultAsync(x => x.PartId == row.PartId && x.LocationId == locId);
 
         if (inv == null)
         {
             inv = new InventoryItem
             {
                 PartId = row.PartId,
-                LocationId = locId,
+                LocationId = locId,
                 QtyOnHand = 0m,
                 MinQty = null
             };
-            _db.InventoryItems.Add(inv);
+            _db.Inventory.Add(inv);
             await _db.SaveChangesAsync();
         }
 
@@
-        var inv = await _db.InventoryItems
-            .FirstOrDefaultAsync(x => x.PartId == row.PartId && x.LocationId == locId);
+        var inv = await _db.Inventory
+            .FirstOrDefaultAsync(x => x.PartId == row.PartId && x.LocationId == locId);
 
         if (inv == null)
         {
             inv = new InventoryItem
             {
                 PartId = row.PartId,
-                LocationId = locId,
+                LocationId = locId,
                 QtyOnHand = 0m,
                 MinQty = null
             };
-            _db.InventoryItems.Add(inv);
+            _db.Inventory.Add(inv);
             await _db.SaveChangesAsync();
         }