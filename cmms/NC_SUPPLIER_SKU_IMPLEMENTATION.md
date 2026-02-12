# NC SUPPLIER SKU ALIGNMENT - IMPLEMENTATION SUMMARY

## OBIECTIV REALIZAT
Aliniere model SKU (intern vs furnizor) + auto-fill NC cu date catalog furnizor

## MODIFICĂRI BACKEND

### 1. Domain Model (Cmms.Domain/Nc.cs)
**NcOrderLine** - Adăugate câmpuri:
- `SupplierPartId?` - Link către catalog furnizor (nullable)
- `SupplierSku?` - Snapshot SKU furnizor la momentul comenzii
- `Currency?` - Snapshot valută la momentul comenzii

### 2. Database Migration
**Migration:** `20260209215414_NcOrderLine_SupplierPartLink`
- Adăugat `SupplierPartId` cu FK către `supplier_parts`
- Adăugat `SupplierSku` varchar(100)
- Adăugat `Currency` varchar(10)
- FK cu `OnDelete(DeleteBehavior.SetNull)` pentru a permite ștergerea catalog fără a afecta NC-urile istorice

### 3. AppDbContext (Cmms.Infrastructure/AppDbContext.cs)
- Configurat relația `NcOrderLine.SupplierPart`
- Unique constraint pe `SupplierPart(SupplierId, PartId)` - **DEJA EXISTENT**

### 4. DTOs (Cmms.Api/Contracts/NcDtos.cs)
**NcOrderLineDto** - Adăugate:
- `SupplierPartId?`
- `SupplierSku?`
- `Currency?`

**SaveNcOrderLineReq** - Adăugate:
- `SupplierPartId?`
- `SupplierSku?`
- `Currency?`

### 5. Controllers

#### SuppliersController (Cmms.Api/Controllers/SuppliersController.cs)
**NOU Endpoint:**
```
GET /api/suppliers/{supplierId}/parts/lookup?partId={partId}
```
**Autorizare:** `Perm:SUPPLIER_PARTS_READ`

**Response:**
```json
{
  "exists": true,
  "supplierPartId": "guid",
  "supplierSku": "SUPP-SKU-123",
  "unitPrice": 45.50,
  "currency": "RON",
  "leadTimeDays": 7,
  "moq": 10,
  "discountPercent": 5,
  "notes": "..."
}
```

Dacă nu există în catalog:
```json
{
  "exists": false
}
```

#### NcController (Cmms.Api/Controllers/NcController.cs)
**Modificat:**
- `AddLine` - Acceptă și salvează `SupplierPartId`, `SupplierSku`, `Currency`
- `UpdateLine` - Acceptă și salvează `SupplierPartId`, `SupplierSku`, `Currency`
- `GetDetails` - Include în response `SupplierPartId`, `SupplierSku`, `Currency` + Include SupplierPart navigation

## MODIFICĂRI FRONTEND

### 1. API Types (cmms-frontend/src/api/nc.ts)
**NcOrderLineDto** - Adăugate:
- `supplierPartId?`
- `supplierSku?`
- `currency?`

**SaveNcOrderLineReq** - Adăugate:
- `supplierPartId?`
- `supplierSku?`
- `currency?`

### 2. Suppliers API (cmms-frontend/src/api/suppliers.ts)
**NOU Method:**
```typescript
lookupPartCatalog: (supplierId: string, partId: string) => Promise<{
    exists: boolean;
    supplierPartId?: string;
    supplierSku?: string;
    unitPrice?: number;
    currency?: string;
    leadTimeDays?: number;
    moq?: number;
    discountPercent?: number;
    notes?: string;
}>
```

### 3. NC Details Page (cmms-frontend/src/pages/NcDetailsPage.tsx)
**TREBUIE IMPLEMENTAT:**
- Disable "Add Line" până când Supplier este selectat
- La adăugare linie:
  1. User selectează Part din master (active only)
  2. Call `suppliersApi.lookupPartCatalog(supplierId, partId)`
  3. Dacă `exists: true` → auto-fill: `supplierSku`, `unitPrice`, `currency`, `leadTimeDays`
  4. Dacă `exists: false` → afișează warning "⚠️ Piesa nu are catalog la acest furnizor" + permite manual entry
- Tabel linii NC:
  - Coloană `InternalSku` (Part.Code)
  - Coloană `SupplierSku`
  - Coloană `Currency` (per linie, poate diferi de header)

## REGULI BUSINESS

### SKU Model
- **Part.Code** = Internal SKU (cod intern unic)
- **SupplierPart.SupplierSku** = SKU furnizor (poate diferi între furnizori)
- **NcOrderLine.SupplierSku** = Snapshot SKU furnizor la momentul comenzii

### NC Workflow
1. **Selectare Furnizor** - OBLIGATORIU înainte de adăugare linii
2. **Adăugare Linie:**
   - Search piese din master (active only)
   - Lookup în catalog furnizor
   - Auto-fill dacă există în catalog
   - Warning dacă nu există în catalog
3. **Snapshot Values:**
   - `SupplierSku`, `UnitPrice`, `Currency`, `LeadTimeDays` sunt snapshot-uri
   - Se păstrează chiar dacă catalogul se modifică ulterior

### Unique Constraints
- `SupplierPart(SupplierId, PartId)` - UNIQUE (deja implementat)
- Un furnizor poate avea doar un SKU per piesă

## TESTING MANUAL

### Test 1: Part cu 2 furnizori, SKU-uri diferite

