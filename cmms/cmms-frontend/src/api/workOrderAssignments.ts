import { apiFetch } from "./http";

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

// Am eliminat PersonLiteDto de aici deoarece exista deja in people.ts

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

export type UpdateAssignmentReq = {
    personId: string;
    roleId: string;
    plannedFrom: string;
    plannedTo: string;
    notes?: string;
};

export async function updateWoAssignment(
    workOrderId: string,
    assignmentId: string,
    req: UpdateAssignmentReq
): Promise<AssignmentDto> {
    return apiFetch<AssignmentDto>(`/api/work-orders/${workOrderId}/assignments/${assignmentId}`, {
        method: "PUT",
        body: JSON.stringify(req),
    });
}
