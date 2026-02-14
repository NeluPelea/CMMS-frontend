import { apiFetch } from "./http";

// Status enum matching CheckWorkOrderStatus in backend
export const WorkOrderStatus = {
    Open: 1,
    InProgress: 2,
    Done: 3,
    Cancelled: 4,
} as const;

export type WorkOrderStatus = typeof WorkOrderStatus[keyof typeof WorkOrderStatus];

export interface ExtraJobDto {
    id: string;
    title: string;
    description?: string;
    isDone: boolean; // legacy
    status: WorkOrderStatus; // new
    assignedToPersonId?: string;
    assignedToPersonName?: string;
    responsibleName?: string;
    createdAt: string;
    createdByUserId?: string;
    createdByUserName?: string;
    startAt?: string;
    stopAt?: string;
    finishedAt?: string;
}

export interface CreateExtraJobReq {
    title: string;
    description?: string;
    assignedToPersonId?: string;
}

export async function listExtraJobs(done?: boolean): Promise<ExtraJobDto[]> {
    const qs = new URLSearchParams();
    if (done !== undefined) qs.set("done", String(done));
    return apiFetch<ExtraJobDto[]>(`/api/extra-jobs?${qs.toString()}`, { method: "GET" });
}

export async function createExtraJob(req: CreateExtraJobReq): Promise<ExtraJobDto> {
    return apiFetch<ExtraJobDto>(`/api/extra-jobs`, {
        method: "POST",
        body: JSON.stringify(req),
    });
}

export async function updateExtraJob(id: string, req: CreateExtraJobReq): Promise<ExtraJobDto> {
    return apiFetch<ExtraJobDto>(`/api/extra-jobs/${id}`, {
        method: "PUT",
        body: JSON.stringify(req),
    });
}

export async function deleteExtraJob(id: string): Promise<void> {
    return apiFetch<void>(`/api/extra-jobs/${id}`, { method: "DELETE" });
}

export async function toggleExtraJob(id: string): Promise<{ isDone: boolean; finishedAt?: string }> {
    return apiFetch(`/api/extra-jobs/${id}/toggle`, { method: "POST" });
}

// Actions
export async function startExtraJob(id: string): Promise<ExtraJobDto> {
    return apiFetch<ExtraJobDto>(`/api/extra-jobs/${id}/start`, { method: "POST" });
}

export async function stopExtraJob(id: string): Promise<ExtraJobDto> {
    return apiFetch<ExtraJobDto>(`/api/extra-jobs/${id}/stop`, { method: "POST" });
}

export async function cancelExtraJob(id: string): Promise<ExtraJobDto> {
    return apiFetch<ExtraJobDto>(`/api/extra-jobs/${id}/cancel`, { method: "POST" });
}

export async function reopenExtraJob(id: string): Promise<ExtraJobDto> {
    return apiFetch<ExtraJobDto>(`/api/extra-jobs/${id}/reopen`, { method: "POST" });
}
