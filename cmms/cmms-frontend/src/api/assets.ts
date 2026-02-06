// src/api/assets.ts
import { apiFetch } from "./http";

export type AssetDto = {
    id: string;
    name: string;
    code?: string;
    locId?: string; // Ne asigurăm că este definit clar ca string opțional
    locName?: string;
    isAct?: boolean;
};

// Interfață pentru parametri pentru a evita 'any' implicit
export interface GetAssetsParams {
    q?: string;
    locId?: string;
    take?: number;
    ia?: boolean;
}

export async function getAssets(params?: GetAssetsParams): Promise<AssetDto[]> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.locId) qs.set("locId", params.locId);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.ia) qs.set("ia", "true");

    const tail = qs.toString() ? `?${qs.toString()}` : "";
    // Am păstrat ruta /api/as conform codului tău original
    return apiFetch<AssetDto[]>(`/api/as${tail}`, { method: "GET" });
}

export interface CreateAssetRequest {
    name: string;
    code?: string | null;
    locId?: string | null;
}

export async function createAsset(req: CreateAssetRequest): Promise<AssetDto> {
    return apiFetch<AssetDto>(`/api/as`, {
        method: "POST",
        body: JSON.stringify({
            name: req.name,
            code: req.code ?? null,
            locId: req.locId ?? null,
        }),
    });
}

export async function deleteAsset(id: string): Promise<void> {
    // Schimbat din null în void pentru consistență cu standardele de fetch
    return apiFetch<void>(`/api/as/${id}`, { method: "DELETE" });
}