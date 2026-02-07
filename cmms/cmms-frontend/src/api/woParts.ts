// src/api/woParts.ts
// UTF-8, fara diacritice
import { apiFetch } from "./http";

export type WorkOrderPartDto = {
    id: string;
    workOrderId: string;
    partId: string;
    partName: string;
    partCode?: string | null;
    uom?: string | null;
    qtyUsed: number;
};

// ---------------- Helpers ----------------

function assertGuidLike(label: string, v: string) {
    const s = (v ?? "").trim();
    // soft-check (nu e perfect, dar prinde majoritatea greselilor)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
        throw new Error(`${label} invalid.`);
    }
    return s;
}

function assertQty(qtyUsed: number) {
    if (!Number.isFinite(qtyUsed) || qtyUsed <= 0) {
        throw new Error("qtyUsed must be a number > 0.");
    }
    return qtyUsed;
}

// ---------------- API ----------------

export async function getWorkOrderParts(workOrderId: string): Promise<WorkOrderPartDto[]> {
    const id = assertGuidLike("workOrderId", workOrderId);
    return apiFetch<WorkOrderPartDto[]>(`/api/work-orders/${id}/parts`, { method: "GET" });
}

export async function addWorkOrderPart(workOrderId: string, partId: string, qtyUsed: number): Promise<void> {
    const woId = assertGuidLike("workOrderId", workOrderId);
    const pId = assertGuidLike("partId", partId);
    const qty = assertQty(qtyUsed);

    await apiFetch<void>(`/api/work-orders/${woId}/parts`, {
        method: "POST",
        body: JSON.stringify({ partId: pId, qtyUsed: qty }),
    });
}

export async function deleteWorkOrderPart(workOrderId: string, id: string): Promise<void> {
    const woId = assertGuidLike("workOrderId", workOrderId);
    const rowId = assertGuidLike("id", id);

    await apiFetch<void>(`/api/work-orders/${woId}/parts/${rowId}`, { method: "DELETE" });
}

export async function setWorkOrderPartQty(workOrderId: string, id: string, qtyUsed: number): Promise<void> {
    const woId = assertGuidLike("workOrderId", workOrderId);
    const rowId = assertGuidLike("id", id);
    const qty = assertQty(qtyUsed);

    await apiFetch<void>(`/api/work-orders/${woId}/parts/${rowId}/set-qty`, {
        method: "POST",
        body: JSON.stringify({ qtyUsed: qty }),
    });
}
