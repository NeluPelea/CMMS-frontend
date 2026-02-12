-- CLEAR ALL SUPPLIERS AND RE-SEED
-- This will delete all existing suppliers and allow DevDataSeeder to create the 10 new ones

-- Step 1: Delete all supplier-related data
DELETE FROM "SupplierParts";
DELETE FROM "SupplierContacts";
DELETE FROM "Suppliers";

-- Step 2: Reset sequences (optional, for clean IDs)
-- ALTER SEQUENCE "Suppliers_Id_seq" RESTART WITH 1;
-- ALTER SEQUENCE "SupplierContacts_Id_seq" RESTART WITH 1;
-- ALTER SEQUENCE "SupplierParts_Id_seq" RESTART WITH 1;

-- Step 3: Verify deletion
SELECT COUNT(*) as suppliers_count FROM "Suppliers";
SELECT COUNT(*) as contacts_count FROM "SupplierContacts";
SELECT COUNT(*) as parts_count FROM "SupplierParts";

-- Expected result: All counts should be 0
-- After running this, restart the backend API and it will seed 10 new suppliers
