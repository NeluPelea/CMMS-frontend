// src/api/workOrderAssignments.ts
import { apiFetch } from "./http"; // sau fetchApi, depinde ce ai in http.ts

export type AssignmentDto = {
    id: string;
    workOrderId: string;
    personId: string;
    personName: string;
    roleId: string;
    roleName: string;
    plannedFrom: string;
    plannedTo: string;
    createdAt: string;
    notes?: string | null;
};

export type CreateAssignmentReq = {
    personId: string;
    roleId: string;
    plannedFrom: string;
    plannedTo: string;
    notes?: string;
};

// Adaugam acest tip pentru a rezolva eroarea din WoAssignmentsPanel
export type PersonLiteDto = {
    id: string;
    fullName: string;
    jobTitle?: string;
    specialization?: string;
};

export async function getWoAssignments(workOrderId: string): Promise<AssignmentDto[]> {
    return await apiFetch<AssignmentDto[]>(`/api/work-orders/${workOrderId}/assignments`, { method: "GET" });
}

export async function createWoAssignment(workOrderId: string, req: CreateAssignmentReq): Promise<AssignmentDto> {
    return await apiFetch<AssignmentDto>(`/api/work-orders/${workOrderId}/assignments`, {
        method: "POST",
        body: JSON.stringify(req),
    });
}

export async function deleteWoAssignment(workOrderId: string, assignmentId: string): Promise<void> {
    await apiFetch<void>(`/api/work-orders/${workOrderId}/assignments/${assignmentId}`, { method: "DELETE" });
}

// Functia care probabil iti dadea eroare (lipsa din API)
export async function getAvailablePeople(params: { fromUtc: string; toUtc: string; q?: string }): Promise<PersonLiteDto[]> {
    const query = new URLSearchParams(params as any).toString();
    return await apiFetch<PersonLiteDto[]>(`/api/people/available?${query}`, { method: "GET" });
}