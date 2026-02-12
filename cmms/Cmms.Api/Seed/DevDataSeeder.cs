using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Cmms.Infrastructure;

namespace Cmms.Api.Seed
{
    public static class DevDataSeeder
    {
        public static async Task SeedAsync(IServiceProvider services)
        {
            using var scope = services.CreateScope();
            var sp = scope.ServiceProvider;

            var env = sp.GetRequiredService<IHostEnvironment>();
            var log = sp.GetRequiredService<ILoggerFactory>().CreateLogger("DevDataSeeder");

            if (!env.IsDevelopment())
            {
                log.LogInformation("DevDataSeeder skipped (env is not Development).");
                return;
            }

            var db = sp.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync();

            await TrySeedAdminUserAsync(sp, log);
            await TrySeedSuppliersAsync(db, log);

            // --- discover entities by CLR/table ---
            var locEntity = FindEntity(db, log,
                clrNames: new[] { "Loc", "Location", "LocEntity" },
                tableNames: new[] { "locs", "locations", "Locs", "Locations" });

            var assetEntity = FindEntity(db, log,
                clrNames: new[] { "Asset", "As", "AssetEntity" },
                tableNames: new[] { "as", "assets", "As", "Assets" });

            var peopleEntity = FindEntity(db, log,
                clrNames: new[] { "Person", "People", "PersonEntity" },
                tableNames: new[] { "people", "Persons", "People", "People" });

            var woEntity = FindEntity(db, log,
                clrNames: new[] { "WorkOrder", "WorkOrders", "Wo", "WorkOrderEntity" },
                tableNames: new[] { "work_orders", "workorders", "WorkOrders", "WorkOrders" });

            // ---------------- Locations ----------------
            object? loc1 = null, loc2 = null, loc3 = null;

            if (locEntity != null)
            {
                if (!await AnyAsync(db, locEntity))
                {
                    log.LogInformation("Seeding Locations...");

                    loc1 = CreateEntity(locEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Hala 1",
                        ["Code"] = "H1",
                        ["IsAct"] = true
                    });

                    loc2 = CreateEntity(locEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Hala 2",
                        ["Code"] = "H2",
                        ["IsAct"] = true
                    });

                    loc3 = CreateEntity(locEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Depozit",
                        ["Code"] = "DEP",
                        ["IsAct"] = true
                    });

                    db.Add(loc1);
                    db.Add(loc2);
                    db.Add(loc3);
                    await db.SaveChangesAsync();
                }

