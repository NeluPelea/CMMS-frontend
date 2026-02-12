import { apiFetch } from "./http";
import { NcOrderStatus } from "../domain/enums";

export interface SupplierDto {
    id: string;
    name: string;
    code?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    isActive: boolean;
}

export interface NcOrderSummaryDto {
    id: string;
    ncNumber: string;
    status: NcOrderStatus;
    supplierName: string;
    currency: string;
    total: number;
    orderDate: string;
    neededByDate?: string;
    priority: number;
}

export interface NcOrderLineDto {
    id: string;
    partId?: string;
    supplierPartId?: string;
    partNameManual?: string;
    supplierSku?: string;
    uom: string;
    qty: number;
    unitPrice: number;
    currency?: string;
    discountPercent: number;
    lineTotal: number;
    leadTimeDays?: number;
    notes?: string;
    sortOrder: number;
}

export interface NcOrderAttachmentDto {
    id: string;
    fileName: string;
    contentType: string;
    uploadedByUserId: string;
    uploadedByUserName: string;
    uploadedAt: string;
}

export interface NcOrderDetailsDto {
    id: string;
    ncNumber: string;
    status: NcOrderStatus;
    supplierId: string;
    supplierName: string;
    currency: string;
    orderDate: string;
    neededByDate?: string;
    priority: number;
    notes?: string;
    deliveryLocationId?: string;
    deliveryLocationName?: string;
    deliveryAddressOverride?: string;
    receiverPersonId?: string;
    receiverPersonName?: string;
    receiverPhone?: string;
    workOrderId?: string;
    workOrderTitle?: string;
    assetId?: string;
    assetName?: string;
    reason?: string;
    subtotal: number;
    vatPercent: number;
    vatAmount: number;
    total: number;
    createdAt: string;
    updatedAt: string;
    lines: NcOrderLineDto[];
    attachments: NcOrderAttachmentDto[];
}

export interface CreateNcOrderReq {
    ncNumber?: string;
    supplierId: string;
    currency: string;
    orderDate: string;
    neededByDate?: string;
    priority: number;
    notes?: string;
    deliveryLocationId?: string;
    deliveryAddressOverride?: string;
    receiverPersonId?: string;
    receiverPhone?: string;
    workOrderId?: string;
    assetId?: string;
    reason?: string;
}

export interface SaveNcOrderLineReq {
    partId?: string;
    supplierPartId?: string;
    partNameManual?: string;
    supplierSku?: string;
    uom: string;
    qty: number;
    unitPrice: number;
    currency?: string;
    discountPercent: number;
    leadTimeDays?: number;
    notes?: string;
    sortOrder: number;
}

const BASE_PATH = "/api/nc";

function buildQs(params?: any): string {
    if (!params) return "";
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.set(k, String(v));
    });
    const res = qs.toString();
    return res ? `?${res}` : "";
}

export const ncApi = {
    list: (params?: { query?: string, status?: NcOrderStatus, supplierId?: string, from?: string, to?: string }) =>
        apiFetch<NcOrderSummaryDto[]>(`${BASE_PATH}${buildQs(params)}`, { method: "GET" }),

    get: (id: string) => apiFetch<NcOrderDetailsDto>(`${BASE_PATH}/${id}`, { method: "GET" }),

    create: (req: CreateNcOrderReq) => apiFetch<{ id: string }>(BASE_PATH, {
        method: "POST",
        body: JSON.stringify(req)
    }),

    update: (id: string, req: CreateNcOrderReq) => apiFetch(`${BASE_PATH}/${id}`, {
        method: "PUT",
        body: JSON.stringify(req)
    }),

    addLine: (id: string, req: SaveNcOrderLineReq) => apiFetch<{ id: string }>(`${BASE_PATH}/${id}/lines`, {
        method: "POST",
        body: JSON.stringify(req)
    }),

    updateLine: (id: string, lineId: string, req: SaveNcOrderLineReq) => apiFetch(`${BASE_PATH}/${id}/lines/${lineId}`, {
        method: "PUT",
        body: JSON.stringify(req)
    }),

    deleteLine: (id: string, lineId: string) => apiFetch(`${BASE_PATH}/${id}/lines/${lineId}`, {
        method: "DELETE"
    }),

    changeStatus: (id: string, status: NcOrderStatus) => apiFetch(`${BASE_PATH}/${id}/status?newStatus=${status}`, {
        method: "POST"
    }),

    listSuppliers: () => apiFetch<SupplierDto[]>(`${BASE_PATH}/suppliers`, { method: "GET" }),

    getPdfUrl: (id: string) => `/api/nc/${id}/pdf`
};
