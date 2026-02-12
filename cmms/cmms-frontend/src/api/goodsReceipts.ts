import { apiFetch } from "./http";
import type { SupplierSummaryDto } from "./suppliers";

export interface GoodsReceiptDto {
    id: string;
    docNo: string;
    receiptDate: string; // ISO date
    supplierName?: string;

    // detail fields
    supplier?: { id: string, name: string };

    currency: string;
    fxRonEur?: number;
    fxRonUsd?: number;
    notes?: string;

    createdAt?: string;
    createdBy?: string;

    // total amount might be computed on frontend for details, or fetched
    totalAmount?: number;

    lines?: GoodsReceiptLineDto[];
}

export interface GoodsReceiptLineDto {
    id: string;
    partId: string;
    partName: string;
    partCode?: string;
    uom?: string;

    qty: number;
    unitPrice: number;
    currency: string;
    lineTotal: number;
}

export interface CreateGoodsReceiptLineDto {
    partId: string;
    qty: number;
    unitPrice: number;
}

export interface CreateGoodsReceiptDto {
    receiptDate: string; // YYYY-MM-DD
    supplierId?: string;
    docNo: string;
    currency: string;
    fxRonEur: number;
    fxRonUsd: number;
    notes?: string;
    lines: CreateGoodsReceiptLineDto[];
}

export async function getGoodsReceipts(params?: { take?: number; skip?: number }) {
    const qs = new URLSearchParams();
    if (params?.take) qs.set("take", String(params.take));
    if (params?.skip) qs.set("skip", String(params.skip));
    const q = qs.toString();
    return apiFetch<any>(`/api/goods-receipts?${q}`, { method: "GET" });
}

export async function getGoodsReceipt(id: string) {
    return apiFetch<GoodsReceiptDto>(`/api/goods-receipts/${id}`, { method: "GET" });
}

export async function createGoodsReceipt(dto: CreateGoodsReceiptDto) {
    return apiFetch<{ id: string }>("/api/goods-receipts", {
        method: "POST",
        body: JSON.stringify(dto)
    });
}
