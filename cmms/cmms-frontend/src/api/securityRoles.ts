import { apiFetch } from "./http";

export interface RoleSecurityDto {
    id: string;
    code: string;
    name: string;
    rank: number;
    description: string;
    isSystem: boolean;
    permissionCodes: string[];
}

export interface CreateRoleReq {
    code: string;
    name: string;
    rank: number;
    description: string;
    permissionCodes: string[];
}

export interface UpdateRoleReq {
    name?: string;
    rank?: number;
    description?: string;
    permissionCodes?: string[];
}

export const securityRolesApi = {
    list: () => apiFetch<RoleSecurityDto[]>("/api/security/roles"),
    create: (req: CreateRoleReq) => apiFetch<RoleSecurityDto>("/api/security/roles", {
        method: "POST",
        body: JSON.stringify(req)
    }),
    update: (id: string, req: UpdateRoleReq) => apiFetch(`/api/security/roles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(req)
    }),
    delete: (id: string) => apiFetch(`/api/security/roles/${id}`, {
        method: "DELETE"
    })
};
