import { apiFetch } from "./http";

export interface LaborLogDto {
    id: string;
    workOrderId: string;
    personId: string;
    personName?: string;
    minutes: number;
    description?: string;
    createdAt: string;
}

export interface CreateLaborLogRequest {
    personId: string;
    minutes: number;
    description?: string;
}

/**
 * Adaugă un log de manoperă.
 * ATENȚIE: Primește workOrderId separat pentru a construi URL-ul corect.
 */
export async function addLaborLog(workOrderId: string, req: CreateLaborLogRequest): Promise<LaborLogDto> {
    return apiFetch<LaborLogDto>(`/api/work-orders/${workOrderId}/labor`, {
        method: "POST",
        body: JSON.stringify(req),
    });
}

export async function getLaborLogs(workOrderId: string): Promise<LaborLogDto[]> {
    return apiFetch<LaborLogDto[]>(`/api/work-orders/${workOrderId}/labor`, {
        method: "GET",
    });
}

export async function deleteLaborLog(workOrderId: string, logId: string): Promise<void> {
    return apiFetch<void>(`/api/work-orders/${workOrderId}/labor/${logId}`, {
        method: "DELETE",
    });
}