using System;
using System.Collections.Generic;

namespace Cmms.Api.Auth;

// --- USERS ---
public record UserSecurityDto(
    Guid Id,
    string Username,
    string DisplayName,
    bool IsActive,
    List<RoleLiteDto> Roles,
    DateTime CreatedAt
);

public record CreateUserReq(
    string Username,
    string DisplayName,
    string InitialPassword,
    bool MustChangePassword,
    bool IsActive,
    List<Guid> RoleIds
);

public record UpdateUserReq(
    string? DisplayName,
    bool? IsActive,
    List<Guid>? RoleIds
);

public record ResetPasswordReq(
    string NewPassword,
    bool MustChangePassword
);

public record UserEffectiveDto(
    List<RoleLiteDto> Roles,
    List<string> EffectivePermissions,
    List<PermissionOverrideDto> Overrides
);

public record PermissionOverrideDto(
    string PermissionCode,
    bool IsGranted
);

// --- ROLES ---
public record RoleSecurityDto(
    Guid Id,
    string Code,
    string Name,
    int Rank,
    string Description,
    bool IsSystem,
    List<string> PermissionCodes
);

public record CreateRoleReq(
    string Code,
    string Name,
    int Rank,
    string Description,
    List<string> PermissionCodes
);

public record UpdateRoleReq(
    string? Name,
    int? Rank,
    string? Description,
    List<string>? PermissionCodes
);

// --- PERMISSIONS ---
public record PermissionGroupDto(
    string Group,
    List<PermissionItemDto> Items
);

public record PermissionItemDto(
    string Code,
    string Name,
    string Description
);

public record SetOverrideReq(
    string PermissionCode,
    bool? IsGranted // null = remove override
);
