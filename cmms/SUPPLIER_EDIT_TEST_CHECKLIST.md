# SUPPLIER EDIT - MANUAL TEST CHECKLIST

## Pre-requisites
- Backend API running on configured port
- Frontend dev server running
- User logged in with SUPPLIERS_UPDATE and SUPPLIER_PARTS_UPDATE permissions
- At least one supplier in database
- At least one part in database not yet associated with test supplier

---

## TEST 1: Edit General Data ✅

### Steps:
1. Navigate to Suppliers page
2. Click on any supplier in the list
3. Click on "General" tab (should be default)
4. Click "Editează Date Generale" button

**Expected:**
- Form appears with editable fields
- All current values populated
- Checkboxes show current Active/Favorite state

5. Make the following changes:
   - Change Name to "Test Supplier Updated"
   - Change Code to "TEST-001"
   - Change WebsiteUrl to "example.com" (without https://)
   - Toggle IsActive checkbox
   - Toggle IsPreferred checkbox
   - Add text to Notes: "Test note from manual testing"

6. Click "Salvează Date Generale"

**Expected:**
- Form closes and returns to view mode
- All changes visible immediately
- WebsiteUrl shows with https:// prefix
- Active/Favorite pills update
- Supplier list on left updates (city, favorite star)

7. Refresh the page (F5)

**Expected:**
- All changes persisted
- Data loads correctly from database

8. Try to save with empty name

**Expected:**
- Alert: "Numele furnizorului trebuie să aibă minim 2 caractere."
- Form remains in edit mode

---

## TEST 2: Inline Edit Catalog Part ✅

### Steps:
1. Navigate to supplier with at least one part
2. Click "Catalog Piese" tab
3. Find a part in the table
4. Click "Editează" button on that row

**Expected:**
- Row enters edit mode
- Inline inputs appear for:
  - SupplierSku (text)
  - LastUnitPrice (number)
  - Currency (text)
  - LeadTimeDays (number)
- Current values populated in inputs
- Save (checkmark) and Cancel (X) buttons appear

5. Make changes:
   - SupplierSku: "SKU-TEST-123"
   - LastUnitPrice: "99.50"
   - Currency: "EUR"
   - LeadTimeDays: "7"

6. Click checkmark (save) button

**Expected:**
- Row exits edit mode
- Changes visible immediately
- Values formatted correctly (price with 2 decimals)

7. Refresh page

**Expected:**
- Changes persisted
- LastPriceUpdatedAt updated (if price changed)

8. Click "Editează" again, then click X (cancel)

**Expected:**
- Row exits edit mode
- No changes saved
- Original values remain

---

## TEST 3: Search and Associate Part ✅

### Steps:
1. Navigate to supplier
2. Click "Catalog Piese" tab
3. Click "+ Asociază Piesă" button

**Expected:**
- Search section expands
- Search input visible with placeholder

4. Type a part name (e.g., "Bearing") slowly

**Expected:**
- Loading spinner appears after 400ms
- Results dropdown appears with matching parts
- Each result shows "CODE — NAME" format
- Parts already associated are NOT shown

5. Type a part code/SKU instead

**Expected:**
- Search works by code too
- Results update

6. Click on a result

**Expected:**
- Dropdown closes
- Selected part displays in a form
- Part name and code shown
- Form fields appear:
  - SKU Furnizor
  - Preț Unitar
  - Monedă (pre-filled with supplier default)
  - Lead Time (zile)
  - Note

7. Fill in the form:
   - SKU Furnizor: "SUPP-BEAR-001"
   - Preț Unitar: "125.00"
   - Monedă: "RON"
   - Lead Time: "14"
   - Note: "Test association"

8. Click "Asociază"

**Expected:**
- Form closes
- New part appears in catalog table
- All entered data visible

9. Refresh page

**Expected:**
- Association persisted
- Part still in catalog

10. Try to search for the same part again

**Expected:**
- Part no longer appears in search results (already associated)

---

## TEST 4: Responsive Design ✅

### Steps:
1. Open browser DevTools
2. Toggle device toolbar (mobile view)
3. Set to iPhone SE (375px width)
4. Navigate through all tabs

**Expected - General Tab Edit:**
- Form fields stack vertically
- All inputs full-width
- Checkboxes readable
- Save/Cancel buttons accessible

**Expected - Catalog Tab Search:**
- Search input full-width
- Dropdown results scrollable
- Selected part form fields stack
- All inputs accessible

**Expected - Catalog Tab Inline Edit:**
- Inline inputs sized appropriately
- No horizontal overflow
- Save/Cancel buttons visible

5. Resize to tablet (768px)

**Expected:**
- Layout adjusts smoothly
- Grid columns adapt (sm: breakpoints)

6. Resize to desktop (1024px+)

**Expected:**
- Full layout with all columns
- Optimal spacing

---

## TEST 5: Validation & Error Handling ✅

### Steps:

**Test 5.1: Name Validation**
1. Edit general data
2. Clear name field
3. Click save

**Expected:**
- Alert: "Numele furnizorului trebuie să aibă minim 2 caractere."

4. Enter single character "A"
5. Click save

**Expected:**
- Alert: "Numele furnizorului trebuie să aibă minim 2 caractere."

6. Enter "AB"
7. Click save

**Expected:**
- Saves successfully

**Test 5.2: Price Parsing**
1. Inline edit a part
2. Enter invalid price: "abc"
3. Save

**Expected:**
- Backend handles gracefully (undefined/null)
- No crash

**Test 5.3: Network Error**
1. Stop backend API
2. Try to save general data

**Expected:**
- Alert with error message
- Form remains in edit mode
- No data lost

3. Restart backend
4. Try again

**Expected:**
- Saves successfully

---

## TEST 6: No Breaking Changes ✅

### Steps:
1. Verify all existing functionality still works:

**Supplier List:**
- [x] Search by name works
- [x] Filter by Active/Inactive works
- [x] Filter by Favorite works
- [x] Click supplier loads details
- [x] Favorite star toggle works
- [x] Logo displays (if website set)

**Supplier Details:**
- [x] All tabs accessible
- [x] Company Data tab unchanged
- [x] Contacts tab unchanged
- [x] Can add/edit/delete contacts
- [x] Can view parts catalog

**Other Pages:**
- [x] Navigate to other pages (Assets, Work Orders, etc.)
- [x] No console errors
- [x] No broken links

---

## TEST 7: Data Persistence & Refresh ✅

### Steps:
1. Make changes in General tab
2. Navigate to Contacts tab
3. Navigate back to General tab

**Expected:**
- Changes still visible (not lost)

4. Make changes in Catalog tab (inline edit)
5. Navigate away and back

**Expected:**
- Changes still visible

6. Make multiple changes across tabs
7. Refresh entire page (F5)

**Expected:**
- All changes persisted
- Data loads from database correctly

---

## TEST 8: Concurrent Editing (Edge Case)

### Steps:
1. Open supplier in two browser tabs
2. In Tab 1: Edit general data, change name to "Supplier A"
3. In Tab 2: Edit general data, change name to "Supplier B"
4. Save Tab 1
5. Save Tab 2

**Expected:**
- Last save wins (Tab 2)
- No errors
- Both tabs can refresh to see latest data

---

## TEST 9: Performance

### Steps:
1. Associate 50+ parts with a supplier
2. Navigate to Catalog tab

**Expected:**
- Table loads quickly
- Scrolling smooth
- Inline edit responsive

3. Search for parts with many results

**Expected:**
- Search completes in < 1 second
- Results limited to 20 (as per code)
- No lag in typing

---

## PASS CRITERIA

All tests must pass with:
- ✅ No console errors
- ✅ No TypeScript compilation errors (in SuppliersPage.tsx)
- ✅ No network errors (except intentional Test 5.3)
- ✅ Data persists correctly
- ✅ UI responsive on all screen sizes
- ✅ No breaking changes to existing features

---

## KNOWN ISSUES / LIMITATIONS

1. **Debounce delay**: 400ms might feel slow for very fast typers (acceptable tradeoff)
2. **Search limit**: 20 results max (prevents UI overload, acceptable)
3. **Concurrent editing**: Last save wins (standard behavior, no locking)
4. **TypeScript errors in other files**: SecurityRolesPage and SecurityUsersPage have unrelated errors

---

## REGRESSION TEST

After all tests pass, verify these critical paths:

1. **Create new supplier** → Edit general → Associate parts → Verify all data
2. **Existing supplier** → Edit all tabs → Verify no data loss
3. **Mobile workflow** → Complete all operations on mobile view
4. **Permissions** → Test with user without SUPPLIERS_UPDATE (should not see edit buttons)

---

## SIGN-OFF

- [ ] All tests passed
- [ ] No regressions found
- [ ] Performance acceptable
- [ ] Ready for production

Tested by: _______________
Date: _______________
Notes: _______________
