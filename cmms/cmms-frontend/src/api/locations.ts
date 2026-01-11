// src/api/locations.ts
import { apiFetch } from "./http";

export type LocDto = {
  id: string;
  name: string;
  code?: string | null;
  isAct: boolean;
};

export async function getLocs(p?: {
  q?: string;
  take?: number;
  ia?: boolean;
}): Promise<LocDto[]> {
  const qs = new URLSearchParams();
  if (p?.q) qs.set("q", p.q);
  if (p?.take != null) qs.set("take", String(p.take));
  if (p?.ia) qs.set("ia", "true");
  return apiFetch(`/api/locs?${qs.toString()}`);
}

export async function createLoc(req: { name: string; code?: string | null }) {
  return apiFetch<LocDto>(`/api/locs`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function updateLoc(id: string, req: { name: string; code?: string | null }) {
  return apiFetch<LocDto>(`/api/locs/${id}`, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export async function deleteLoc(id: string) {
  // backend: 204 NoContent
  return apiFetch<null>(`/api/locs/${id}`, { method: "DELETE" });
}
