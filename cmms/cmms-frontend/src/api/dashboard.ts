import { apiFetch } from "./http";

export type KpisDto = {
  woTotal: number;
  woClosed: number;
  woInProgress: number;
  pmOnTime: number;
  pmLate: number;
  assetsInMaintenance: number;
};

export type AssetInMaintDto = {
  assetId: string;
  assetName: string;
  locationId: string | null;
  locationName: string | null;
  workOrderId: string;
  workOrderTitle: string;
  workOrderStatus: number; // enum
  assignedToPersonId: string | null;
  assignedToName: string | null;
  startAt: string | null;
};

export type ActivityWoRowDto = {
  id: string;
  title: string;
  status: number; // enum
  assetId: string | null;
  assetName: string | null;
  startAt: string | null;
  stopAt: string | null;
  durationMinutes: number | null;
};

export type PersonActivityDto = {
  personId: string;
  fromUtc: string;
  toUtc: string;
  woTotal: number;
  woClosed: number;
  woInProgress: number;
  woOpen: number;
  woCancelled: number;
  totalDurationMinutes: number;
  items: ActivityWoRowDto[];
};

export async function getKpis(params?: {
  from?: string;
  to?: string;
  locId?: string;
  personId?: string;
}): Promise<KpisDto> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.locId) qs.set("locId", params.locId);
  if (params?.personId) qs.set("personId", params.personId);

  const url = `/api/dashboard/kpis${qs.toString() ? `?${qs.toString()}` : ""}`;
  return apiFetch<KpisDto>(url);
}

export async function getAssetsInMaintenance(locId?: string): Promise<AssetInMaintDto[]> {
  const qs = new URLSearchParams();
  if (locId) qs.set("locId", locId);
  const url = `/api/dashboard/assets/in-maintenance${qs.toString() ? `?${qs.toString()}` : ""}`;
  return apiFetch<AssetInMaintDto[]>(url);
}

export async function getPersonActivity(personId: string, period: "week" | "month" | "quarter"): Promise<PersonActivityDto> {
  const url = `/api/dashboard/people/${personId}/activity?period=${encodeURIComponent(period)}`;
  return apiFetch<PersonActivityDto>(url);
}
