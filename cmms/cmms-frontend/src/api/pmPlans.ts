import { apiFetch } from "./http";

export enum PmFrequency {
  Daily = 1,
  Weekly = 2,
  Monthly = 3,
}

export type PmPlanItemDto = {
  id: string;
  text: string;
  sort: number;
};

export type PmPlanDto = {
  id: string;
  assetId: string;
  name: string;
  frequency: number;
  nextDueAt: string; // ISO
  isAct: boolean;
  items: PmPlanItemDto[];
};

export type GenerateDueResp = {
  created: number;
  updatedPlans: number;
};

export async function getPmPlans(p?: { assetId?: string; take?: number }) {
  const qs = new URLSearchParams();
  if (p?.assetId) qs.set("assetId", p.assetId);
  if (p?.take != null) qs.set("take", String(p.take));
  return apiFetch<PmPlanDto[]>(`/api/pm-plans?${qs.toString()}`, { method: "GET" });
}

export async function createPmPlan(req: {
  assetId: string;
  name: string;
  frequency: number;
  nextDueAt?: string | null;
  items?: string[] | null;
}) {
  return apiFetch<PmPlanDto>(`/api/pm-plans`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function generateDuePmPlans(take?: number) {
  const qs = new URLSearchParams();
  if (take != null) qs.set("take", String(take));
  const q = qs.toString();
  return apiFetch<GenerateDueResp>(`/api/pm-plans/generate-due${q ? `?${q}` : ""}`, {
    method: "POST",
  });
}
