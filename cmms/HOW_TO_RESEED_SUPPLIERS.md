# GHID: Cum să Obții Cei 10 Furnizori Seed-ați

## Situația Actuală
- ✅ Backend pornit
- ✅ Frontend pornit
- ❌ Ai doar 3 furnizori (GLOBAL LOGISTICS, RUFSTER, TEHNO-PARTS)
- ❌ Ar trebui să ai 10 furnizori

## De Ce Nu S-au Seed-at Cei 10 Furnizori?

DevDataSeeder verifică dacă există deja furnizori în baza de date:
```csharp
if (await db.Suppliers.AnyAsync())
{
    log.LogInformation("Suppliers already exist, skipping seed.");
    return;
}
```

Cum aveai deja 3 furnizori (probabil RUFSTER și alții vechi), seeding-ul nu a rulat.

---

## SOLUȚIE: Curăță și Re-Seed-ează

### Opțiunea 1: Folosind pgAdmin sau alt Client PostgreSQL

1. **Deschide pgAdmin** (sau alt client PostgreSQL)
2. **Conectează-te** la baza de date `cmms_db`
3. **Deschide Query Tool**
4. **Copiază și rulează** acest script:

```sql
-- Șterge toate datele furnizorilor
DELETE FROM "SupplierParts";
DELETE FROM "SupplierContacts";
DELETE FROM "Suppliers";

-- Verifică că s-au șters
SELECT COUNT(*) as suppliers_count FROM "Suppliers";
-- Ar trebui să returneze 0
```

5. **Oprește backend-ul** (Ctrl+C în terminal)
6. **Pornește din nou backend-ul**:
   ```powershell
   cd E:\CMMS\cmms\Cmms.Api
   dotnet run
   ```

7. **Verifică în console** că vezi:
   ```
   info: DevDataSeeder[0]
         Seeding 10 complete suppliers with contacts...
   info: DevDataSeeder[0]
         Successfully seeded 10 suppliers with contacts:
         1. TEHNO-PARTS SRL (București) - 3 contacts
         2. GLOBAL LOGISTICS S.A. (Otopeni) - 2 contacts
         ... (continues for all 10)
   ```

8. **Refresh pagina Furnizori** în browser (F5)

---

### Opțiunea 2: Folosind psql din Command Line

```powershell
# Găsește calea către psql.exe (de obicei în Program Files\PostgreSQL\XX\bin\)
# Înlocuiește XX cu versiunea ta de PostgreSQL

# Exemplu pentru PostgreSQL 16:
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d cmms_db

# Apoi în psql, rulează:
DELETE FROM "SupplierParts";
DELETE FROM "SupplierContacts";
DELETE FROM "Suppliers";

# Verifică:
SELECT COUNT(*) FROM "Suppliers";
# Ar trebui să returneze 0

# Ieși din psql:
\q
```

Apoi restart backend-ul ca la Opțiunea 1.

---

### Opțiunea 3: Păstrează Furnizorii Existenți și Adaugă Manual

Dacă vrei să **păstrezi** cei 3 furnizori existenți (RUFSTER, etc.) și să adaugi doar alți furnizori noi, trebuie să:

1. **Modifici** `DevDataSeeder.cs` să nu verifice dacă există furnizori
2. **Sau** adaugi manual furnizorii prin UI folosind feature-ul de editare

**NU RECOMAND** această opțiune pentru testare - e mai bine să ai datele consistente din seed.

---

## Ce Vei Vedea După Re-Seeding

