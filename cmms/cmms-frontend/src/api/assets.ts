// src/api/assets.ts
import { apiFetch, API_BASE } from "./http";

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
 * GET /api/as/{id}
 */
export async function getAsset(id: string): Promise<AssetDto> {
    return apiFetch<AssetDto>(`/api/as/${id}`, { method: "GET" });
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

// Helper to ensure apiFetch doesn't break FormData
export async function uploadAssetDocument(assetId: string, title: string, file: File): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append("Title", title); // Match backend property casing if needed, usually case-insensitive but "Title" matches class.
    formData.append("File", file);

    // Note: apiFetch automatically handles lack of Content-Type for FormData
    return apiFetch<{ id: string }>(`/api/assets/${assetId}/documents`, {
        method: "POST",
        body: formData
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

export async function fetchAssetDocumentContent(assetId: string, docId: string, mode: "download" | "preview"): Promise<{ blob: Blob; fileName?: string }> {
    // If strict return types are needed invoke apiFetch via a custom call to access raw response if needed, 
    // or just use apiFetch's internal fetch logic.
    // Since apiFetch currently returns parsed JSON or text, we need a method that returns a Blob.
    // We'll reimplement a small fetch wrapper here or modify apiFetch.
    // Ideally, we should export a method from http.ts to get raw response or blob, but for minimal changes:

    // We'll assume we can use the same base URL logic.
    // Importing API_BASE or defining it here:
    // We need to import API_BASE or re-declare. It's usually better to use the HTTP helper.
    // But `apiFetch` in `http.ts` parses body.

    // Let's implement a direct fetch here using getToken from `http`.
    // We need to import getToken, API_BASE.
    // I will use a relative URL if API_BASE is not easily reachable, but `http.ts` exported it.
    // I'll rely on `apiFetch` to HAVE a blob option or do it manually.
    // Since I cannot easily change `http.ts` interface without potentially breaking others, I'll do manual fetch here.

    const token = localStorage.getItem("cmms_token") || sessionStorage.getItem("cmms_token");
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Get API_BASE from global or environment if possible, or fallback to relative /api
    // AssetsPage.tsx behaves as if backend is same origin or proxied?
    // User said: "Build ABSOLUTE URLs ... const API_BASE = ...". 
    // I should probably follow that pattern or use the one from http.ts if I can import it.
    // I'll try to import API_BASE from "./http".

    const url = `${API_BASE}/api/assets/${assetId}/documents/${docId}/${mode}`;

    // We'll use relative path which vite proxy or browser resolves. 
    // If exact absolute needed, user provided: `import.meta.env.VITE_API_BASE_URL`

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

    const blob = await response.blob();

    // Try to extract filename from Content-Disposition
    const disposition = response.headers.get("Content-Disposition");
    let fileName = "document";
    if (disposition && disposition.indexOf("filename=") !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
            fileName = matches[1].replace(/['"]/g, '');
        }
    }

    return { blob, fileName };
}
