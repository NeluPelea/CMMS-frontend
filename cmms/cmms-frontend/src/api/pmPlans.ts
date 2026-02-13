import { apiFetch } from "./http";

export const PmFrequency = {
  Daily: 1,
  Weekly: 2,
  Monthly: 3,
} as const;

export type PmFrequency = typeof PmFrequency[keyof typeof PmFrequency];

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

export type UpdatePmPlanReq = {
  assetId: string;
  name: string;
  frequency: number;
  nextDueAt?: string | null;
  isAct: boolean;
  items?: string[] | null;
};

export async function getPmPlans(p?: { assetId?: string; take?: number }) {
  const qs = new URLSearchParams();
  if (p?.assetId) qs.set("assetId", p.assetId);
  if (p?.take != null) qs.set("take", String(p.take));
  return apiFetch<PmPlanDto[]>(`/api/pm-plans?${qs.toString()}`, { method: "GET" });
}

export async function getPmPlan(id: string) {
  return apiFetch<PmPlanDto>(`/api/pm-plans/${id}`, { method: "GET" });
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

export async function updatePmPlan(id: string, req: UpdatePmPlanReq) {
  return apiFetch<PmPlanDto>(`/api/pm-plans/${id}`, {
    method: "PUT",
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
