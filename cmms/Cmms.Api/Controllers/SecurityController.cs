using Cmms.Api.Auth;
using Cmms.Api.Services;
using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/security")]
public class SecurityController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PasswordHasher<User> _hasher;
    private readonly SecurityService _securityService;
    private readonly JwtTokenService _jwt;

    public SecurityController(AppDbContext db, PasswordHasher<User> hasher, SecurityService securityService, JwtTokenService jwt)
    {
        _db = db;
        _hasher = hasher;
        _securityService = securityService;
        _jwt = jwt;
    }

    // --- USERS ---

    [HttpGet("users")]
    [Authorize(Policy = "Perm:SECURITY_USERS_READ")]
    public async Task<ActionResult<List<UserSecurityDto>>> ListUsers([FromQuery] string? q, [FromQuery] bool includeInactive = false)
    {
        var query = _db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .AsQueryable();

        if (!includeInactive) query = query.Where(u => u.IsActive);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var ql = q.ToLower();
            query = query.Where(u => u.Username.ToLower().Contains(ql) || u.DisplayName.ToLower().Contains(ql));
        }

        var users = await query.OrderByDescending(u => u.CreatedAt).ToListAsync();

        return users.Select(u => new UserSecurityDto(
            u.Id,
            u.Username,
            u.DisplayName,
            u.IsActive,
            u.UserRoles.Select(ur => new RoleLiteDto(ur.Role.Id, ur.Role.Code, ur.Role.Name, ur.Role.Rank)).ToList(),
            u.CreatedAt,
            u.PersonId
        )).ToList();
    }

    [HttpPost("users")]
    [Authorize(Policy = "Perm:SECURITY_USERS_CREATE")]
    public async Task<ActionResult<UserSecurityDto>> CreateUser([FromBody] CreateUserReq req)
    {
        if (await _db.Users.AnyAsync(u => u.Username.ToLower() == req.Username.Trim().ToLower()))
            return Conflict("Username already exists.");

        var user = new User
        {
            Username = req.Username.Trim(),
            DisplayName = req.DisplayName,
            IsActive = req.IsActive,
            MustChangePassword = req.MustChangePassword,
            CreatedAt = DateTime.UtcNow,
            PersonId = req.PersonId
        };
        user.PasswordHash = _hasher.HashPassword(user, req.InitialPassword);

        if (req.RoleIds != null)
        {
            foreach (var rid in req.RoleIds)
            {
                user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = rid });
            }
        }

        _db.Users.Add(user);

        // Also update Person record if PersonId is provided (bidirectional link)
        if (user.PersonId.HasValue)
        {
            var p = await _db.People.FirstOrDefaultAsync(x => x.Id == user.PersonId.Value);
            if (p != null) p.UserId = user.Id;
        }

        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListUsers), new UserSecurityDto(
            user.Id, user.Username, user.DisplayName, user.IsActive,
            await GetUserRolesAsync(user.Id), user.CreatedAt, user.PersonId));
    }

    [HttpPatch("users/{id:guid}")]
    [Authorize(Policy = "Perm:SECURITY_USERS_UPDATE")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserReq req)
    {
        var user = await _db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        // Lockout protection
        if (req.IsActive == false || (req.RoleIds != null && !IsR0InList(req.RoleIds)))
        {
            if (await IsLastR0(user))
            {
                return BadRequest("Cannot deactivate or remove R0 role from the last active System Admin.");
            }
        }

        if (req.Username != null && req.Username.Trim().ToLower() != user.Username.ToLower())
        {
            if (await _db.Users.AnyAsync(u => u.Id != id && u.Username.ToLower() == req.Username.Trim().ToLower()))
                return Conflict("Username already exists.");
            user.Username = req.Username.Trim();
        }

        if (req.DisplayName != null) user.DisplayName = req.DisplayName;

        bool willBeActive = req.IsActive ?? user.IsActive;
        bool willBeAdmin = req.RoleIds != null ? IsR0InList(req.RoleIds) : IsR0InList(user.UserRoles.Select(ur => ur.RoleId).ToList());

        if ((!willBeActive || !willBeAdmin) && await IsLastR0(user))
        {
            return BadRequest("Nu se poate dezactiva sau retrage rolul ultimului administrator sistem activ.");
        }

        if (req.IsActive != null) user.IsActive = req.IsActive.Value;

        if (req.RoleIds != null)
        {
            user.UserRoles.Clear();
            foreach (var rid in req.RoleIds)
            {
                user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = rid });
            }
        }

        await _db.SaveChangesAsync();
        _securityService.ClearUserCache(user.Id);

        return Ok();
    }

    [HttpPost("users/{id:guid}/reset-password")]
    [Authorize(Policy = "Perm:SECURITY_USERS_RESET_PASSWORD")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordReq req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        user.PasswordHash = _hasher.HashPassword(user, req.NewPassword);
        user.MustChangePassword = req.MustChangePassword;

        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("users/{id:guid}/effective")]
    [Authorize(Policy = "Perm:SECURITY_USERS_READ")]
    public async Task<ActionResult<UserEffectiveDto>> GetEffectivePermissions(Guid id)
    {
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.PermissionOverrides).ThenInclude(po => po.Permission)
            .FirstOrDefaultAsync(u => u.Id == id);
        
        if (user == null) return NotFound();

        var effective = await _securityService.GetEffectivePermissionsAsync(id);

        return new UserEffectiveDto(
            user.UserRoles.Select(ur => new RoleLiteDto(ur.Role.Id, ur.Role.Code, ur.Role.Name, ur.Role.Rank)).ToList(),
            effective,
            user.PermissionOverrides.Select(po => new PermissionOverrideDto(po.Permission.Code, po.IsGranted)).ToList()
        );
    }

    // --- ROLES ---

    [HttpGet("roles")]
    [Authorize(Policy = "Perm:SECURITY_ROLES_READ")]
    public async Task<ActionResult<List<RoleSecurityDto>>> ListRoles()
    {
        var roles = await _db.Roles.Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission).ToListAsync();
        return roles.Select(r => new RoleSecurityDto(
            r.Id, r.Code, r.Name, r.Rank, r.Description, r.IsSystem,
            r.RolePermissions.Select(rp => rp.Permission.Code).ToList()
        )).ToList();
    }

    [HttpPost("roles")]
    [Authorize(Policy = "Perm:SECURITY_ROLES_CREATE")]
    public async Task<ActionResult<RoleSecurityDto>> CreateRole([FromBody] CreateRoleReq req)
    {
        if (await _db.Roles.AnyAsync(r => r.Code == req.Code)) return Conflict("Role code already exists.");

        var role = new Role
        {
            Code = req.Code,
            Name = req.Name,
            Rank = req.Rank,
            Description = req.Description,
            IsSystem = false
        };

        if (req.PermissionCodes != null)
        {
            var perms = await _db.Permissions.Where(p => req.PermissionCodes.Contains(p.Code)).ToListAsync();
            foreach (var p in perms)
            {
                role.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = p.Id });
            }
        }

        _db.Roles.Add(role);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListRoles), new RoleSecurityDto(
            role.Id, role.Code, role.Name, role.Rank, role.Description, role.IsSystem,
            req.PermissionCodes ?? new List<string>()));
    }

    [HttpPatch("roles/{id:guid}")]
    [Authorize(Policy = "Perm:SECURITY_ROLES_UPDATE")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleReq req)
    {
        var role = await _db.Roles.Include(r => r.RolePermissions).FirstOrDefaultAsync(r => r.Id == id);
        if (role == null) return NotFound();

        if (role.IsSystem)
        {
            // Restrict edits for system roles to permissions only (no rank/code changes)
            if (req.Name != null) role.Name = req.Name;
            if (req.Description != null) role.Description = req.Description;
        }
        else
        {
            if (req.Name != null) role.Name = req.Name;
            if (req.Rank != null) role.Rank = req.Rank.Value;
            if (req.Description != null) role.Description = req.Description;
        }

        if (req.PermissionCodes != null)
        {
            role.RolePermissions.Clear();
            var perms = await _db.Permissions.Where(p => req.PermissionCodes.Contains(p.Code)).ToListAsync();
            foreach (var p in perms)
            {
                role.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = p.Id });
            }
        }

        await _db.SaveChangesAsync();
        
        // CRITICAL: Clear cache for all users who have this role
        var affectedUserIds = await _db.UserRoles
            .Where(ur => ur.RoleId == id)
            .Select(ur => ur.UserId)
            .ToListAsync();
        
        foreach (var userId in affectedUserIds)
        {
            _securityService.ClearUserCache(userId);
        }
        
        return Ok();
    }

    [HttpDelete("roles/{id:guid}")]
    [Authorize(Policy = "Perm:SECURITY_ROLES_DELETE")]
    public async Task<IActionResult> DeleteRole(Guid id)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Id == id);
        if (role == null) return NotFound();
        if (role.IsSystem) return Conflict("Cannot delete system roles.");

        _db.Roles.Remove(role);
        await _db.SaveChangesAsync();
        return Ok();
    }

    // --- PERMISSIONS ---

    [HttpGet("permissions")]
    [Authorize(Policy = "Perm:SECURITY_PERMISSIONS_READ")]
    public async Task<ActionResult<List<PermissionGroupDto>>> ListPermissions()
    {
        var perms = await _db.Permissions.ToListAsync();
        return perms.GroupBy(p => p.GroupName)
            .Select(g => new PermissionGroupDto(
                g.Key,
                g.Select(p => new PermissionItemDto(p.Code, p.Name, p.Description)).ToList()
            )).ToList();
    }

    [HttpPut("users/{id:guid}/permission-overrides")]
    [Authorize(Policy = "Perm:SECURITY_PERMISSIONS_ASSIGN")]
    public async Task<IActionResult> SetOverride(Guid id, [FromBody] SetOverrideReq req)
    {
        var user = await _db.Users.Include(u => u.PermissionOverrides).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        var perm = await _db.Permissions.FirstOrDefaultAsync(p => p.Code == req.PermissionCode);
        if (perm == null) return BadRequest("Invalid permission code.");

        var existing = user.PermissionOverrides.FirstOrDefault(po => po.PermissionId == perm.Id);

        if (req.IsGranted == null)
        {
            if (existing != null) _db.UserPermissionOverrides.Remove(existing);
        }
        else
        {
            if (existing == null)
            {
                _db.UserPermissionOverrides.Add(new UserPermissionOverride
                {
                    UserId = id,
                    PermissionId = perm.Id,
                    IsGranted = req.IsGranted.Value
                });
            }
            else
            {
                existing.IsGranted = req.IsGranted.Value;
            }
        }

        await _db.SaveChangesAsync();
        _securityService.ClearUserCache(id);
        return Ok();
    }

    [HttpPost("impersonate")]
    [Authorize(Policy = "Perm:SECURITY_USERS_READ")]
    public async Task<ActionResult<ImpersonateResp>> Impersonate([FromBody] ImpersonateReq req)
    {
        var adminIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(adminIdStr, out var adminId)) return Unauthorized();

        var targetUser = await _db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == req.ImpersonatedUserId);

        if (targetUser == null) return NotFound("Target user not found.");
        if (!targetUser.IsActive) return BadRequest("Cannot impersonate inactive users.");

        bool isTargetAdmin = targetUser.UserRoles.Any(ur => ur.Role.Rank == 0 || ur.Role.Code == "R0_SYSTEM_ADMIN");
        if (isTargetAdmin) return BadRequest("Cannot impersonate administrators.");

        var roleCodes = targetUser.UserRoles.Select(ur => ur.Role.Code).ToList();
        var permissions = await _securityService.GetEffectivePermissionsAsync(targetUser.Id);

        var token = _jwt.CreateToken(targetUser, roleCodes, permissions, isImpersonation: true, actorAdminId: adminId.ToString());

        // LOG Audit
        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = adminId.ToString(),
            Action = "IMPERSONATE_START",
            TargetType = "User",
            TargetId = targetUser.Id.ToString(),
            PayloadJson = System.Text.Json.JsonSerializer.Serialize(new { targetUsername = targetUser.Username }),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return Ok(new ImpersonateResp(token));
    }

    // --- HELPERS ---

    private bool IsR0InList(List<Guid> roleIds)
    {
        return _db.Roles.Any(r => roleIds.Contains(r.Id) && (r.Rank == 0 || r.Code == "R0_SYSTEM_ADMIN"));
    }

    private async Task<bool> IsLastR0(User user)
    {
        // Is this user an active R0?
        bool isUserR0 = user.IsActive && user.UserRoles.Any(ur => ur.Role.Rank == 0 || ur.Role.Code == "R0_SYSTEM_ADMIN");
        if (!isUserR0) return false;

        // Count other active R0s
        var otherR0Count = await _db.UserRoles
            .Where(ur => (ur.Role.Rank == 0 || ur.Role.Code == "R0_SYSTEM_ADMIN") && ur.UserId != user.Id && ur.User.IsActive)
            .CountAsync();

        return otherR0Count == 0;
    }

    private async Task<List<RoleLiteDto>> GetUserRolesAsync(Guid userId)
    {
        return await _db.UserRoles
            .Where(ur => ur.UserId == userId)
            .Select(ur => new RoleLiteDto(ur.Role.Id, ur.Role.Code, ur.Role.Name, ur.Role.Rank))
            .ToListAsync();
    }
}

public record UserSecurityDto(
    Guid Id,
    string Username,
    string DisplayName,
    bool IsActive,
    List<RoleLiteDto> Roles,
    DateTime CreatedAt,
    Guid? PersonId
);

public record CreateUserReq(
    string Username,
    string DisplayName,
    string InitialPassword,
    bool MustChangePassword,
    bool IsActive,
    List<Guid> RoleIds,
    Guid? PersonId
);
