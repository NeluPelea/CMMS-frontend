// src/api/workOrders.ts
// UTF-8, fara diacritice
import { apiFetch } from "./http";
import { WorkOrderStatus, WorkOrderType } from "../domain/enums";

// Backend shape: PagedResp<T>(total, take, skip, items)
export type PagedResp<T> = {
    total: number;
    take: number;
    skip: number;
    items: T[];
};

export type WorkOrderDto = {
    id: string;
    type: WorkOrderType;
    status: WorkOrderStatus;
    title: string;
    description?: string | null;

    assetId?: string | null;
    asset?: {
        id: string;
        name: string;
        code?: string | null;
        locationId?: string | null;
        location?: { id: string; name: string; code?: string | null; isAct: boolean } | null;
        isAct: boolean;
    } | null;

    assignedToPersonId?: string | null;
    assignedToPerson?: { id: string; displayName: string } | null;

    startAt?: string | null;
    stopAt?: string | null;
    durationMinutes?: number | null;

    pmPlanId?: string | null;
    extraRequestId?: string | null;

    defect?: string | null;
    cause?: string | null;
    solution?: string | null;
};

export interface WorkOrdersParams {
    take?: number;
    skip?: number;
    status?: WorkOrderStatus;
    type?: WorkOrderType;
    q?: string;
    locId?: string;
    assetId?: string;
    from?: string; // DateTimeOffset ISO (optional)
    to?: string; // DateTimeOffset ISO (optional)
}

// ---------------- Helpers ----------------

function setIfDefined(qs: URLSearchParams, key: string, v: unknown) {
    if (v === undefined || v === null) return;
    qs.set(key, String(v));
}

function setIfNonEmpty(qs: URLSearchParams, key: string, v?: string) {
    const s = (v ?? "").trim();
    if (!s) return;
    qs.set(key, s);
}

function buildQs(p?: WorkOrdersParams): string {
    const qs = new URLSearchParams();
    if (!p) return "";

    setIfDefined(qs, "take", p.take);
    setIfDefined(qs, "skip", p.skip);
    setIfDefined(qs, "status", p.status);
    setIfDefined(qs, "type", p.type);

    setIfNonEmpty(qs, "q", p.q);
    setIfNonEmpty(qs, "locId", p.locId);
    setIfNonEmpty(qs, "assetId", p.assetId);
    setIfNonEmpty(qs, "from", p.from);
    setIfNonEmpty(qs, "to", p.to);

    const s = qs.toString();
    return s ? `?${s}` : "";
}

function assertTitle(title: string) {
    const t = (title ?? "").trim();
    if (t.length < 2) throw new Error("Title too short (min 2 chars).");
    return t;
}

// ---------------- API ----------------

export async function getWorkOrders(p: WorkOrdersParams): Promise<PagedResp<WorkOrderDto>> {
    return apiFetch<PagedResp<WorkOrderDto>>(`/api/work-orders${buildQs(p)}`, { method: "GET" });
}

// Requests must match backend CreateReq/UpdateReq (NOT WorkOrderDto)
export type CreateWorkOrderReq = {
    title: string;
    description?: string | null;
    type: WorkOrderType;
    assetId?: string | null;
    assignedToPersonId?: string | null;
    startAt?: string | null; // ISO
    stopAt?: string | null; // ISO
};

export type UpdateWorkOrderReq = {
    title: string;
    description?: string | null;
    status: WorkOrderStatus;
    assetId?: string | null;
    assignedToPersonId?: string | null;
    startAt?: string | null; // ISO
    stopAt?: string | null; // ISO
    defect?: string | null;
    cause?: string | null;
    solution?: string | null;
};

export async function createWorkOrder(req: CreateWorkOrderReq): Promise<WorkOrderDto> {
    const title = assertTitle(req.title);
    return apiFetch<WorkOrderDto>(`/api/work-orders`, {
        method: "POST",
        body: JSON.stringify({
            ...req,
            title,
            description: req.description ?? null,
            assetId: req.assetId ?? null,
            assignedToPersonId: req.assignedToPersonId ?? null,
            startAt: req.startAt ?? null,
            stopAt: req.stopAt ?? null,
        }),
    });
}

export async function updateWorkOrder(id: string, req: UpdateWorkOrderReq): Promise<WorkOrderDto> {
    const title = assertTitle(req.title);
    return apiFetch<WorkOrderDto>(`/api/work-orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({
            ...req,
            title,
            description: req.description ?? null,
            assetId: req.assetId ?? null,
            assignedToPersonId: req.assignedToPersonId ?? null,
            startAt: req.startAt ?? null,
            stopAt: req.stopAt ?? null,
            defect: req.defect ?? null,
            cause: req.cause ?? null,
            solution: req.solution ?? null,
        }),
    });
}

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

export async function getWorkOrderById(id: string): Promise<WorkOrderDto> {
    return apiFetch<WorkOrderDto>(`/api/work-orders/${id}`, { method: "GET" });
}

// ---- Events (audit) ----
export type WorkOrderEventKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type WorkOrderEventDto = {
    id: string;
    createdAtUtc: string;
    actorId?: string | null;
    kind: WorkOrderEventKind;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    message?: string | null;
    correlationId?: string | null;
};

export async function getWorkOrderEvents(
    id: string,
    take = 200,
    skip = 0
): Promise<PagedResp<WorkOrderEventDto>> {
    const qs = new URLSearchParams();
    qs.set("take", String(take));
    qs.set("skip", String(skip));
    return apiFetch<PagedResp<WorkOrderEventDto>>(`/api/work-orders/${id}/events?${qs.toString()}`, {
        method: "GET",
    });
}
