using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Cmms.Api.Services;

public class SecurityService
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;

    public SecurityService(AppDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<List<string>> GetEffectivePermissionsAsync(Guid userId)
    {
        var cacheKey = $"perms_{userId}";
        if (_cache.TryGetValue(cacheKey, out List<string>? cachedPerms) && cachedPerms != null)
        {
            return cachedPerms;
        }

        var user = await _db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .Include(u => u.PermissionOverrides)
                .ThenInclude(po => po.Permission)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) return new List<string>();

        List<string> result;

        // If user has R0, they get everything (Rank 0 bypass)
        if (user.UserRoles.Any(ur => ur.Role.Rank == 0 || ur.Role.Code == "R0_SYSTEM_ADMIN"))
        {
            result = await _db.Permissions.Select(p => p.Code).ToListAsync();
        }
        else
        {
            var permissions = new HashSet<string>();

            // 1. Inherited via roles
            foreach (var ur in user.UserRoles)
            {
                foreach (var rp in ur.Role.RolePermissions)
                {
                    permissions.Add(rp.Permission.Code);
                }
            }

            // 2. Overrides
            foreach (var over in user.PermissionOverrides)
            {
                if (over.IsGranted)
                {
                    permissions.Add(over.Permission.Code);
                }
                else
                {
                    permissions.Remove(over.Permission.Code);
                }
            }
            result = permissions.ToList();
        }

        // Cache for 5 minutes
        _cache.Set(cacheKey, result, TimeSpan.FromMinutes(5));
        return result;
    }

    public void ClearUserCache(Guid userId)
    {
        _cache.Remove($"perms_{userId}");
    }
}
