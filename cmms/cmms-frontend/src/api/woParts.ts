// src/api/woParts.ts
import { apiFetch } from "./http";

export type WorkOrderPartDto = {
  id: string;
  workOrderId: string;
  partId: string;
  partName: string;
  partCode?: string | null;
  uom?: string | null;
  qtyUsed: number;
};

export async function getWorkOrderParts(workOrderId: string): Promise<WorkOrderPartDto[]> {
  return apiFetch<WorkOrderPartDto[]>(`/api/work-orders/${workOrderId}/parts`, { method: "GET" });
}

export async function addWorkOrderPart(workOrderId: string, partId: string, qtyUsed: number): Promise<null> {
  return apiFetch<null>(`/api/work-orders/${workOrderId}/parts`, {
    method: "POST",
    body: JSON.stringify({ partId, qtyUsed }),
  });
}

export async function deleteWorkOrderPart(workOrderId: string, id: string): Promise<null> {
  return apiFetch<null>(`/api/work-orders/${workOrderId}/parts/${id}`, { method: "DELETE" });
}

export async function setWorkOrderPartQty(workOrderId: string, id: string, qtyUsed: number): Promise<null> {
  return apiFetch<null>(`/api/work-orders/${workOrderId}/parts/${id}/set-qty`, {
    method: "POST",
    body: JSON.stringify({ qtyUsed }),
  });
}
