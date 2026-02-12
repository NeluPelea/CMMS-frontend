import { apiFetch } from "./http";

export interface PermissionItemDto {
    code: string;
    name: string;
    description: string;
}

export interface PermissionGroupDto {
    group: string;
    items: PermissionItemDto[];
}

export const securityPermissionsApi = {
    list: () => apiFetch<PermissionGroupDto[]>("/api/security/permissions")
};