                var locs = await TakeAsync(db, locEntity, 3);
                loc1 = locs.ElementAtOrDefault(0);
                loc2 = locs.ElementAtOrDefault(1);
                loc3 = locs.ElementAtOrDefault(2);
            }

            // ---------------- Assets ----------------
            object? as1 = null, as2 = null, as3 = null, as4 = null;

            if (assetEntity != null)
            {
                if (!await AnyAsync(db, assetEntity))
                {
                    log.LogInformation("Seeding Assets...");

                    var loc1Id = GetPropValue(loc1, "Id");
                    var loc2Id = GetPropValue(loc2, "Id");

                    as1 = CreateEntity(assetEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Profilare Tabla",
                        ["Code"] = "AS-PRF-01",
                        ["LocationId"] = loc1Id,
                        ["LocId"] = loc1Id,
                        ["IsAct"] = true
                    });

                    as2 = CreateEntity(assetEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Debitare",
                        ["Code"] = "AS-DEB-01",
                        ["LocationId"] = loc1Id,
                        ["LocId"] = loc1Id,
                        ["IsAct"] = true
                    });

                    as3 = CreateEntity(assetEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Ambalare",
                        ["Code"] = "AS-AMB-01",
                        ["LocationId"] = loc2Id,
                        ["LocId"] = loc2Id,
                        ["IsAct"] = true
                    });

                    as4 = CreateEntity(assetEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Stivuitor",
                        ["Code"] = "AS-STV-01",
                        ["LocationId"] = loc2Id,
                        ["LocId"] = loc2Id,
                        ["IsAct"] = true
                    });

                    db.Add(as1);
                    db.Add(as2);
                    db.Add(as3);
                    db.Add(as4);
                    await db.SaveChangesAsync();
                }

                var assets = await TakeAsync(db, assetEntity, 4);
                as1 = assets.ElementAtOrDefault(0);
                as2 = assets.ElementAtOrDefault(1);
                as3 = assets.ElementAtOrDefault(2);
                as4 = assets.ElementAtOrDefault(3);
            }

            // ---------------- People ----------------
            object? p1 = null, p2 = null, p3 = null;

            if (peopleEntity != null)
            {
                if (!await AnyAsync(db, peopleEntity))
                {
                    log.LogInformation("Seeding People...");

                    // Ajusteaza campurile daca modelul tau are alte nume (seed-ul e best-effort).
                    p1 = CreateEntity(peopleEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["DisplayName"] = "Mihai Mentenanta",
                        ["Name"] = "Mihai Mentenanta",
                        ["Email"] = "mihai@cmms.local",
                        ["IsAct"] = true
                    });

                    p2 = CreateEntity(peopleEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["DisplayName"] = "Ion Electrician",
                        ["Name"] = "Ion Electrician",
                        ["Email"] = "ion@cmms.local",
                        ["IsAct"] = true
                    });

                    p3 = CreateEntity(peopleEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["DisplayName"] = "Andrei Mecanic",
                        ["Name"] = "Andrei Mecanic",
                        ["Email"] = "andrei@cmms.local",
                        ["IsAct"] = true
                    });

                    db.Add(p1);
                    db.Add(p2);
                    db.Add(p3);
                    await db.SaveChangesAsync();
                }

                var people = await TakeAsync(db, peopleEntity, 3);
                p1 = people.ElementAtOrDefault(0);
                p2 = people.ElementAtOrDefault(1);
                p3 = people.ElementAtOrDefault(2);
            }
            else
            {
                log.LogWarning("People entity not found; skipping People seed.");
            }

            // ---------------- WorkOrders ----------------
            if (woEntity != null)
            {
                if (!await AnyAsync(db, woEntity))
                {
                    log.LogInformation("Seeding WorkOrders...");

                    var as1Id = GetPropValue(as1, "Id");
                    var as2Id = GetPropValue(as2, "Id");
                    var personId = GetPropValue(p1 ?? p2 ?? p3, "Id"); // first available

                    var now = DateTimeOffset.UtcNow;

                    // WO-OPEN (fara timpi)
                    var woOpenValues = new Dictionary<string, object?>
                    {
                        ["Title"] = "WO Open - verificare vizuala",
                        ["Description"] = "Test: work order fara start/stop.",
                        ["Type"] = 1,
                        ["AssetId"] = as1Id,
                        ["AssignedToPersonId"] = null,
                        ["StartAt"] = null,
                        ["StopAt"] = null
                    };
                    ApplyComputedFields(woEntity.ClrType, woOpenValues, null, null);

                    // WO-INPROGRESS (start, fara stop)
                    var startInProg = now.AddMinutes(-20);
                    var woInProgValues = new Dictionary<string, object?>
                    {
                        ["Title"] = "WO InProgress - interventie in curs",
                        ["Description"] = "Test: work order cu start, fara stop.",
                        ["Type"] = 1,
                        ["AssetId"] = as2Id,
                        ["AssignedToPersonId"] = personId,
                        ["StartAt"] = startInProg,
                        ["StopAt"] = null
                    };
                    ApplyComputedFields(woEntity.ClrType, woInProgValues, startInProg, null);

                    // WO-DONE (start + stop)
                    var startDone = now.AddMinutes(-45);
                    var stopDone = now.AddMinutes(-15);
                    var woDoneValues = new Dictionary<string, object?>
                    {
                        ["Title"] = "WO Done - preventiv finalizat",
                        ["Description"] = "Test: work order cu start/stop.",
                        ["Type"] = 2,
                        ["AssetId"] = as2Id,
                        ["AssignedToPersonId"] = personId,
                        ["StartAt"] = startDone,
                        ["StopAt"] = stopDone
                    };
                    ApplyComputedFields(woEntity.ClrType, woDoneValues, startDone, stopDone);

                    var woOpen = CreateEntity(woEntity.ClrType, woOpenValues);
                    var woInProg = CreateEntity(woEntity.ClrType, woInProgValues);
                    var woDone = CreateEntity(woEntity.ClrType, woDoneValues);

                    db.Add(woOpen);
                    db.Add(woInProg);
                    db.Add(woDone);

                    await db.SaveChangesAsync();

                }
            }

            log.LogInformation("DevDataSeeder finished.");
        }

        private static void ApplyComputedFields(Type woClrType, IDictionary<string, object?> values, DateTimeOffset? start, DateTimeOffset? stop)
        {
            // DurationMinutes (int?)
            var durationProp = woClrType.GetProperty("DurationMinutes", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (durationProp != null)
            {
                int? minutes = null;
                if (start.HasValue && stop.HasValue && stop.Value >= start.Value)
                    minutes = (int)Math.Round((stop.Value - start.Value).TotalMinutes);

                values["DurationMinutes"] = minutes;
            }

            // Status (enum WorkOrderStatus) - folosim string-uri: Open/InProgress/Done
            var statusProp = woClrType.GetProperty("Status", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (statusProp != null)
            {
                object statusValue;
                if (stop.HasValue) statusValue = "Done";
                else if (start.HasValue) statusValue = "InProgress";
                else statusValue = "Open";

                values["Status"] = statusValue;
            }
        }

        private static async Task TrySeedAdminUserAsync(IServiceProvider sp, ILogger log)
        {
            try
            {
                var userManager = sp.GetService<UserManager<IdentityUser>>();
                if (userManager == null)
                {
                    log.LogWarning("UserManager<IdentityUser> not registered. Skipping admin user seed.");
                    return;
                }

                const string adminEmail = "admin@cmms.local";
                const string adminPassword = "Admin@12345";

                var user = await userManager.FindByEmailAsync(adminEmail);
                if (user != null) return;

                user = new IdentityUser
                {
                    UserName = adminEmail,
                    Email = adminEmail,
                    EmailConfirmed = true
                };

                var res = await userManager.CreateAsync(user, adminPassword);
                if (!res.Succeeded)
                {
                    var msg = string.Join("; ", res.Errors.Select(e => $"{e.Code}:{e.Description}"));
                    log.LogWarning("Admin user creation failed: {Msg}", msg);
                    return;
                }

                log.LogInformation("Admin user created: {Email}", adminEmail);
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Admin user seed skipped due to exception.");
            }
        }

        private static IEntityType? FindEntity(AppDbContext db, ILogger log, string[] clrNames, string[] tableNames)
        {
            var entities = db.Model.GetEntityTypes().ToList();

            var byClr = entities.FirstOrDefault(e =>
                clrNames.Any(n => string.Equals(e.ClrType.Name, n, StringComparison.OrdinalIgnoreCase)));

            if (byClr != null)
            {
                log.LogInformation("Found entity by CLR name: {Clr} -> table {Tbl}",
                    byClr.ClrType.FullName, byClr.GetTableName());
                return byClr;
            }

            var byTbl = entities.FirstOrDefault(e =>
                tableNames.Any(t => string.Equals(e.GetTableName(), t, StringComparison.OrdinalIgnoreCase)));

            if (byTbl != null)
            {
                log.LogInformation("Found entity by table name: {Tbl} -> CLR {Clr}",
                    byTbl.GetTableName(), byTbl.ClrType.FullName);
                return byTbl;
            }

            log.LogWarning("Could not find entity. CLR candidates: [{ClrNames}] | Table candidates: [{TableNames}]",
                string.Join(", ", clrNames), string.Join(", ", tableNames));

            return null;
        }

        private static object CreateEntity(Type clrType, IDictionary<string, object?> values)
        {
            var obj = Activator.CreateInstance(clrType)
                      ?? throw new InvalidOperationException("Activator.CreateInstance returned null for " + clrType.FullName);

            foreach (var kv in values)
                SetIfExists(obj, kv.Key, kv.Value);

            return obj;
        }

        private static void SetIfExists(object obj, string propName, object? value)
        {
            var p = obj.GetType().GetProperty(propName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (p == null || !p.CanWrite) return;

            if (value == null)
            {
                if (!p.PropertyType.IsValueType || Nullable.GetUnderlyingType(p.PropertyType) != null)
                    p.SetValue(obj, null);
                return;
            }

            var targetType = Nullable.GetUnderlyingType(p.PropertyType) ?? p.PropertyType;

            try
            {
                if (targetType.IsEnum)
                {
                    if (value is string s) p.SetValue(obj, Enum.Parse(targetType, s, ignoreCase: true));
                    else p.SetValue(obj, Enum.ToObject(targetType, value));
                    return;
                }

                if (targetType == typeof(Guid))
                {
                    if (value is Guid) { p.SetValue(obj, value); return; }
                    if (value is string gs && Guid.TryParse(gs, out var g)) { p.SetValue(obj, g); return; }
                }

                if (targetType == typeof(DateTimeOffset))
                {
                    if (value is DateTimeOffset dto) { p.SetValue(obj, dto); return; }
                    if (value is DateTime dt)
                    {
                        if (dt.Kind == DateTimeKind.Unspecified)
                            dt = DateTime.SpecifyKind(dt, DateTimeKind.Utc);

                        p.SetValue(obj, new DateTimeOffset(dt.ToUniversalTime()));
                        return;
                    }
                    if (value is string s && DateTimeOffset.TryParse(s, out var parsed))
                    {
                        p.SetValue(obj, parsed.ToUniversalTime());
                        return;
                    }
                }

                if (targetType.IsAssignableFrom(value.GetType()))
                {
                    p.SetValue(obj, value);
                    return;
                }

                p.SetValue(obj, Convert.ChangeType(value, targetType));
            }
            catch
            {
                // silent
            }
        }

        private static object? GetPropValue(object? obj, string propName)
        {
            if (obj == null) return null;
            var p = obj.GetType().GetProperty(propName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            return p?.GetValue(obj);
        }

        private static async Task<bool> AnyAsync(AppDbContext db, IEntityType entity)
        {
            var table = entity.GetTableName();
            if (string.IsNullOrWhiteSpace(table)) return false;

            var schema = entity.GetSchema();
            var fq = string.IsNullOrWhiteSpace(schema)
                ? QuoteIdent(table)
                : $"{QuoteIdent(schema)}.{QuoteIdent(table)}";

            var sql = $"SELECT EXISTS(SELECT 1 FROM {fq} LIMIT 1);";

            await using var cmd = db.Database.GetDbConnection().CreateCommand();
            cmd.CommandText = sql;

            if (cmd.Connection!.State != ConnectionState.Open)
                await cmd.Connection.OpenAsync();

            var result = await cmd.ExecuteScalarAsync();
            return result is bool b && b;
        }

        private static async Task<IReadOnlyList<object>> TakeAsync(AppDbContext db, IEntityType entity, int take)
        {
            var clr = entity.ClrType;

            var setMethod = typeof(DbContext).GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .First(m => m.Name == "Set" && m.IsGenericMethodDefinition && m.GetParameters().Length == 0)
                .MakeGenericMethod(clr);

            var setObj = setMethod.Invoke(db, null); // DbSet<T>
            var queryable = (IQueryable)setObj!;

            var asNoTracking = typeof(EntityFrameworkQueryableExtensions).GetMethods(BindingFlags.Public | BindingFlags.Static)
                .First(m => m.Name == "AsNoTracking" && m.GetParameters().Length == 1)
                .MakeGenericMethod(clr);

            queryable = (IQueryable)asNoTracking.Invoke(null, new object[] { queryable })!;

            var idProp = clr.GetProperty("Id", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (idProp != null)
            {
                var param = System.Linq.Expressions.Expression.Parameter(clr, "x");
                var body = System.Linq.Expressions.Expression.Property(param, idProp);
                var lambda = System.Linq.Expressions.Expression.Lambda(body, param);

                var orderBy = typeof(Queryable).GetMethods(BindingFlags.Public | BindingFlags.Static)
                    .First(m => m.Name == "OrderBy" && m.GetParameters().Length == 2)
                    .MakeGenericMethod(clr, idProp.PropertyType);

                queryable = (IQueryable)orderBy.Invoke(null, new object[] { queryable, lambda })!;
            }

            var takeMethod = typeof(Queryable).GetMethods(BindingFlags.Public | BindingFlags.Static)
                .First(m => m.Name == "Take" && m.GetParameters().Length == 2)
                .MakeGenericMethod(clr);

            var taken = (IQueryable)takeMethod.Invoke(null, new object[] { queryable, take })!;

            var list = new List<object>();
            foreach (var item in taken)
                list.Add(item!);

            return await Task.FromResult<IReadOnlyList<object>>(list);
        }

        private static string QuoteIdent(string ident)
            => "\"" + ident.Replace("\"", "\"\"") + "\"";
        private static async Task TrySeedSuppliersAsync(AppDbContext db, ILogger log)
        {
            if (await db.Suppliers.AnyAsync())
            {
                log.LogInformation("Suppliers already exist, skipping seed.");
                return;
            }

            log.LogInformation("Seeding 10 complete suppliers with contacts...");

            var now = DateTime.UtcNow;

            // Supplier 1: TEHNO-PARTS SRL (Active, Preferred)
            var s1 = new Cmms.Domain.Supplier
            {
                Name = "TEHNO-PARTS SRL",
                Code = "TEHNO-001",
                IsActive = true,
                IsPreferred = true,
                WebsiteUrl = "https://www.tehno-parts.ro",
                TaxId = "RO11223344",
                RegCom = "J40/1234/2015",
                AddressLine1 = "Str. Industriala Nr. 10",
                City = "București",
                County = "Ilfov",
                Country = "România",
                PostalCode = "077190",
                PaymentTermsDays = 30,
                Currency = "RON",
                Iban = "RO49AAAA1B31007593840000",
                BankName = "BCR",
                Notes = "Distribuitor principal piese mecanice și componente industriale. Livrare rapidă.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s1.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Ionescu Maria", RoleTitle = "Manager Vânzări", Email = "maria.ionescu@tehno-parts.ro", Phone = "0722-111-222", IsPrimary = true, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s1.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Popescu Dan", RoleTitle = "Suport Tehnic", Email = "dan.popescu@tehno-parts.ro", Phone = "0722-111-223", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s1.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Georgescu Ana", RoleTitle = "Contabilitate", Email = "ana.georgescu@tehno-parts.ro", Phone = "0722-111-224", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s1);

            // Supplier 2: GLOBAL LOGISTICS S.A. (Active, Preferred)
            var s2 = new Cmms.Domain.Supplier
            {
                Name = "GLOBAL LOGISTICS S.A.",
                Code = "GLOBAL-002",
                IsActive = true,
                IsPreferred = true,
                WebsiteUrl = "https://www.global-logistics.com",
                TaxId = "RO99887766",
                RegCom = "J23/5678/2012",
                AddressLine1 = "Șos. București-Ploiești Km 15",
                City = "Otopeni",
                County = "Ilfov",
                Country = "România",
                PostalCode = "075100",
                PaymentTermsDays = 45,
                Currency = "EUR",
                Iban = "RO49BBBB1B31007593840001",
                BankName = "BRD",
                Notes = "Importator echipamente industriale. Prețuri competitive pentru comenzi mari.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s2.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Schmidt Klaus", RoleTitle = "Sales Director", Email = "klaus.schmidt@global-logistics.com", Phone = "0733-222-333", IsPrimary = true, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s2.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Dumitrescu Elena", RoleTitle = "Account Manager", Email = "elena.dumitrescu@global-logistics.com", Phone = "0733-222-334", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s2);

            // Supplier 3: ELECTRO-INDUSTRIAL SRL (Active, Preferred)
            var s3 = new Cmms.Domain.Supplier
            {
                Name = "ELECTRO-INDUSTRIAL SRL",
                Code = "ELECTRO-003",
                IsActive = true,
                IsPreferred = true,
                WebsiteUrl = "https://www.electro-industrial.ro",
                TaxId = "RO55667788",
                RegCom = "J35/9012/2018",
                AddressLine1 = "Calea Aradului Nr. 45",
                City = "Timișoara",
                County = "Timiș",
                Country = "România",
                PostalCode = "300645",
                PaymentTermsDays = 30,
                Currency = "RON",
                Iban = "RO49CCCC1B31007593840002",
                BankName = "ING Bank",
                Notes = "Specialist în componente electrice și automatizări. Garanție extinsă.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s3.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Moldovan Cristian", RoleTitle = "Director Comercial", Email = "cristian.moldovan@electro-industrial.ro", Phone = "0744-333-444", IsPrimary = true, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s3.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Rus Ioana", RoleTitle = "Inginer Vânzări", Email = "ioana.rus@electro-industrial.ro", Phone = "0744-333-445", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s3.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Popa Mihai", RoleTitle = "Service", Email = "mihai.popa@electro-industrial.ro", Phone = "0744-333-446", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s3.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Stan Laura", RoleTitle = "Facturare", Email = "laura.stan@electro-industrial.ro", Phone = "0744-333-447", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s3);

            // Supplier 4: HYDRAULIC SYSTEMS SRL (Active)
            var s4 = new Cmms.Domain.Supplier
            {
                Name = "HYDRAULIC SYSTEMS SRL",
                Code = "HYDRO-004",
                IsActive = true,
                IsPreferred = false,
                WebsiteUrl = "https://www.hydraulic-systems.ro",
                TaxId = "RO33445566",
                RegCom = "J10/3456/2016",
                AddressLine1 = "Bd. Republicii Nr. 88",
                City = "Brașov",
                County = "Brașov",
                Country = "România",
                PostalCode = "500030",
                PaymentTermsDays = 60,
                Currency = "EUR",
                Iban = "RO49DDDD1B31007593840003",
                BankName = "Raiffeisen Bank",
                Notes = "Furnizor sisteme hidraulice și pneumatice. Consultanță tehnică gratuită.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s4.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Vasilescu Adrian", RoleTitle = "CEO", Email = "adrian.vasilescu@hydraulic-systems.ro", Phone = "0755-444-555", IsPrimary = true, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s4.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Nistor Carmen", RoleTitle = "Ofertare", Email = "carmen.nistor@hydraulic-systems.ro", Phone = "0755-444-556", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s4);

            // Supplier 5: BEARING SOLUTIONS SRL (Active)
            var s5 = new Cmms.Domain.Supplier
            {
                Name = "BEARING SOLUTIONS SRL",
                Code = "BEARING-005",
                IsActive = true,
                IsPreferred = false,
                WebsiteUrl = "https://www.bearing-solutions.ro",
                TaxId = "RO77889900",
                RegCom = "J12/7890/2019",
                AddressLine1 = "Str. Fabricii Nr. 22",
                City = "Cluj-Napoca",
                County = "Cluj",
                Country = "România",
                PostalCode = "400632",
                PaymentTermsDays = 30,
                Currency = "RON",
                Iban = "RO49EEEE1B31007593840004",
                BankName = "UniCredit Bank",
                Notes = "Specialist rulmenți și transmisii. Stoc permanent pentru dimensiuni standard.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s5.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Mureșan Florin", RoleTitle = "Manager Vânzări", Email = "florin.muresan@bearing-solutions.ro", Phone = "0766-555-666", IsPrimary = true, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s5.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Todor Gabriela", RoleTitle = "Asistent Vânzări", Email = "gabriela.todor@bearing-solutions.ro", Phone = "0766-555-667", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s5.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Luca Andrei", RoleTitle = "Logistică", Email = "andrei.luca@bearing-solutions.ro", Phone = "0766-555-668", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s5);

            // Supplier 6: AUTOMATION TECH SRL (Inactive)
            var s6 = new Cmms.Domain.Supplier
            {
                Name = "AUTOMATION TECH SRL",
                Code = "AUTO-006",
                IsActive = false,
                IsPreferred = false,
                WebsiteUrl = "https://www.automation-tech.ro",
                TaxId = "RO22334455",
                RegCom = "J29/4567/2017",
                AddressLine1 = "Str. Petrolului Nr. 15",
                City = "Ploiești",
                County = "Prahova",
                Country = "România",
                PostalCode = "100089",
                PaymentTermsDays = 45,
                Currency = "EUR",
                Iban = "RO49FFFF1B31007593840005",
                BankName = "Alpha Bank",
                Notes = "Furnizor inactiv temporar - restructurare internă. Contact reactivare în T2 2026.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s6.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Dobre Sorin", RoleTitle = "Director General", Email = "sorin.dobre@automation-tech.ro", Phone = "0777-666-777", IsPrimary = true, IsActive = false, CreatedAt = now, UpdatedAt = now });
            s6.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Matei Raluca", RoleTitle = "Vânzări", Email = "raluca.matei@automation-tech.ro", Phone = "0777-666-778", IsPrimary = false, IsActive = false, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s6);

            // Supplier 7: TOOLS & EQUIPMENT SRL (Active)
            var s7 = new Cmms.Domain.Supplier
            {
                Name = "TOOLS & EQUIPMENT SRL",
                Code = "TOOLS-007",
                IsActive = true,
                IsPreferred = false,
                WebsiteUrl = "https://www.tools-equipment.ro",
                TaxId = "RO66778899",
                RegCom = "J13/2345/2020",
                AddressLine1 = "Bd. Tomis Nr. 255",
                City = "Constanța",
                County = "Constanța",
                Country = "România",
                PostalCode = "900178",
                PaymentTermsDays = 30,
                Currency = "RON",
                Iban = "RO49GGGG1B31007593840006",
                BankName = "CEC Bank",
                Notes = "Scule și echipamente pentru mentenanță. Reduceri pentru comenzi recurente.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s7.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Constantinescu Victor", RoleTitle = "Proprietar", Email = "victor.constantinescu@tools-equipment.ro", Phone = "0788-777-888", IsPrimary = true, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s7.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Barbu Simona", RoleTitle = "Vânzări", Email = "simona.barbu@tools-equipment.ro", Phone = "0788-777-889", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s7.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Enache Paul", RoleTitle = "Depozit", Email = "paul.enache@tools-equipment.ro", Phone = "0788-777-890", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s7);

            // Supplier 8: INDUSTRIAL SUPPLIES S.A. (Active)
            var s8 = new Cmms.Domain.Supplier
            {
                Name = "INDUSTRIAL SUPPLIES S.A.",
                Code = "INDSUP-008",
                IsActive = true,
                IsPreferred = false,
                WebsiteUrl = "https://www.industrial-supplies.ro",
                TaxId = "RO44556677",
                RegCom = "J05/6789/2014",
                AddressLine1 = "Str. Bihorului Nr. 33",
                City = "Oradea",
                County = "Bihor",
                Country = "România",
                PostalCode = "410605",
                PaymentTermsDays = 60,
                Currency = "EUR",
                Iban = "RO49HHHH1B31007593840007",
                BankName = "Banca Transilvania",
                Notes = "Distribuitor materiale consumabile industriale. Program de fidelizare.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s8.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Nagy Attila", RoleTitle = "Key Account Manager", Email = "attila.nagy@industrial-supplies.ro", Phone = "0799-888-999", IsPrimary = true, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s8.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Crișan Monica", RoleTitle = "Customer Service", Email = "monica.crisan@industrial-supplies.ro", Phone = "0799-888-990", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s8);

            // Supplier 9: PRECISION PARTS SRL (Inactive)
            var s9 = new Cmms.Domain.Supplier
            {
                Name = "PRECISION PARTS SRL",
                Code = "PREC-009",
                IsActive = false,
                IsPreferred = false,
                WebsiteUrl = "https://www.precision-parts.ro",
                TaxId = "RO88990011",
                RegCom = "J32/8901/2021",
                AddressLine1 = "Str. Fabricilor Nr. 7",
                City = "Sibiu",
                County = "Sibiu",
                Country = "România",
                PostalCode = "550005",
                PaymentTermsDays = 30,
                Currency = "RON",
                Iban = "RO49IIII1B31007593840008",
                BankName = "OTP Bank",
                Notes = "Furnizor suspendat - probleme de calitate. Re-evaluare în Q3 2026.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s9.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Stoica Radu", RoleTitle = "Manager Calitate", Email = "radu.stoica@precision-parts.ro", Phone = "0700-999-000", IsPrimary = true, IsActive = false, CreatedAt = now, UpdatedAt = now });
            s9.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Lungu Diana", RoleTitle = "Relații Clienți", Email = "diana.lungu@precision-parts.ro", Phone = "0700-999-001", IsPrimary = false, IsActive = false, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s9);

            // Supplier 10: SAFETY EQUIPMENT SRL (Active)
            var s10 = new Cmms.Domain.Supplier
            {
                Name = "SAFETY EQUIPMENT SRL",
                Code = "SAFETY-010",
                IsActive = true,
                IsPreferred = false,
                WebsiteUrl = "https://www.safety-equipment.ro",
                TaxId = "RO11223355",
                RegCom = "J26/1234/2022",
                AddressLine1 = "Str. Principală Nr. 100",
                City = "Târgu Mureș",
                County = "Mureș",
                Country = "România",
                PostalCode = "540139",
                PaymentTermsDays = 45,
                Currency = "RON",
                Iban = "RO49JJJJ1B31007593840009",
                BankName = "Garanti BBVA",
                Notes = "Echipamente de protecție și siguranță. Certificări ISO complete.",
                CreatedAt = now,
                UpdatedAt = now
            };
            s10.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Toma Alexandru", RoleTitle = "Director Vânzări", Email = "alexandru.toma@safety-equipment.ro", Phone = "0711-000-111", IsPrimary = true, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s10.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Marin Adriana", RoleTitle = "Specialist Produse", Email = "adriana.marin@safety-equipment.ro", Phone = "0711-000-112", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            s10.Contacts.Add(new Cmms.Domain.SupplierContact { FullName = "Badea Cosmin", RoleTitle = "Livrări", Email = "cosmin.badea@safety-equipment.ro", Phone = "0711-000-113", IsPrimary = false, IsActive = true, CreatedAt = now, UpdatedAt = now });
            db.Suppliers.Add(s10);

            await db.SaveChangesAsync();

            log.LogInformation("Successfully seeded 10 suppliers with contacts:");
            log.LogInformation("  1. TEHNO-PARTS SRL (București) - 3 contacts");
            log.LogInformation("  2. GLOBAL LOGISTICS S.A. (Otopeni) - 2 contacts");
            log.LogInformation("  3. ELECTRO-INDUSTRIAL SRL (Timișoara) - 4 contacts");
            log.LogInformation("  4. HYDRAULIC SYSTEMS SRL (Brașov) - 2 contacts");
            log.LogInformation("  5. BEARING SOLUTIONS SRL (Cluj-Napoca) - 3 contacts");
            log.LogInformation("  6. AUTOMATION TECH SRL (Ploiești) - 2 contacts [INACTIVE]");
            log.LogInformation("  7. TOOLS & EQUIPMENT SRL (Constanța) - 3 contacts");
            log.LogInformation("  8. INDUSTRIAL SUPPLIES S.A. (Oradea) - 2 contacts");
            log.LogInformation("  9. PRECISION PARTS SRL (Sibiu) - 2 contacts [INACTIVE]");
            log.LogInformation(" 10. SAFETY EQUIPMENT SRL (Târgu Mureș) - 3 contacts");
            log.LogInformation("Total: 8 active, 2 inactive | 3 preferred | 26 total contacts");
        }
    }
}