### În Console (Backend):
```
info: DevDataSeeder[0]
      Seeding 10 complete suppliers with contacts...
info: DevDataSeeder[0]
      Successfully seeded 10 suppliers with contacts:
info: DevDataSeeder[0]
        1. TEHNO-PARTS SRL (București) - 3 contacts
info: DevDataSeeder[0]
        2. GLOBAL LOGISTICS S.A. (Otopeni) - 2 contacts
info: DevDataSeeder[0]
        3. ELECTRO-INDUSTRIAL SRL (Timișoara) - 4 contacts
info: DevDataSeeder[0]
        4. HYDRAULIC SYSTEMS SRL (Brașov) - 2 contacts
info: DevDataSeeder[0]
        5. BEARING SOLUTIONS SRL (Cluj-Napoca) - 3 contacts
info: DevDataSeeder[0]
        6. AUTOMATION TECH SRL (Ploiești) - 2 contacts [INACTIVE]
info: DevDataSeeder[0]
        7. TOOLS & EQUIPMENT SRL (Constanța) - 3 contacts
info: DevDataSeeder[0]
        8. INDUSTRIAL SUPPLIES S.A. (Oradea) - 2 contacts
info: DevDataSeeder[0]
        9. PRECISION PARTS SRL (Sibiu) - 2 contacts [INACTIVE]
info: DevDataSeeder[0]
       10. SAFETY EQUIPMENT SRL (Târgu Mureș) - 3 contacts
info: DevDataSeeder[0]
      Total: 8 active, 2 inactive | 3 preferred | 26 total contacts
```

### În UI (Pagina Furnizori):
- **Lista:** 8 furnizori activi (implicit)
- **Filtru "Inactiv":** 2 furnizori (AUTOMATION TECH, PRECISION PARTS)
- **Filtru "Favorit":** 3 furnizori cu steluță (TEHNO-PARTS, GLOBAL LOGISTICS, ELECTRO-INDUSTRIAL)
- **Total:** 10 furnizori

---

## Verificare Rapidă După Re-Seeding

### Test 1: Număr Total
- Click pe filtrul "Toți" → Ar trebui să vezi 10 furnizori

### Test 2: Activi vs Inactivi
- Filtru "Activ" → 8 furnizori
- Filtru "Inactiv" → 2 furnizori (AUTOMATION TECH SRL, PRECISION PARTS SRL)

### Test 3: Favoriți
- Filtru "Favorit" → 3 furnizori cu steluță ⭐:
  - TEHNO-PARTS SRL
  - GLOBAL LOGISTICS S.A.
  - ELECTRO-INDUSTRIAL SRL

### Test 4: Detalii Furnizor
Click pe orice furnizor și verifică:
- **Tab General:** Toate câmpurile completate
- **Tab Date Firmă:** CUI, RegCom, Adresă completă, IBAN, Bancă
- **Tab Contacte:** 2-4 contacte, fiecare cu rol, email, telefon
- **Tab Catalog Piese:** Gol (normal, nu am seed-at piese)

---

## Troubleshooting

### "Nu văd mesajele de seeding în console"
- Verifică că backend-ul rulează în **Development** mode
- Verifică `appsettings.Development.json` este folosit
- Log level-ul ar putea fi setat prea sus

### "Încă văd doar 3 furnizori după restart"
- Verifică că ai șters cu adevărat furnizorii din DB
- Rulează: `SELECT COUNT(*) FROM "Suppliers";` → ar trebui să fie 0 înainte de restart
- Verifică că nu ai erori în console la pornirea backend-ului

### "Backend nu pornește după ce am șters furnizorii"
- Nu ar trebui să fie o problemă - ștergerea nu afectează schema
- Verifică log-urile pentru erori specifice

---

## Rezumat - Pași Rapizi

1. ✅ **Deschide pgAdmin** sau psql
2. ✅ **Rulează:** `DELETE FROM "SupplierParts"; DELETE FROM "SupplierContacts"; DELETE FROM "Suppliers";`
3. ✅ **Oprește backend-ul** (Ctrl+C)
4. ✅ **Pornește backend-ul:** `dotnet run`
5. ✅ **Verifică console** pentru mesajele de seeding
6. ✅ **Refresh pagina Furnizori** (F5)
7. ✅ **Verifică** că ai 10 furnizori

---

**Timp estimat:** 2-3 minute

**Fișiere ajutătoare:**
- `clear_and_reseed_suppliers.sql` - Script SQL pentru curățare
- `SUPPLIER_SEED_DATA.md` - Lista completă a celor 10 furnizori
- `SUPPLIER_SEED_TESTING.md` - Ghid detaliat de testare
