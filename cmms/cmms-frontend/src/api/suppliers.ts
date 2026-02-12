import { apiFetch } from "./http";

export interface SupplierSummaryContactDto {
    fullName: string;
    phone?: string;
    email?: string;
}

export interface SupplierSummaryDto {
    id: string;
    name: string;
    code?: string;
    isActive: boolean;
    isPreferred: boolean;
    city?: string;
    websiteUrl?: string;
    contacts: SupplierSummaryContactDto[];
}

export interface SupplierContactDto {
    id: string;
    fullName: string;
    roleTitle?: string;
    phone?: string;
    email?: string;
    isPrimary: boolean;
    isActive: boolean;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SupplierPartDto {
    id: string;
    partId: string;
    partName: string;
    partCode?: string;
    supplierSku?: string;
    lastUnitPrice?: number;
    currency?: string;
    discountPercent?: number;
    leadTimeDays?: number;
    moq?: number;
    productUrl?: string;
    notes?: string;
    lastPriceUpdatedAt?: string;
    isActive: boolean;
}

export interface SupplierDetailsDto {
    id: string;
    name: string;
    code?: string;
    isActive: boolean;
    isPreferred: boolean;
    websiteUrl?: string;
    taxId?: string;
    regCom?: string;
    addressLine1?: string;
    city?: string;
    county?: string;
    country?: string;
    postalCode?: string;
    paymentTermsDays?: number;
    currency?: string;
    iban?: string;
    bankName?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    contacts: SupplierContactDto[];
    parts: SupplierPartDto[];
}

export interface SupplierCreateReq {
    name: string;
    code?: string;
    isPreferred: boolean;
    websiteUrl?: string;
    taxId?: string;
    regCom?: string;
    addressLine1?: string;
    city?: string;
    county?: string;
    country?: string;
    postalCode?: string;
    paymentTermsDays?: number;
    currency?: string;
    iban?: string;
    bankName?: string;
    notes?: string;
}

export interface SupplierUpdateReq extends SupplierCreateReq {
    isActive: boolean;
}

export interface ContactSaveReq {
    fullName: string;
    roleTitle?: string;
    phone?: string;
    email?: string;
    isPrimary: boolean;
    notes?: string;
    isActive?: boolean;
}

export interface SupplierPartSaveReq {
    partId: string;
    supplierSku?: string;
    lastUnitPrice?: number;
    currency?: string;
    discountPercent?: number;
    leadTimeDays?: number;
    moq?: number;
    productUrl?: string;
    notes?: string;
    isActive?: boolean;
}

export interface SuppliersParams {
    q?: string;
    isActive?: boolean;
    isPreferred?: boolean;
    hasParts?: boolean;
    take?: number;
    skip?: number;
}

const BASE_PATH = "/api/suppliers";

function buildQs(params?: any): string {
    if (!params) return "";
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.set(k, String(v));
    });
    const res = qs.toString();
    return res ? `?${res}` : "";
}

export const suppliersApi = {
    list: (params?: SuppliersParams) =>
        apiFetch<{ total: number, items: SupplierSummaryDto[] }>(`${BASE_PATH}${buildQs(params)}`, { method: "GET" }),

    get: (id: string) => apiFetch<SupplierDetailsDto>(`${BASE_PATH}/${id}`, { method: "GET" }),

    create: (req: SupplierCreateReq) => apiFetch<{ id: string }>(BASE_PATH, {
        method: "POST",
        body: JSON.stringify(req)
    }),

    update: (id: string, req: SupplierUpdateReq) => apiFetch(`${BASE_PATH}/${id}`, {
        method: "PUT",
        body: JSON.stringify(req)
    }),

    toggleFavorite: (id: string, isPreferred: boolean) => apiFetch(`${BASE_PATH}/${id}/favorite`, {
        method: "POST",
        body: JSON.stringify(isPreferred)
    }),

    getLogoUrl: (websiteUrl: string) => `${BASE_PATH}/logo?url=${encodeURIComponent(websiteUrl)}`,

    delete: (id: string) => apiFetch(`${BASE_PATH}/${id}`, {
        method: "DELETE"
    }),

    // Contacts
    addContact: (supplierId: string, req: ContactSaveReq) => apiFetch<{ id: string }>(`${BASE_PATH}/${supplierId}/contacts`, {
        method: "POST",
        body: JSON.stringify(req)
    }),

    updateContact: (supplierId: string, contactId: string, req: ContactSaveReq) => apiFetch(`${BASE_PATH}/${supplierId}/contacts/${contactId}`, {
        method: "PUT",
        body: JSON.stringify(req)
    }),

    deleteContact: (supplierId: string, contactId: string) => apiFetch(`${BASE_PATH}/${supplierId}/contacts/${contactId}`, {
        method: "DELETE"
    }),

    // Parts
    getParts: (supplierId: string) => apiFetch<SupplierPartDto[]>(`${BASE_PATH}/${supplierId}/parts`, { method: "GET" }),

    addSupplierPart: (supplierId: string, req: SupplierPartSaveReq) => apiFetch<{ id: string }>(`${BASE_PATH}/${supplierId}/parts`, {
        method: "POST",
        body: JSON.stringify(req)
    }),

    updateSupplierPart: (supplierId: string, supplierPartId: string, req: SupplierPartSaveReq) => apiFetch(`${BASE_PATH}/${supplierId}/parts/${supplierPartId}`, {
        method: "PUT",
        body: JSON.stringify(req)
    }),

    deleteSupplierPart: (supplierId: string, supplierPartId: string) => apiFetch(`${BASE_PATH}/${supplierId}/parts/${supplierPartId}`, {
        method: "DELETE"
    }),

    // Lookup supplier catalog for a part
    lookupPartCatalog: (supplierId: string, partId: string) => apiFetch<{
        exists: boolean;
        supplierPartId?: string;
        supplierSku?: string;
        unitPrice?: number;
        currency?: string;
        leadTimeDays?: number;
        moq?: number;
        discountPercent?: number;
        notes?: string;
    }>(`${BASE_PATH}/${supplierId}/parts/lookup?partId=${partId}`, { method: "GET" })
};
