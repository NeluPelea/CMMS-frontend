import { apiFetch } from "./http";

export interface LaborReportItem {
    personId: string;
    personName: string;
    totalMinutes: number;
    workOrderCount: number;
}

export interface PartReportItem {
    partId: string;
    partName: string;
    partCode?: string;
    totalQty: number;
    workOrderCount: number;
}

export async function getLaborReport(from?: string, to?: string): Promise<LaborReportItem[]> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return apiFetch<LaborReportItem[]>(`/api/reports/labor?${qs.toString()}`, { method: "GET" });
}

export async function getPartsReport(from?: string, to?: string): Promise<PartReportItem[]> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return apiFetch<PartReportItem[]>(`/api/reports/parts?${qs.toString()}`, { method: "GET" });
}
