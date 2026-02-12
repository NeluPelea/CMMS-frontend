# HOW TO TEST SUPPLIER SEEDING

## Quick Start

### Option 1: Fresh Database (Recommended)
If you want to start completely fresh:

```sql
-- Connect to PostgreSQL database
TRUNCATE TABLE "SupplierContacts" CASCADE;
TRUNCATE TABLE "SupplierParts" CASCADE;
TRUNCATE TABLE "Suppliers" RESTART IDENTITY CASCADE;
```

Then restart the backend API in Development mode.

---

### Option 2: Drop Existing Suppliers Only
If you want to keep other data but re-seed suppliers:

```sql
-- Connect to PostgreSQL database
DELETE FROM "SupplierContacts";
DELETE FROM "SupplierParts";
DELETE FROM "Suppliers";
```

Then restart the backend API in Development mode.

---

## Step-by-Step Testing

### 1. Prepare Database
Choose one of the options above to clear existing supplier data.

### 2. Start Backend API
```powershell
cd E:\CMMS\cmms\Cmms.Api
dotnet run
```

### 3. Watch Console Output
You should see:
```
info: DevDataSeeder[0]
      Seeding 10 complete suppliers with contacts...
info: DevDataSeeder[0]
      Successfully seeded 10 suppliers with contacts:
info: DevDataSeeder[0]
        1. TEHNO-PARTS SRL (București) - 3 contacts
      ... (continues for all 10)
info: DevDataSeeder[0]
      Total: 8 active, 2 inactive | 3 preferred | 26 total contacts
```

### 4. Verify in Frontend
1. Start frontend: `cd E:\CMMS\cmms\cmms-frontend && npm run dev`
2. Navigate to **Furnizori** page
3. You should see 10 suppliers listed

### 5. Test Filters
- **All:** Should show 8 suppliers (active only by default)
- **Activ:** Should show 8 suppliers
- **Inactiv:** Should show 2 suppliers (AUTOMATION TECH, PRECISION PARTS)
- **Favorit:** Should show 3 suppliers (TEHNO-PARTS, GLOBAL LOGISTICS, ELECTRO-INDUSTRIAL)

### 6. Test Supplier Details
Click on any supplier to verify:
- **General Tab:**
  - All fields populated (Name, Code, Website, Notes)
  - Active/Inactive pill correct
  - Favorite star for preferred suppliers
  - City displayed

- **Date Firmă Tab:**
  - TaxId/CUI populated
  - RegCom populated
  - Full address (AddressLine1, City, County, Country, PostalCode)
  - Payment terms
  - Currency
  - IBAN and Bank Name

- **Contacte Tab:**
  - 2-4 contacts per supplier
  - Each contact has FullName, RoleTitle, Email, Phone
  - Exactly 1 contact marked as Primary (IsPrimary badge)
  - All contacts active for active suppliers
  - All contacts inactive for inactive suppliers

- **Catalog Piese Tab:**
  - Empty (no parts associated yet)
  - Can test part association feature

---

## Expected Results

### Supplier List View
```
✓ 10 suppliers total
✓ 8 active (default view)
✓ 2 inactive (AUTOMATION TECH, PRECISION PARTS)
✓ 3 with favorite star (TEHNO-PARTS, GLOBAL LOGISTICS, ELECTRO-INDUSTRIAL)
✓ All have city displayed
✓ All have website logo placeholder
```

### Supplier Details View
```
✓ All general fields populated
✓ All company data fields populated
✓ 2-4 contacts per supplier
✓ Each supplier has exactly 1 primary contact
✓ All emails unique
✓ All phones unique
✓ All IBANs unique
```

---

## Verification Queries

### Count Suppliers
```sql
SELECT COUNT(*) FROM "Suppliers";
-- Expected: 10
```

### Count Active/Inactive
```sql
SELECT "IsActive", COUNT(*) 
FROM "Suppliers" 
GROUP BY "IsActive";
-- Expected: true=8, false=2
```

### Count Preferred
```sql
SELECT COUNT(*) FROM "Suppliers" WHERE "IsPreferred" = true;
-- Expected: 3
```

