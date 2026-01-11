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
    }
}
