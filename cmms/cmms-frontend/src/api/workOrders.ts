import { apiFetch } from "./http";
// Importam enums din domain pentru a avea aceleasi valori peste tot
import { WorkOrderStatus, WorkOrderType } from "../domain/enums";

export type WorkOrderPaged<T> = {
    items: T[];
    totalCount: number;
    page: number;
    pageSize: number;
};

// Am sters const-urile locale WorkOrderType si WorkOrderStatus 
// pentru ca generau conflictul "Type 0 is not assignable to type WorkOrderStatus"

export type WorkOrderDto = {
    id: string;
    number: string;
    title: string;
    description?: string;
    type: WorkOrderType;
    status: WorkOrderStatus;
    assetId: string;
    assetName: string;
    locationName: string;
    priority: number;
    createdAt: string;
    assignedToPersonId?: string;
    startAt?: string;
    stopAt?: string;
    durationMinutes?: number;
    asset?: {
        id: string;
        name: string;
        locationId: string;
    };
};

export interface WorkOrdersParams {
    take?: number; // Folosit in pagina sub numele 'take' (limit)
    skip?: number; // Folosit in pagina sub numele 'skip' (offset)
    status?: WorkOrderStatus;
    type?: WorkOrderType;
    q?: string;
    locId?: string; // Adaugat pentru a rezolva eroarea TS
    assetId?: string; // Adaugat pentru a rezolva eroarea TS
}

export async function getWorkOrders(p: WorkOrdersParams): Promise<WorkOrderPaged<WorkOrderDto>> {
    const qs = new URLSearchParams();
    // Mapam parametrii conform asteptarilor API-ului tau (take/skip)
    if (p.take !== undefined) qs.set("take", String(p.take));
    if (p.skip !== undefined) qs.set("skip", String(p.skip));
    if (p.status !== undefined) qs.set("status", String(p.status));
    if (p.type !== undefined) qs.set("type", String(p.type));
    if (p.q) qs.set("q", p.q);
    if (p.locId) qs.set("locId", p.locId);
    if (p.assetId) qs.set("assetId", p.assetId);

    return await apiFetch<WorkOrderPaged<WorkOrderDto>>(`/api/work-orders?${qs.toString()}`, { method: "GET" });
}

// Folosim tipuri mai precise in loc de 'any' unde este posibil
export async function createWorkOrder(req: Partial<WorkOrderDto>): Promise<WorkOrderDto> {
    return await apiFetch<WorkOrderDto>(`/api/work-orders`, { method: "POST", body: JSON.stringify(req) });
}

export async function updateWorkOrder(id: string, req: Partial<WorkOrderDto>): Promise<WorkOrderDto> {
    return await apiFetch<WorkOrderDto>(`/api/work-orders/${id}`, { method: "PUT", body: JSON.stringify(req) });
}

// Am schimbat void in Promise<WorkOrderDto | void> pentru a permite verificarea in UI
export async function cancelWorkOrder(id: string): Promise<WorkOrderDto | void> {
    return await apiFetch<WorkOrderDto>(`/api/work-orders/${id}/cancel`, { method: "POST" });
}

export async function startWorkOrder(id: string): Promise<WorkOrderDto | void> {
    return await apiFetch<WorkOrderDto>(`/api/work-orders/${id}/start`, { method: "POST" });
}

export async function stopWorkOrder(id: string): Promise<WorkOrderDto | void> {
    return await apiFetch<WorkOrderDto>(`/api/work-orders/${id}/stop`, { method: "POST" });
}

export async function reopenWorkOrder(id: string): Promise<WorkOrderDto | void> {
    return await apiFetch<WorkOrderDto>(`/api/work-orders/${id}/reopen`, { method: "POST" });
}

export async function getWorkOrderById(id: string): Promise<WorkOrderDto> {
    return await apiFetch<WorkOrderDto>(`/api/work-orders/${id}`, { method: "GET" });
}