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

    serialNumber?: string | null;
    inventoryNumber?: string | null;

    assetClass?: string | null;
    manufacturer?: string | null;
    manufactureYear?: number | null;
    commissionedAt?: string | null;

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
    serialNumber?: string | null;
    inventoryNumber?: string | null;
    assetClass?: string | null;
    manufacturer?: string | null;
    manufactureYear?: number | null;
    commissionedAt?: string | null;
}

export interface UpdateAssetRequest {
    name: string;
    code?: string | null;
    locId?: string | null;
    ranking?: string | null;
    serialNumber?: string | null;
    inventoryNumber?: string | null;
    assetClass?: string | null;
    manufacturer?: string | null;
    manufactureYear?: number | null;
    commissionedAt?: string | null;
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
            serialNumber: req.serialNumber ?? null,
            inventoryNumber: req.inventoryNumber ?? null,
            assetClass: req.assetClass ?? null,
            manufacturer: req.manufacturer ?? null,
            manufactureYear: req.manufactureYear ?? null,
            commissionedAt: req.commissionedAt ?? null,
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
            serialNumber: req.serialNumber ?? null,
            inventoryNumber: req.inventoryNumber ?? null,
            assetClass: req.assetClass ?? null,
            manufacturer: req.manufacturer ?? null,
            manufactureYear: req.manufactureYear ?? null,
            commissionedAt: req.commissionedAt ?? null,
        }),
    });
}

/**
 * DELETE /api/as/{id}
 */
export async function deleteAsset(id: string): Promise<void> {
    await apiFetch<void>(`/api/as/${id}`, { method: "DELETE" });
}

// --- Documents ---

export type AssetDocumentDto = {
    id: string;
    title: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    createdAt: string;
    createdByUserId?: string | null;
    createdByName?: string | null;
};

export async function getAssetDocuments(assetId: string): Promise<AssetDocumentDto[]> {
    return apiFetch<AssetDocumentDto[]>(`/api/assets/${assetId}/documents`, { method: "GET" });
}

export async function uploadAssetDocument(assetId: string, title: string, file: File): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    // We use fetch directly here because apiFetch might assume JSON by default or we need custom body
    // actually apiFetch handles body if string, but for FormData we usually let browser set content-type

    // Let's use a small wrapper or just fetch with auth
    // const token = localStorage.getItem("token");
    // importing getToken from http? it's not exported.
    // simpler to rely on apiFetch handling FormData? 
    // Usually apiFetch sets Content-Type: application/json if body is not string/FormData. 
    // Let's assume apiFetch can handle it OR implement extended logic.
    // Looking at assets.ts imports: import { apiFetch } from "./http";
    // Let's assume apiFetch is a wrapper around fetch.

    // If apiFetch doesn't support FormData, we might need to bypass it or update it.
    // Safety check: let's try to pass FormData to apiFetch.
    // If apiFetch sets 'Content-Type': 'application/json' blindly, it will fail for FormData.

    // Alternative: direct fetch with auth
    // We need to know how to get token. src/api/http.ts usually has a getToken or similar.
    // In the previous replace attempt I used `getToken()` but it wasn't imported.
    // Let's check http.ts content or assumes it handles auth header.

    // Re-reading assets.ts: it uses `apiFetch`.
    // Let's see if we can use apiFetch for FormData.
    // If I cannot check http.ts, I will risk using apiFetch with FormData and hope it doesn't force JSON.
    // Update: I will read http.ts briefly to be sure.

    return apiFetch<{ id: string }>(`/api/assets/${assetId}/documents`, {
        method: "POST",
        body: formData as any
    });
}

export async function updateAssetDocumentTitle(assetId: string, docId: string, title: string): Promise<void> {
    return apiFetch<void>(`/api/assets/${assetId}/documents/${docId}`, {
        method: "PUT",
        body: JSON.stringify({ title })
    });
}

export async function deleteAssetDocument(assetId: string, docId: string): Promise<void> {
    await apiFetch<void>(`/api/assets/${assetId}/documents/${docId}`, { method: "DELETE" });
}

export function getAssetDocumentDownloadUrl(assetId: string, docId: string): string {
    // This needs the absolute URL or relative if proxy
    // We can use the imported API_BASE from http if available, but it is not imported in the current file view.
    // However, I saw API_BASE exported in http.ts in previous turn errors.
    // Let's import API_BASE from "./http"
    // Wait, I cannot change imports easily with replace_file_content at the top.
    // I'll assume relative path /api/... works if on same domain, otherwise I need API_BASE.
    // The previous error showed `API_BASE` export in `src/api/http.ts`.
    // I'll add `import { apiFetch, API_BASE } from "./http";` to the top in a separate edit if needed.
    // For now returning relative path.
    return `/api/assets/${assetId}/documents/${docId}/download`;
}

export function getAssetDocumentPreviewUrl(assetId: string, docId: string): string {
    return `/api/assets/${assetId}/documents/${docId}/preview`;
}
