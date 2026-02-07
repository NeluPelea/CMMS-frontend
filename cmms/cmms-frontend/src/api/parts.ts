// src/api/parts.ts
// UTF-8, fara diacritice
import { apiFetch } from "./http";

export type PartDto = {
    id: string;
    name: string;
    code?: string | null;
    uom?: string | null;
    isAct: boolean;
};

export type GetPartsParams = {
    q?: string;    // free text search
    take?: number; // max results
    ia?: boolean;  // include inactive (conventie folosita in proiect: ia=true)
};

export type CreatePartReq = {
    name: string;
    code?: string | null;
    uom?: string | null;
};

function normQuery(q?: string): string | undefined {
    const s = (q ?? "").trim();
    return s ? s : undefined;
}

function normTake(take?: number): number | undefined {
    if (take == null) return undefined;
    const n = Math.floor(take);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    // limita defensiva (evitam URL-uri uriase / incarcari mari neintentionate)
    return Math.min(n, 5000);
}

function buildQs(p?: GetPartsParams): string {
    const qs = new URLSearchParams();

    const q = normQuery(p?.q);
    if (q) qs.set("q", q);

    const take = normTake(p?.take);
    if (take != null) qs.set("take", String(take));

    if (p?.ia) qs.set("ia", "true");

    const s = qs.toString();
    return s ? `?${s}` : "";
}

export async function getParts(p?: GetPartsParams): Promise<PartDto[]> {
    return apiFetch<PartDto[]>(`/api/parts${buildQs(p)}`, { method: "GET" });
}

export async function createPart(req: CreatePartReq): Promise<PartDto> {
    const name = (req.name ?? "").trim();
    if (name.length < 2) throw new Error("Name too short (min 2 chars).");

    return apiFetch<PartDto>(`/api/parts`, {
        method: "POST",
        body: JSON.stringify({
            name,
            code: req.code ?? null,
            uom: req.uom ?? null,
        }),
    });
}

// helper (non-breaking)
export async function searchParts(q: string, take = 50, ia = true): Promise<PartDto[]> {
    return getParts({ q, take, ia });
}
