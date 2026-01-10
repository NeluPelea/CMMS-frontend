// src/api/assets.ts
import { apiFetch } from "./http";

export type AssetDto = {
  id: string;
  name: string;
  code?: string | null;
  locId?: string | null;
  locName?: string | null;
  isAct?: boolean;
};

export async function getAssets(params?: { q?: string; locId?: string; take?: number; ia?: boolean }): Promise<AssetDto[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.locId) qs.set("locId", params.locId);
  if (params?.take != null) qs.set("take", String(params.take));
  if (params?.ia) qs.set("ia", "true");
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<AssetDto[]>(`/api/as${tail}`, { method: "GET" });
}

export async function createAsset(req: { name: string; code?: string | null; locId?: string | null }): Promise<AssetDto> {
  return apiFetch<AssetDto>(`/api/as`, {
    method: "POST",
    body: JSON.stringify({
      name: req.name,
      code: req.code ?? null,
      locId: req.locId ?? null,
    }),
  });
}

export async function deleteAsset(id: string): Promise<null> {
  return apiFetch<null>(`/api/as/${id}`, { method: "DELETE" });
}
