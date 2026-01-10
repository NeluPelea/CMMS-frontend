// src/api/workOrders.ts
import { apiFetch } from "./http";

export type Paged<T> = {
  total: number;
  take: number;
  skip: number;
  items: T[];
};

export type WoListParams = {
  q?: string;
  status?: number;
  type?: number;
  assetId?: string;
  locId?: string;
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
};

export type WorkOrderDto = {
  id: string;
  type: number;
  status: number;
  title: string;
  description?: string | null;
  assetId?: string | null;
  asset?: any | null;
  assignedToPersonId?: string | null;
  startAt?: string | null;
  stopAt?: string | null;
  durationMinutes?: number | null;
};

export type WorkOrderDetailsDto = {
  id: string;
  type: number;
  status: number;
  title: string;
  description?: string | null;
  assetId?: string | null;
  assetName?: string | null;
  locId?: string | null;
  locName?: string | null;
  assignedToPersonId?: string | null;
  assignedToPersonName?: string | null;
  startAt?: string | null;
  stopAt?: string | null;
  durationMinutes?: number | null;
};

export async function getWorkOrders(p: WoListParams = {}): Promise<Paged<WorkOrderDto>> {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.status != null) qs.set("status", String(p.status));
  if (p.type != null) qs.set("type", String(p.type));
  if (p.assetId) qs.set("assetId", p.assetId);
  if (p.locId) qs.set("locId", p.locId);
  if (p.from) qs.set("from", p.from);
  if (p.to) qs.set("to", p.to);
  qs.set("take", String(p.take ?? 50));
  qs.set("skip", String(p.skip ?? 0));

  return apiFetch<Paged<WorkOrderDto>>(`/api/work-orders?${qs.toString()}`, { method: "GET" });
}

export async function createWorkOrder(req: {
  title: string;
  description?: string | null;
  type: number;
  assetId?: string | null;
  assignedToPersonId?: string | null;
  startAt?: string | null;
  stopAt?: string | null;
}): Promise<WorkOrderDto> {
  return apiFetch<WorkOrderDto>(`/api/work-orders`, { method: "POST", body: JSON.stringify(req) });
}

export async function getWorkOrderById(id: string): Promise<WorkOrderDetailsDto> {
  return apiFetch<WorkOrderDetailsDto>(`/api/work-orders/${id}`, { method: "GET" });
}

export async function updateWorkOrder(
  id: string,
  req: {
    title: string;
    description?: string | null;
    status: number;
    assetId?: string | null;
    assignedToPersonId?: string | null;
    startAt?: string | null;
    stopAt?: string | null;
  }
) {
  return apiFetch(`/api/work-orders/${id}`, { method: "PUT", body: JSON.stringify(req) });
}

export async function startWorkOrder(id: string) {
  return apiFetch(`/api/work-orders/${id}/start`, { method: "POST" });
}

export async function stopWorkOrder(id: string) {
  return apiFetch(`/api/work-orders/${id}/stop`, { method: "POST" });
}

export async function cancelWorkOrder(id: string) {
  return apiFetch(`/api/work-orders/${id}/cancel`, { method: "POST" });
}

export async function reopenWorkOrder(id: string) {
  return apiFetch(`/api/work-orders/${id}/reopen`, { method: "POST" });
}
