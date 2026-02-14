import { apiFetch } from "./http";
import type { RoleLiteDto } from "./auth";
import type { RoleSecurityDto } from "./securityRoles";

export interface UserSecurityDto {
    id: string;
    username: string;
    displayName: string;
    isActive: boolean;
    roles: RoleLiteDto[];
    createdAt: string;
    personId?: string;
}

export interface CreateUserReq {
    username: string;
    displayName: string;
    initialPassword?: string;
    mustChangePassword: boolean;
    isActive: boolean;
    roleIds: string[];
    personId?: string;
}

export interface UpdateUserReq {
    displayName?: string;
    username?: string;
    isActive?: boolean;
    roleIds?: string[];
}

export interface UserEffectiveDto {
    roles: RoleLiteDto[];
    effectivePermissions: string[];
    overrides: PermissionOverrideDto[];
}

export interface PermissionOverrideDto {
    permissionCode: string;
    isGranted: boolean;
}

export const securityUsersApi = {
    list: (q?: string, includeInactive = false) => {
        const params = new URLSearchParams();
        if (q) params.append("q", q);
        if (includeInactive) params.append("includeInactive", "true");
        return apiFetch<UserSecurityDto[]>(`/api/security/users?${params.toString()}`);
    },
    create: (req: CreateUserReq) => apiFetch<UserSecurityDto>("/api/security/users", {
        method: "POST",
        body: JSON.stringify(req)
    }),
    update: (id: string, req: UpdateUserReq) => apiFetch(`/api/security/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(req)
    }),
    resetPassword: (id: string, req: { newPassword: string, mustChangePassword: boolean }) =>
        apiFetch(`/api/security/users/${id}/reset-password`, {
            method: "POST",
            body: JSON.stringify(req)
        }),
    getEffective: (id: string) => apiFetch<UserEffectiveDto>(`/api/security/users/${id}/effective`),
    setOverride: (id: string, req: { permissionCode: string, isGranted: boolean | null }) =>
        apiFetch(`/api/security/users/${id}/permission-overrides`, {
            method: "PUT",
            body: JSON.stringify(req)
        }),
    getRoles: () => apiFetch<RoleSecurityDto[]>("/api/security/roles"),
    impersonate: (id: string) => apiFetch<{ token: string }>("/api/security/impersonate", {
        method: "POST",
        body: JSON.stringify({ impersonatedUserId: id })
    })
};
