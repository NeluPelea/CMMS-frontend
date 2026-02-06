// src/api/laborLogs.ts
import { fetchApi } from "./http";

export interface LaborLogDto {
    id: string;
    personId: string;
    personName: string;
    minutes: number;
    description: string | null;
    createdAt: string;
}

export async function getWorkOrderLaborLogs(workOrderId: string): Promise<LaborLogDto[]> {
    return fetchApi(`/work-orders/${workOrderId}/labor`);
}

export async function addLaborLog(
    workOrderId: string,
    data: { personId: string; minutes: number; description: string | null }
) {
    return fetchApi(`/work-orders/${workOrderId}/labor`, {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function deleteLaborLog(workOrderId: string, logId: string) {
    return fetchApi(`/work-orders/${workOrderId}/labor/${logId}`, {
        method: "DELETE",
    });
}