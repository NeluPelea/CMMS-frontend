import { apiFetch } from "./http";

export type RoleDto = {
    id: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
};

export type GetRolesParams = {
    take?: number;
    includeInactive?: boolean;
    q?: string;
};

export async function getRoles(params?: GetRolesParams): Promise<RoleDto[]> {
    const qs = new URLSearchParams();
    if (params?.take != null) qs.set("take", String(Math.max(1, Math.floor(params.take))));
    if (params?.includeInactive) qs.set("includeInactive", "1");
    if (params?.q) qs.set("q", params.q);
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return await apiFetch<RoleDto[]>(`/api/roles${tail}`, { method: "GET" });
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