import { apiFetch } from "./http";

export type RoleDto = {
    id: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
};

export async function getRoles(): Promise<RoleDto[]> {
    return await apiFetch<RoleDto[]>("/api/roles", { method: "GET" });
}

export async function createRole(name: string, sortOrder = 0): Promise<RoleDto> {
    return await apiFetch<RoleDto>("/api/roles", {
        method: "POST",
        body: JSON.stringify({ name, sortOrder }),
    });
}

export async function updateRole(id: string, name: string, sortOrder: number, isActive: boolean): Promise<RoleDto> {
    return await apiFetch<RoleDto>(`/api/roles/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name, sortOrder, isActive }),
    });
}