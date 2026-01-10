// src/api/locations.ts
import { apiFetch } from "./http";

export type LocDto = {
  id: string;
  name: string;
  code?: string | null;
  // backend may or may not return this; keep optional
  isAct?: boolean;
};

export async function getLocs(params?: { q?: string; take?: number; ia?: boolean }): Promise<LocDto[]> {
  // NOTE: if backend doesn't support ia yet, it will simply ignore it.
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.take != null) qs.set("take", String(params.take));
  if (params?.ia) qs.set("ia", "true");
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<LocDto[]>(`/api/locs${tail}`, { method: "GET" });
}

export async function createLoc(req: { name: string; code?: string | null }): Promise<LocDto> {
  return apiFetch<LocDto>(`/api/locs`, {
    method: "POST",
    body: JSON.stringify({ name: req.name, code: req.code ?? null }),
  });
}

export async function deleteLoc(id: string): Promise<any> {
  return apiFetch(`/api/locs/${id}`, { method: "DELETE" });
}
