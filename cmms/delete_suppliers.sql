DELETE FROM "SupplierParts";
DELETE FROM "SupplierContacts";
DELETE FROM "Suppliers";
SELECT COUNT(*) as remaining_suppliers FROM "Suppliers";
