// src/api/laborLogs.ts
// UTF-8, fara diacritice
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
 * Returneaza lista de pontaje pentru un Work Order.
 * Numele trebuie sa fie exact getWorkOrderLaborLogs pentru componenta.
 */
export async function getWorkOrderLaborLogs(workOrderId: string): Promise<LaborLogDto[]> {
    return apiFetch<LaborLogDto[]>(`/api/work-orders/${workOrderId}/labor`, {
        method: "GET",
    });
}

/**
 * Adauga un log de manopera.
 */
export async function addLaborLog(workOrderId: string, req: CreateLaborLogRequest): Promise<LaborLogDto> {
    return apiFetch<LaborLogDto>(`/api/work-orders/${workOrderId}/labor`, {
        method: "POST",
        body: JSON.stringify(req),
    });
}

/**
 * Sterge un log de manopera.
 */
export async function deleteLaborLog(workOrderId: string, logId: string): Promise<void> {
    return apiFetch<void>(`/api/work-orders/${workOrderId}/labor/${logId}`, {
        method: "DELETE",
    });
}