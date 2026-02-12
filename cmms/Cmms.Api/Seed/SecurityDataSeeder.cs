using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;

namespace Cmms.Api.Seed;

public static class SecurityDataSeeder
{
    public static async Task SeedAsync(AppDbContext db, IHostEnvironment env, IConfiguration config)
    {
        // 1. Seed Permissions
        var permissions = GetPermissions();
        var existingPerms = await db.Permissions.ToListAsync();
        foreach (var p in permissions)
        {
            if (!existingPerms.Any(x => x.Code == p.Code))
            {
                db.Permissions.Add(p);
            }
        }
        await db.SaveChangesAsync();

        // 2. Seed Roles
        var roles = GetRoles();
        var existingRoles = await db.Roles.ToListAsync();
        foreach (var r in roles)
        {
            if (!existingRoles.Any(x => x.Code == r.Code))
            {
                db.Roles.Add(r);
            }
        }
        await db.SaveChangesAsync();

        // 3. Role-Permissions Defaults
        var allPerms = await db.Permissions.ToListAsync();
        var allRoles = await db.Roles.Include(r => r.RolePermissions).ToListAsync();

        foreach (var role in allRoles)
        {
            var defaultCodes = GetDefaultPermissionsForRole(role.Code, allPerms);
            foreach (var code in defaultCodes)
            {
                var perm = allPerms.FirstOrDefault(p => p.Code == code);
                if (perm != null && !role.RolePermissions.Any(rp => rp.PermissionId == perm.Id))
                {
                    db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = perm.Id });
                }
            }
        }
        await db.SaveChangesAsync();

            // 4. Bootstrap Admin (Development only)
            if (env.IsDevelopment())
            {
                var adminUsername = config["BootstrapAdmin:Username"] ?? "admin";
                var adminPassword = config["BootstrapAdmin:Password"] ?? "Admin123!";

                var r0Role = allRoles.First(r => r.Code == "R0_SYSTEM_ADMIN");
                var adminUser = await db.Users.FirstOrDefaultAsync(u => u.Username == adminUsername);
                var hasher = new PasswordHasher<User>();

                if (adminUser == null)
                {
                    adminUser = new User
                    {
                        Username = adminUsername,
                        DisplayName = "Bootstrap Admin",
                        IsActive = true,
                        MustChangePassword = true
                    };
                    
                    adminUser.PasswordHash = hasher.HashPassword(adminUser, adminPassword);
                    
                    db.Users.Add(adminUser);
                    await db.SaveChangesAsync();
                    
                    db.UserRoles.Add(new UserRole { UserId = adminUser.Id, RoleId = r0Role.Id });
                    await db.SaveChangesAsync();
                }
                else
                {
                    // Update password to match config in Dev
                    adminUser.PasswordHash = hasher.HashPassword(adminUser, adminPassword);
                    adminUser.IsActive = true;
                    adminUser.MustChangePassword = true;
                    
                    // Ensure they have the R0 role
                    if (!await db.UserRoles.AnyAsync(ur => ur.UserId == adminUser.Id && ur.RoleId == r0Role.Id))
                    {
                        db.UserRoles.Add(new UserRole { UserId = adminUser.Id, RoleId = r0Role.Id });
                    }
                    
                    await db.SaveChangesAsync();
                }
            }
    }

    private static List<Permission> GetPermissions()
    {
        var list = new List<Permission>();
        
        // SECURITY
        Add(list, "SECURITY", "SECURITY_USERS_READ", "Vizualizare utilizatori");
        Add(list, "SECURITY", "SECURITY_USERS_CREATE", "Creare utilizatori");
        Add(list, "SECURITY", "SECURITY_USERS_UPDATE", "Editare utilizatori");
        Add(list, "SECURITY", "SECURITY_USERS_DISABLE", "Dezactivare utilizatori");
        Add(list, "SECURITY", "SECURITY_USERS_RESET_PASSWORD", "Resetare parola utilizatori");
        Add(list, "SECURITY", "SECURITY_ROLES_READ", "Vizualizare roluri");
        Add(list, "SECURITY", "SECURITY_ROLES_CREATE", "Creare roluri");
        Add(list, "SECURITY", "SECURITY_ROLES_UPDATE", "Editare roluri");
        Add(list, "SECURITY", "SECURITY_ROLES_DELETE", "Stergere roluri");
        Add(list, "SECURITY", "SECURITY_PERMISSIONS_READ", "Vizualizare permisiuni");
        Add(list, "SECURITY", "SECURITY_PERMISSIONS_ASSIGN", "Atribuire permisiuni (overrides)");
        Add(list, "SECURITY", "SECURITY_AUDIT_READ", "Vizualizare audit securitate");

        // DASHBOARD
        Add(list, "DASHBOARD", "DASHBOARD_VIEW", "Vizualizare Dashboard General");
        Add(list, "DASHBOARD", "DASHBOARD_VIEW_PRODUCTION", "Vizualizare Dashboard Productie");
        Add(list, "DASHBOARD", "DASHBOARD_VIEW_LOGISTICS", "Vizualizare Dashboard Logistica");

        // WORK ORDERS
        Add(list, "WORK_ORDERS", "WO_READ", "Vizualizare Comenzi de Lucru");
        Add(list, "WORK_ORDERS", "WO_CREATE", "Creare Comenzi de Lucru");
        Add(list, "WORK_ORDERS", "WO_UPDATE", "Editare Comenzi de Lucru");
        Add(list, "WORK_ORDERS", "WO_DELETE", "Stergere Comenzi de Lucru");
        Add(list, "WORK_ORDERS", "WO_EXECUTE", "Executie Comenzi de Lucru (Start/Stop)");
        Add(list, "WORK_ORDERS", "WO_APPROVE_CLOSE", "Aprobare si inchidere Comenzi de Lucru");

        // ASSETS
        Add(list, "ASSETS", "ASSET_READ", "Vizualizare Utilaje");
        Add(list, "ASSETS", "ASSET_CREATE", "Creare Utilaje");
        Add(list, "ASSETS", "ASSET_UPDATE", "Editare Utilaje");
        Add(list, "ASSETS", "ASSET_DELETE", "Stergere Utilaje");

        // LOCATIONS
        Add(list, "LOCATIONS", "LOC_READ", "Vizualizare Locatii");
        Add(list, "LOCATIONS", "LOC_CREATE", "Creare Locatii");
        Add(list, "LOCATIONS", "LOC_UPDATE", "Editare Locatii");
        Add(list, "LOCATIONS", "LOC_DELETE", "Stergere Locatii");

        // PM PLANS
        Add(list, "PM_PLANS", "PM_READ", "Vizualizare Planuri Mentenanta");
        Add(list, "PM_PLANS", "PM_CREATE", "Creare Planuri Mentenanta");
        Add(list, "PM_PLANS", "PM_UPDATE", "Editare Planuri Mentenanta");
        Add(list, "PM_PLANS", "PM_DELETE", "Stergere Planuri Mentenanta");
        Add(list, "PM_PLANS", "PM_EXECUTE", "Generare WO din Planuri");

        // PARTS / INVENTORY
        Add(list, "PARTS_INV", "PART_READ", "Vizualizare Piese");
        Add(list, "PARTS_INV", "PART_CREATE", "Creare Piese");
        Add(list, "PARTS_INV", "PART_UPDATE", "Editare Piese");
        Add(list, "PARTS_INV", "PART_DELETE", "Stergere Piese");
        Add(list, "PARTS_INV", "INV_READ", "Vizualizare Stocuri");
        Add(list, "PARTS_INV", "INV_ADJUST", "Ajustare Stocuri");

        // REPORTS
        Add(list, "REPORTS", "REPORTS_VIEW", "Vizualizare Rapoarte");
        Add(list, "REPORTS", "REPORTS_EXPORT", "Export Rapoarte");

        // SETTINGS / TEMPLATES / CALENDAR
        Add(list, "SETTINGS", "SETTINGS_READ", "Vizualizare Setari");
        Add(list, "SETTINGS", "SETTINGS_UPDATE", "Editare Setari");
        Add(list, "SETTINGS", "TEMPLATES_READ", "Vizualizare Template-uri");
        Add(list, "SETTINGS", "TEMPLATES_UPDATE", "Editare Template-uri");
        Add(list, "SETTINGS", "CALENDAR_READ", "Vizualizare Calendar");
        Add(list, "SETTINGS", "CALENDAR_UPDATE", "Editare Calendar");

        // INTEGRATIONS
        Add(list, "INTEGRATIONS", "INTEGRATIONS_READ", "Vizualizare Integrari");
        Add(list, "INTEGRATIONS", "INTEGRATIONS_UPDATE", "Editare Integrari");

        // NC (Nota de Comanda)
        Add(list, "NC_ORDERS", "NC_READ", "Vizualizare Nota de Comanda");
        Add(list, "NC_ORDERS", "NC_CREATE", "Creare Nota de Comanda");
        Add(list, "NC_ORDERS", "NC_UPDATE", "Editare Nota de Comanda");
        Add(list, "NC_ORDERS", "NC_CANCEL", "Anulare Nota de Comanda");
        Add(list, "NC_ORDERS", "NC_ATTACHMENTS_UPDATE", "Gestionare atasamente NC");
        Add(list, "NC_ORDERS", "NC_PDF_GENERATE", "Generare PDF Nota de Comanda");

        // SUPPLIERS
        Add(list, "SUPPLIERS", "SUPPLIERS_READ", "Vizualizare furnizori");
        Add(list, "SUPPLIERS", "SUPPLIERS_CREATE", "Creare furnizori");
        Add(list, "SUPPLIERS", "SUPPLIERS_UPDATE", "Editare furnizori");
        Add(list, "SUPPLIERS", "SUPPLIERS_DELETE", "Stergere (dezactivare) furnizori");
        Add(list, "SUPPLIERS", "SUPPLIER_CONTACTS_UPDATE", "Gestionare contacte furnizori");
        Add(list, "SUPPLIERS", "SUPPLIER_PARTS_READ", "Vizualizare catalog piese furnizori");
        Add(list, "SUPPLIERS", "SUPPLIER_PARTS_UPDATE", "Gestionare catalog piese furnizori");

        return list;
    }

    private static void Add(List<Permission> list, string group, string code, string name)
    {
        list.Add(new Permission { Code = code, Name = name, GroupName = group });
    }

    private static List<Role> GetRoles()
    {
        return new List<Role>
        {
            new Role { Code = "R0_SYSTEM_ADMIN", Name = "System Admin", Rank = 0, Description = "Full control over the system.", IsSystem = true },
            new Role { Code = "R1_ADMIN_OP", Name = "Admin Operațional", Rank = 1, Description = "Master data and operational administration.", IsSystem = true },
            new Role { Code = "R2_SUPERVISOR", Name = "Supervisor / Manager Mentenanță", Rank = 2, Description = "Maintenance oversight and approvals.", IsSystem = true },
            new Role { Code = "R3_PLANNER", Name = "Planner / Tehnician senior", Rank = 3, Description = "Planning and advanced technical execution.", IsSystem = true },
            new Role { Code = "R4_OPERATOR", Name = "Operator / Tehnician execuție", Rank = 4, Description = "Basic work order execution.", IsSystem = true },
            new Role { Code = "R5_VIEWER", Name = "Viewer", Rank = 5, Description = "Read-only access to most parts of the system.", IsSystem = true },
            new Role { Code = "R6_PROD_DIRECTOR", Name = "Director producție", Rank = 6, Description = "Production-specific access and dashboard.", IsSystem = true },
            new Role { Code = "R7_BACK_OFFICE", Name = "Back Office / Logistică", Rank = 7, Description = "Logistics-specific access and dashboard.", IsSystem = true }
        };
    }

    private static List<string> GetDefaultPermissionsForRole(string roleCode, List<Permission> allPerms)
    {
        if (roleCode == "R0_SYSTEM_ADMIN")
            return allPerms.Select(p => p.Code).ToList();

        var codes = new List<string>();

        switch (roleCode)
        {
            case "R1_ADMIN_OP":
                // master data
                codes.AddRange(new[] { 
                    "ASSET_READ", "ASSET_CREATE", "ASSET_UPDATE",
                    "LOC_READ", "LOC_CREATE", "LOC_UPDATE",
                    "PART_READ", "PART_CREATE", "PART_UPDATE",
                    "INV_READ"
                });
                // settings/templates/calendar
                codes.AddRange(new[] { 
                    "SETTINGS_READ", "SETTINGS_UPDATE", 
                    "TEMPLATES_READ", "TEMPLATES_UPDATE", 
                    "CALENDAR_READ", "CALENDAR_UPDATE" 
                });
                // WO create/update
                codes.AddRange(new[] { "WO_READ", "WO_CREATE", "WO_UPDATE" });
                // reports export
                codes.AddRange(new[] { "REPORTS_VIEW", "REPORTS_EXPORT" });
                // integrations read
                codes.Add("INTEGRATIONS_READ");
                // NC
                codes.AddRange(new[] {
                    "NC_READ", "NC_CREATE", "NC_UPDATE", "NC_CANCEL", "NC_ATTACHMENTS_UPDATE", "NC_PDF_GENERATE"
                });
                // Suppliers
                codes.AddRange(new[] {
                    "SUPPLIERS_READ", "SUPPLIERS_CREATE", "SUPPLIERS_UPDATE", "SUPPLIERS_DELETE", 
                    "SUPPLIER_CONTACTS_UPDATE", "SUPPLIER_PARTS_READ", "SUPPLIER_PARTS_UPDATE"
                });
                break;

            case "R2_SUPERVISOR":
                codes.AddRange(allPerms.Select(p => p.Code).Where(c => !c.Contains("SECURITY") && !c.Contains("INTEGRATIONS")));
                break;

            case "R3_PLANNER":
                codes.AddRange(new[] { "DASHBOARD_VIEW", "WO_READ", "WO_CREATE", "WO_UPDATE", "WO_EXECUTE", "PM_READ", "PM_EXECUTE", "REPORTS_VIEW" });
                break;

            case "R4_OPERATOR":
                codes.AddRange(new[] { "DASHBOARD_VIEW", "WO_READ", "WO_EXECUTE" });
                break;

            case "R5_VIEWER":
                codes.AddRange(new[] { "DASHBOARD_VIEW", "WO_READ", "ASSET_READ", "LOC_READ", "PM_READ", "PART_READ", "INV_READ", "REPORTS_VIEW" });
                break;

            case "R6_PROD_DIRECTOR":
                codes.AddRange(new[] { "DASHBOARD_VIEW", "DASHBOARD_VIEW_PRODUCTION", "WO_READ", "WO_CREATE", "WO_UPDATE", "REPORTS_VIEW" });
                break;

            case "R7_BACK_OFFICE":
                codes.AddRange(new[] { 
                    "DASHBOARD_VIEW", "DASHBOARD_VIEW_LOGISTICS", "WO_READ", "REPORTS_VIEW", "PART_READ", "INV_READ", 
                    "NC_READ", "NC_CREATE", "NC_UPDATE", "NC_PDF_GENERATE",
                    "SUPPLIERS_READ", "SUPPLIERS_CREATE", "SUPPLIERS_UPDATE", "SUPPLIERS_DELETE", 
                    "SUPPLIER_CONTACTS_UPDATE", "SUPPLIER_PARTS_READ", "SUPPLIER_PARTS_UPDATE"
                });
                break;
        }

        return codes.Distinct().ToList();
    }
}
