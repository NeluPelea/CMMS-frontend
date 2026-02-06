import { apiFetch } from "./http";

export type AssignmentDto = {
  id: string;
  workOrderId: string;

  personId: string;
  personName: string;

  roleId: string;
  roleName: string;

  plannedFrom: string; // ISO
  plannedTo: string;   // ISO
  createdAt: string;   // ISO

  notes?: string | null;
};

export type CreateAssignmentReq = {
  personId: string;
  roleId: string;
  plannedFrom: string; // ISO
  plannedTo: string;   // ISO
  notes?: string;
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
