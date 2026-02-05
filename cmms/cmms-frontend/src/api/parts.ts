// src/api/parts.ts
import { apiFetch } from "./http";

export type PartDto = {
  id: string;
  name: string;
  code?: string | null;
  uom?: string | null;
  isAct: boolean;
};

export async function getParts(p?: { q?: string; take?: number; ia?: boolean }): Promise<PartDto[]> {
  const qs = new URLSearchParams();
  if (p?.q) qs.set("q", p.q);
  if (p?.take != null) qs.set("take", String(p.take));
  if (p?.ia) qs.set("ia", "true");
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<PartDto[]>(`/api/parts${tail}`, { method: "GET" });
}

export async function createPart(req: { name: string; code?: string | null; uom?: string | null }): Promise<PartDto> {
  return apiFetch<PartDto>(`/api/parts`, {
    method: "POST",
    body: JSON.stringify({
      name: req.name,
      code: req.code ?? null,
      uom: req.uom ?? null,
    }),
  });
}
