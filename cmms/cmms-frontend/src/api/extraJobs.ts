import { apiFetch } from "./http";

export interface ExtraJobDto {
    id: string;
    title: string;
    description?: string;
    isDone: boolean;
    assignedToPersonId?: string;
    assignedToPersonName?: string;
    createdAt: string;
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
