-- Check if suppliers exist
SELECT COUNT(*) as total_suppliers FROM "Suppliers";

-- List all suppliers
SELECT "Id", "Name", "Code", "City", "IsActive", "IsPreferred" 
FROM "Suppliers" 
ORDER BY "Name";

-- Count contacts
SELECT COUNT(*) as total_contacts FROM "SupplierContacts";
