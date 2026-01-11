using System;
using System.Collections;
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

            // Ruleaza doar in Development (ca sa nu polueze productia)
            if (!env.IsDevelopment())
            {
                log.LogInformation("DevDataSeeder skipped (env is not Development).");
                return;
            }

            var db = sp.GetRequiredService<AppDbContext>();

            // Asigura schema (nu strica daca e deja up-to-date)
            await db.Database.MigrateAsync();

            // 1) Seed admin user + rol (optional)
            await TrySeedAdminUserAsync(sp, log);

            // 2) Seed Locations / Assets / WorkOrders (prin metadata)
            var locEntity = FindEntity(db, log,
                clrNames: new[] { "Loc", "Location", "LocEntity" },
                tableNames: new[] { "locs", "locations", "Locs", "Locations" });

            var assetEntity = FindEntity(db, log,
                clrNames: new[] { "Asset", "As", "AssetEntity" },
                tableNames: new[] { "as", "assets", "As", "Assets" });

            var woEntity = FindEntity(db, log,
                clrNames: new[] { "WorkOrder", "WorkOrders", "Wo", "WorkOrderEntity" },
                tableNames: new[] { "work_orders", "workorders", "WorkOrders", "work_orders" });

            // Seed Locations
            object? loc1 = null, loc2 = null, loc3 = null;
            if (locEntity != null)
            {
                if (!await AnyAsync(db, locEntity))
                {
                    log.LogInformation("Seeding Locations...");

                    loc1 = CreateEntity(locEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Hala 1",
                        ["Denumire"] = "Hala 1",
                        ["Code"] = "H1",
                        ["Cod"] = "H1",
                        ["IsAct"] = true,
                        ["IsActive"] = true
                    });

                    loc2 = CreateEntity(locEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Hala 2",
                        ["Denumire"] = "Hala 2",
                        ["Code"] = "H2",
                        ["Cod"] = "H2",
                        ["IsAct"] = true,
                        ["IsActive"] = true
                    });

                    loc3 = CreateEntity(locEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Depozit",
                        ["Denumire"] = "Depozit",
                        ["Code"] = "DEP",
                        ["Cod"] = "DEP",
                        ["IsAct"] = true,
                        ["IsActive"] = true
                    });

                    db.Add(loc1);
                    db.Add(loc2);
                    db.Add(loc3);
                    await db.SaveChangesAsync();
                }
                else
                {
                    log.LogInformation("Locations already exist; skipping.");
                }

                var locs = await TakeAsync(db, locEntity, 3);
                loc1 = locs.ElementAtOrDefault(0);
                loc2 = locs.ElementAtOrDefault(1);
                loc3 = locs.ElementAtOrDefault(2);
            }

            // Seed Assets
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
                        ["Denumire"] = "Profilare Tabla",
                        ["Code"] = "AS-PRF-01",
                        ["Cod"] = "AS-PRF-01",
                        ["LocId"] = loc1Id,
                        ["LocationId"] = loc1Id,
                        ["IsAct"] = true,
                        ["IsActive"] = true
                    });

                    as2 = CreateEntity(assetEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Debitare",
                        ["Denumire"] = "Debitare",
                        ["Code"] = "AS-DEB-01",
                        ["Cod"] = "AS-DEB-01",
                        ["LocId"] = loc1Id,
                        ["LocationId"] = loc1Id,
                        ["IsAct"] = true,
                        ["IsActive"] = true
                    });

                    as3 = CreateEntity(assetEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Ambalare",
                        ["Denumire"] = "Ambalare",
                        ["Code"] = "AS-AMB-01",
                        ["Cod"] = "AS-AMB-01",
                        ["LocId"] = loc2Id,
                        ["LocationId"] = loc2Id,
                        ["IsAct"] = true,
                        ["IsActive"] = true
                    });

                    as4 = CreateEntity(assetEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Name"] = "Stivuitor",
                        ["Denumire"] = "Stivuitor",
                        ["Code"] = "AS-STV-01",
                        ["Cod"] = "AS-STV-01",
                        ["LocId"] = loc2Id,
                        ["LocationId"] = loc2Id,
                        ["IsAct"] = true,
                        ["IsActive"] = true
                    });

                    db.Add(as1);
                    db.Add(as2);
                    db.Add(as3);
                    db.Add(as4);
                    await db.SaveChangesAsync();
                }
                else
                {
                    log.LogInformation("Assets already exist; skipping.");
                }

                var assets = await TakeAsync(db, assetEntity, 4);
                as1 = assets.ElementAtOrDefault(0);
                as2 = assets.ElementAtOrDefault(1);
                as3 = assets.ElementAtOrDefault(2);
                as4 = assets.ElementAtOrDefault(3);
            }

            // Seed Work Orders
            if (woEntity != null)
            {
                if (!await AnyAsync(db, woEntity))
                {
                    log.LogInformation("Seeding WorkOrders...");

                    var as1Id = GetPropValue(as1, "Id");
                    var as2Id = GetPropValue(as2, "Id");

                    var now = DateTime.UtcNow;

                    var wo1 = CreateEntity(woEntity.ClrType, new Dictionary<string, object?>
                    {
                        // titlu/denumire
                        ["Title"] = "Verificare zgomot anormal",
                        ["DenInt"] = "Verificare zgomot anormal",

                        // descriere
                        ["Description"] = "Inspectie rapida + lubrifiere, daca este cazul.",
                        ["Descriere"] = "Inspectie rapida + lubrifiere, daca este cazul.",

                        // tip/status (enum/int)
                        ["Type"] = 1,
                        ["Tip"] = 1,
                        ["Status"] = 1,

                        // legatura asset/utilaj
                        ["AssetId"] = as1Id,
                        ["AsId"] = as1Id,
                        ["ID_Utilaj"] = as1Id,

                        // date/ore
                        ["StartAt"] = now.AddMinutes(-45),
                        ["StartDT"] = now.AddMinutes(-45),
                        ["Start"] = now.AddMinutes(-45),

                        ["StopAt"] = now.AddMinutes(-15),
                        ["StopDT"] = now.AddMinutes(-15),
                        ["Stop"] = now.AddMinutes(-15)
                    });

                    var wo2 = CreateEntity(woEntity.ClrType, new Dictionary<string, object?>
                    {
                        ["Title"] = "Preventiv saptamanal - debitare",
                        ["DenInt"] = "Preventiv saptamanal - debitare",

                        ["Description"] = "Curatare, verificare role, verificare senzor stop.",
                        ["Descriere"] = "Curatare, verificare role, verificare senzor stop.",

                        ["Type"] = 2,
                        ["Tip"] = 2,
                        ["Status"] = 1,

                        ["AssetId"] = as2Id,
                        ["AsId"] = as2Id,
                        ["ID_Utilaj"] = as2Id,

                        ["StartAt"] = now.AddDays(-1).AddMinutes(-30),
                        ["StartDT"] = now.AddDays(-1).AddMinutes(-30),
                        ["Start"] = now.AddDays(-1).AddMinutes(-30),

                        ["StopAt"] = now.AddDays(-1),
                        ["StopDT"] = now.AddDays(-1),
                        ["Stop"] = now.AddDays(-1)
                    });

                    db.Add(wo1);
                    db.Add(wo2);
                    await db.SaveChangesAsync();
                }
                else
                {
                    log.LogInformation("WorkOrders already exist; skipping.");
                }
            }

            log.LogInformation("DevDataSeeder finished.");
        }

        private static async Task TrySeedAdminUserAsync(IServiceProvider sp, ILogger log)
        {
            // Safe: daca nu exista Identity in DI sau e user type custom, nu blocam seed-ul.
            try
            {
                var userManager = sp.GetService<UserManager<IdentityUser>>();
                var roleManager = sp.GetService<RoleManager<IdentityRole>>();

                if (userManager == null)
                {
                    log.LogWarning("UserManager<IdentityUser> not registered. Skipping admin user seed.");
                    return;
                }

                const string adminEmail = "admin@cmms.local";
                const string adminPassword = "Admin@12345";

                IdentityUser? user = await userManager.FindByEmailAsync(adminEmail);
                if (user == null)
                {
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
                else
                {
                    log.LogInformation("Admin user already exists: {Email}", adminEmail);
                }

                if (roleManager != null)
                {
                    const string adminRole = "Admin";
                    if (!await roleManager.RoleExistsAsync(adminRole))
                    {
                        var r = await roleManager.CreateAsync(new IdentityRole(adminRole));
                        if (!r.Succeeded)
                        {
                            var msg = string.Join("; ", r.Errors.Select(e => $"{e.Code}:{e.Description}"));
                            log.LogWarning("Admin role create failed: {Msg}", msg);
                        }
                    }

                    if (!await userManager.IsInRoleAsync(user, adminRole))
                        await userManager.AddToRoleAsync(user, adminRole);
                }
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
                    if (value is string s) p.SetValue(obj, Enum.Parse(targetType, s, true));
                    else p.SetValue(obj, Enum.ToObject(targetType, value));
                    return;
                }

                if (targetType == typeof(Guid))
                {
                    if (value is Guid) { p.SetValue(obj, value); return; }
                    if (value is string gs && Guid.TryParse(gs, out var g)) { p.SetValue(obj, g); return; }
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
                // ignore (seed "best effort")
            }
        }

        private static object? GetPropValue(object? obj, string propName)
        {
            if (obj == null) return null;
            var p = obj.GetType().GetProperty(propName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            return p?.GetValue(obj);
        }

        // -------------- IMPORTANT: fara DbContext.Set(Type) pentru Any (evitam complet ambiguitati) --------------

        private static async Task<bool> AnyAsync(AppDbContext db, IEntityType entity)
        {
            var table = entity.GetTableName();
            if (string.IsNullOrWhiteSpace(table))
                return false;

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

            // DbContext.Set<T>() fara parametri (nu poate ajunge la overload-ul cu string)
            var setMethod = typeof(DbContext).GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .First(m => m.Name == "Set" && m.IsGenericMethodDefinition && m.GetParameters().Length == 0)
                .MakeGenericMethod(clr);

            var setObj = setMethod.Invoke(db, null); // DbSet<T>
            var queryable = (IQueryable)setObj!;

            // AsNoTracking<T>
            var asNoTracking = typeof(EntityFrameworkQueryableExtensions).GetMethods(BindingFlags.Public | BindingFlags.Static)
                .First(m => m.Name == "AsNoTracking" && m.GetParameters().Length == 1)
                .MakeGenericMethod(clr);

            queryable = (IQueryable)asNoTracking.Invoke(null, new object[] { queryable })!;

            // Take<T>
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