### Count Contacts
```sql
SELECT COUNT(*) FROM "SupplierContacts";
-- Expected: 26
```

### Verify Primary Contacts
```sql
SELECT s."Name", COUNT(sc."Id") as primary_contacts
FROM "Suppliers" s
LEFT JOIN "SupplierContacts" sc ON s."Id" = sc."SupplierId" AND sc."IsPrimary" = true
GROUP BY s."Id", s."Name"
ORDER BY s."Name";
-- Expected: Each supplier should have exactly 1 primary contact
```

### List All Suppliers with Contact Count
```sql
SELECT 
    s."Name",
    s."City",
    s."IsActive",
    s."IsPreferred",
    COUNT(sc."Id") as contact_count
FROM "Suppliers" s
LEFT JOIN "SupplierContacts" sc ON s."Id" = sc."SupplierId"
GROUP BY s."Id", s."Name", s."City", s."IsActive", s."IsPreferred"
ORDER BY s."Name";
```

---

## Troubleshooting

### Seeding Doesn't Run
**Problem:** Console doesn't show seeding messages

**Solutions:**
1. Check environment is Development:
   ```json
   // appsettings.Development.json should be used
   ```
2. Verify `ASPNETCORE_ENVIRONMENT=Development` is set
3. Check if suppliers already exist (seeding is idempotent)

### Duplicate Key Errors
**Problem:** Error about duplicate TaxId, Email, Phone, or IBAN

**Solution:**
- Clear all supplier data completely before re-seeding
- Use TRUNCATE instead of DELETE to reset sequences

### Missing Contacts
**Problem:** Suppliers appear but no contacts

**Solution:**
- Check foreign key constraints
- Verify transaction completed successfully
- Check for errors in console logs

### Frontend Doesn't Show Suppliers
**Problem:** Backend seeded successfully but frontend shows empty list

**Solutions:**
1. Check API endpoint: `GET http://localhost:5000/api/suppliers`
2. Verify CORS is configured correctly
3. Check browser console for errors
4. Verify user has `SUPPLIERS_READ` permission

---

## Re-seeding

To re-seed (e.g., after testing modifications):

1. **Stop backend API** (Ctrl+C)
2. **Clear supplier data:**
   ```sql
   TRUNCATE TABLE "SupplierContacts" CASCADE;
   TRUNCATE TABLE "SupplierParts" CASCADE;
   TRUNCATE TABLE "Suppliers" RESTART IDENTITY CASCADE;
   ```
3. **Restart backend API:** `dotnet run`
4. **Verify in console** that seeding runs
5. **Refresh frontend** to see new data

---

## Production Note

⚠️ **IMPORTANT:** This seeding only runs in **Development** environment.

In Production:
- Seeding is automatically skipped
- Real supplier data should be entered through the UI or imported
- Never use test data in production

---

## Summary

✅ **What Was Implemented:**
- 10 complete suppliers with all fields populated
- 26 total contacts (2-4 per supplier)
- Realistic but fictional data
- Unique values for all critical fields
- Proper primary contact designation
- Geographic diversity (10 different Romanian cities)
- Currency diversity (RON and EUR)
- Active/Inactive status variety
- Preferred supplier designation

✅ **Files Modified:**
- `Cmms.Api/Seed/DevDataSeeder.cs` - Enhanced `TrySeedSuppliersAsync()` method

✅ **Testing:**
- Backend builds successfully ✓
- Seeding is idempotent ✓
- All data validated ✓
- Ready for frontend testing ✓

---

**Next Steps:**
1. Clear existing supplier data (if any)
2. Restart backend API
3. Verify seeding in console logs
4. Test in frontend UI
5. Verify all features work with seeded data

**Documentation:**
- See `SUPPLIER_SEED_DATA.md` for complete list of seeded suppliers
- See `SUPPLIER_EDIT_IMPLEMENTATION.md` for edit feature details
- See `SUPPLIER_EDIT_TEST_CHECKLIST.md` for comprehensive testing
