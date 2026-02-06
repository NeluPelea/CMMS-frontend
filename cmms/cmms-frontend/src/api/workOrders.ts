// src/api/workOrders.ts
import { apiFetch } from "./http";

// --- ENUMS (Sincronizate cu Cmms.Domain) ---
export enum WorkOrderType {
    Corrective = 0,
    Preventive = 1,
    Project = 2
}

export enum WorkOrderStatus {
    Open = 0,
    InProgress = 1,
    Done = 2,
    Cancelled = 3
}

// --- DTOs ---
export type Paged<T> = {
    total: number;
    take: number;
    skip: number;
    items: T[];
};

export type WoLocationDto = {
    id: string;
    name: string;
    code?: string | null;
    isAct: boolean;
};

export type WoAssetDto = {
    id: string;
    name: string;
    code?: string | null;
    locationId?: string | null;
    location?: WoLocationDto | null;
    isAct: boolean;
};

export type WoPersonDto = {
    id: string;
    displayName: string;
};

export type WorkOrderDto = {
    id: string;
    type: WorkOrderType;
    status: WorkOrderStatus;
    title: string;
    description?: string | null;
    assetId?: string | null;
    asset?: WoAssetDto | null;
    assignedToPersonId?: string | null;
    assignedToPerson?: WoPersonDto | null;
    startAt?: string | null;
    stopAt?: string | null;
    durationMinutes?: number | null;
    pmPlanId?: string | null;
    extraRequestId?: string | null;
};

// --- PARAMS & REQUESTS ---
export type WoListParams = {
    q?: string;
    status?: WorkOrderStatus;
    type?: WorkOrderType;
    assetId?: string;
    locId?: string;
    from?: string; // ISO string
    to?: string;   // ISO string
    take?: number;
    skip?: number;
};

export interface CreateWoReq {
    title: string;
    description?: string | null;
    type: WorkOrderType;
    assetId?: string | null;
    assignedToPersonId?: string | null;
    startAt?: string | null;
    stopAt?: string | null;
}

export interface UpdateWoReq {
    title: string;
    description?: string | null;
    status: WorkOrderStatus;
    assetId?: string | null;
    assignedToPersonId?: string | null;
    startAt?: string | null;
    stopAt?: string | null;
}

// --- FUNCTIONS ---

export async function getWorkOrders(p: WoListParams = {}): Promise<Paged<WorkOrderDto>> {
    const qs = new URLSearchParams();
    if (p.q) qs.set("q", p.q);
    if (p.status !== undefined) qs.set("status", String(p.status));
    if (p.type !== undefined) qs.set("type", String(p.type));
    if (p.assetId) qs.set("assetId", p.assetId);
    if (p.locId) qs.set("locId", p.locId);
    if (p.from) qs.set("from", p.from);
    if (p.to) qs.set("to", p.to);

    qs.set("take", String(p.take ?? 50));
    qs.set("skip", String(p.skip ?? 0));

    return apiFetch<Paged<WorkOrderDto>>(`/api/work-orders?${qs.toString()}`, { method: "GET" });
}

export async function getWorkOrderById(id: string): Promise<WorkOrderDto> {
    return apiFetch<WorkOrderDto>(`/api/work-orders/${id}`, { method: "GET" });
}

export async function createWorkOrder(req: CreateWoReq): Promise<WorkOrderDto> {
    return apiFetch<WorkOrderDto>(`/api/work-orders`, {
        method: "POST",
        body: JSON.stringify(req),
    });
}

export async function updateWorkOrder(id: string, req: UpdateWoReq): Promise<WorkOrderDto> {
    return apiFetch<WorkOrderDto>(`/api/work-orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(req),
    });
}

// --- STATE MACHINE ACTIONS ---

export async function startWorkOrder(id: string): Promise<WorkOrderDto> {
    return apiFetch<WorkOrderDto>(`/api/work-orders/${id}/start`, { method: "POST" });
}

export async function stopWorkOrder(id: string): Promise<WorkOrderDto> {
    return apiFetch<WorkOrderDto>(`/api/work-orders/${id}/stop`, { method: "POST" });
}

export async function cancelWorkOrder(id: string): Promise<WorkOrderDto> {
    return apiFetch<WorkOrderDto>(`/api/work-orders/${id}/cancel`, { method: "POST" });
}

export async function reopenWorkOrder(id: string): Promise<WorkOrderDto> {
    return apiFetch<WorkOrderDto>(`/api/work-orders/${id}/reopen`, { method: "POST" });
}