**Setup:**
1. Part: "Rulment 6205" (Code: "RUL-6205")
2. Supplier A: "TEHNO-PARTS SRL"
   - SupplierPart: SupplierSku="TP-RUL-6205", Price=45 RON
3. Supplier B: "GLOBAL LOGISTICS S.A."
   - SupplierPart: SupplierSku="GL-BEARING-6205", Price=42 EUR

**Test Steps:**
1. Create NC pentru Supplier A
2. Add line → Select "Rulment 6205"
3. **Verify:** Auto-fill cu SupplierSku="TP-RUL-6205", Price=45, Currency=RON
4. Save line
5. **Verify în tabel:** InternalSku="RUL-6205", SupplierSku="TP-RUL-6205"

6. Create NC pentru Supplier B
7. Add line → Select "Rulment 6205"
8. **Verify:** Auto-fill cu SupplierSku="GL-BEARING-6205", Price=42, Currency=EUR
9. Save line
10. **Verify în tabel:** InternalSku="RUL-6205", SupplierSku="GL-BEARING-6205"

### Test 2: Part fără catalog la furnizor

**Setup:**
1. Part: "Piuliță M8" (Code: "PIU-M8")
2. Supplier: "TOOLS & EQUIPMENT SRL"
3. NO SupplierPart entry

**Test Steps:**
1. Create NC pentru "TOOLS & EQUIPMENT SRL"
2. Add line → Select "Piuliță M8"
3. **Verify:** Warning "⚠️ Piesa nu are catalog la acest furnizor"
4. **Verify:** SupplierSku, Price, Currency sunt goale
5. Manual entry: SupplierSku="TOOLS-PIU-M8", Price=0.50, Currency=RON
6. Save line
7. **Verify în tabel:** InternalSku="PIU-M8", SupplierSku="TOOLS-PIU-M8"

### Test 3: Supplier selection required

**Test Steps:**
1. Create NC fără să selectezi Supplier
2. **Verify:** "Add Line" button este disabled
3. **Verify:** Tooltip/message "Selectați mai întâi furnizorul"
4. Select Supplier
5. **Verify:** "Add Line" button devine enabled

### Test 4: Snapshot preservation

**Setup:**
1. Part: "Filtru Ulei" (Code: "FIL-001")
2. Supplier: "BEARING SOLUTIONS SRL"
3. SupplierPart: SupplierSku="BS-FIL-001", Price=25 RON

**Test Steps:**
1. Create NC, add line cu "Filtru Ulei"
2. **Verify:** SupplierSku="BS-FIL-001", Price=25
3. Save NC
4. **În Suppliers page:** Edit catalog → Change SupplierSku="BS-FILTER-001", Price=30
5. **Verify în NC:** SupplierSku rămâne "BS-FIL-001", Price rămâne 25 (snapshot)

### Test 5: Display în tabel NC

**Verify columns:**
- Internal SKU (Part.Code)
- Denumire (Part.Name sau PartNameManual)
- Supplier SKU (NcOrderLine.SupplierSku)
- UM
- Qty
- Unit Price
- Currency (per linie)
- Lead Time
- Total

## API ENDPOINTS SUMMARY

### Existing (Modified)
- `POST /api/nc/{id}/lines` - Acceptă `supplierPartId`, `supplierSku`, `currency`
- `PUT /api/nc/{id}/lines/{lineId}` - Acceptă `supplierPartId`, `supplierSku`, `currency`
- `GET /api/nc/{id}` - Returnează `supplierPartId`, `supplierSku`, `currency` în linii

### New
- `GET /api/suppliers/{supplierId}/parts/lookup?partId={partId}` - Lookup catalog

## PERMISSIONS
- `NC_READ` - View NC
- `NC_UPDATE` - Add/Edit/Delete lines
- `SUPPLIER_PARTS_READ` - Lookup catalog

## NO BREAKING CHANGES
✅ Toate câmpurile noi sunt nullable
✅ NC-uri existente continuă să funcționeze
✅ Backward compatible cu frontend vechi (ignoră câmpurile noi)
✅ Migration adaugă doar coloane noi, nu modifică existente

## BUILD STATUS
✅ Backend: Compiled successfully (0 errors, 9 warnings)
✅ Migration: Applied successfully
✅ Database: Schema updated

## NEXT STEPS - FRONTEND
1. Update `NcDetailsPage.tsx`:
   - Add supplier selection validation
   - Implement lookup on part selection
   - Add auto-fill logic
   - Add warning for missing catalog
   - Update table columns to show InternalSku + SupplierSku
2. Test all scenarios
3. Update documentation

## FILES MODIFIED

### Backend (7 files)
1. `Cmms.Domain/Nc.cs` - Domain model
2. `Cmms.Infrastructure/AppDbContext.cs` - EF configuration
3. `Cmms.Infrastructure/Migrations/20260209215414_NcOrderLine_SupplierPartLink.cs` - Migration
4. `Cmms.Api/Contracts/NcDtos.cs` - DTOs
5. `Cmms.Api/Controllers/NcController.cs` - NC endpoints
6. `Cmms.Api/Controllers/SuppliersController.cs` - Lookup endpoint

### Frontend (2 files)
1. `cmms-frontend/src/api/nc.ts` - TypeScript types
2. `cmms-frontend/src/api/suppliers.ts` - Lookup API

### Frontend TODO (1 file)
1. `cmms-frontend/src/pages/NcDetailsPage.tsx` - UI implementation

---

**Implementation Date:** 2026-02-09
**Status:** ✅ Backend Complete | ⏳ Frontend Pending
**Breaking Changes:** None
