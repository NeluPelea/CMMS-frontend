// src/api/assets.ts
import { apiFetch } from "./http";

/**
 * Asset DTO as used by the frontend.
 * - Aligns with usage in WorkOrdersPage: filtering by locId
 * - Avoids implicit any and keeps nullability explicit
 */
export type AssetDto = {
    id: string;
    name: string;
    code?: string | null;

    // Location (flat fields used by your UI filters)
    locId?: string | null;
    locName?: string | null;

    // Active flag
    // Active flag
    isAct: boolean;

    // A-Z ranking
    ranking?: string | null;
    status?: number;
};

export interface GetAssetsParams {
    q?: string;
    locId?: string;
    take?: number;
    ia?: boolean;
}

/**
 * GET /api/as
 * Query params:
 * - q: search
 * - locId: filter by location
 * - take: limit
 * - ia: include inactive (true)
 */
export async function getAssets(params: GetAssetsParams = {}): Promise<AssetDto[]> {
    const qs = new URLSearchParams();

    if (params.q?.trim()) qs.set("q", params.q.trim());
    if (params.locId) qs.set("locId", params.locId);
    if (typeof params.take === "number") qs.set("take", String(params.take));
    if (params.ia) qs.set("ia", "true");

    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<AssetDto[]>(`/api/as${tail}`, { method: "GET" });
}

export interface CreateAssetRequest {
    name: string;
    code?: string | null;
    locId?: string | null;
    ranking?: string | null;
}

export interface UpdateAssetRequest {
    name: string;
    code?: string | null;
    locId?: string | null;
    ranking?: string | null;
}

/**
 * POST /api/as
 */
export async function createAsset(req: CreateAssetRequest): Promise<AssetDto> {
    const name = req.name.trim();
    if (name.length < 2) throw new Error("Asset name too short.");

    return apiFetch<AssetDto>(`/api/as`, {
        method: "POST",
        body: JSON.stringify({
            name,
            code: req.code ?? null,
            locId: req.locId ?? null,
            ranking: req.ranking,
        }),
    });
}

/**
 * PUT /api/as/{id}
 */
export async function updateAsset(id: string, req: UpdateAssetRequest): Promise<AssetDto> {
    return apiFetch<AssetDto>(`/api/as/${id}`, {
        method: "PUT",
        body: JSON.stringify({
            name: req.name,
            code: req.code ?? null,
            locId: req.locId ?? null,
            ranking: req.ranking,
        }),
    });
}

/**
 * DELETE /api/as/{id}
 */
export async function deleteAsset(id: string): Promise<void> {
    await apiFetch<void>(`/api/as/${id}`, { method: "DELETE" });
}
