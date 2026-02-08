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

export interface PersonnelLaborItem {
    personId: string;
    personName: string;
    jobTitle?: string;
    minutesPm: number;
    minutesWoProactive: number;
    minutesWoReactive: number;
    minutesExtra: number;
    minutesTotal: number;
    workedPct?: number;
    reactivePct?: number;
    timelineSegments: TimelineSegmentDto[];
}

export async function getLaborReport(from?: string, to?: string): Promise<LaborReportItem[]> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return apiFetch<LaborReportItem[]>(`/api/reports/labor?${qs.toString()}`, { method: "GET" });
}

export async function getLaborByPersonReport(from?: string, to?: string): Promise<PersonnelLaborItem[]> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return apiFetch<PersonnelLaborItem[]>(`/api/reports/labor-by-person?${qs.toString()}`, { method: "GET" });
}

export async function getPartsReport(from?: string, to?: string): Promise<PartReportItem[]> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return apiFetch<PartReportItem[]>(`/api/reports/parts?${qs.toString()}`, { method: "GET" });
}

export interface TimelineSegmentDto {
    type: "PM" | "Proactive" | "Reactive" | "Other";
    startUtc: string;
    stopUtc: string;
    minutes: number;
}

export interface AssetLaborItem {
    assetId: string;
    assetName: string;
    locationName: string;
    minutesPm: number;
    minutesWoProactive: number;
    minutesWoReactive: number;
    reactivePct: number;
    timelineSegments: TimelineSegmentDto[];
}

export interface AssetLaborDailyItem extends AssetLaborItem {
    date: string;
}

export interface AssetDowntimeItem {
    assetId: string;
    assetName: string;
    totalHours: number;
    workOrderCount: number;
}

export async function getLaborByAssetReport(from?: string, to?: string): Promise<AssetLaborItem[]> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return apiFetch<AssetLaborItem[]>(`/api/reports/labor-by-asset?${qs.toString()}`, { method: "GET" });
}

export async function getLaborByAssetDailyReport(from?: string, to?: string): Promise<AssetLaborDailyItem[]> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return apiFetch<AssetLaborDailyItem[]>(`/api/reports/labor-by-asset-daily?${qs.toString()}`, { method: "GET" });
}

export async function getTopDowntimeReport(from?: string, to?: string): Promise<AssetDowntimeItem[]> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return apiFetch<AssetDowntimeItem[]>(`/api/reports/top-assets-downtime?${qs.toString()}`, { method: "GET" });
}

export interface ExtraJobSegment {
    startAt: string;
    stopAt?: string;
    durationMinutes: number;
}

export interface ExtraJobReportItem {
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    createdBy: string;
    assigneeName?: string;
    totalMinutes: number;
    status: string;
    segments: ExtraJobSegment[];
    timelineStart?: string;
    timelineEnd?: string;
    weightPct?: number;
    overtimeMinutes: number;
    isReopened: boolean;
}

export async function getExtraJobsReport(from?: string, to?: string): Promise<ExtraJobReportItem[]> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return apiFetch<ExtraJobReportItem[]>(`/api/reports/extra-jobs?${qs.toString()}`, { method: "GET" });
}
