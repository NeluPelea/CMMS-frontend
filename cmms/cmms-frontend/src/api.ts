const API_BASE = "http://localhost:5026";

function getToken() {
  return localStorage.getItem("cmms_token");
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

// ---------- Auth ----------
export async function login(email: string, password: string) {
  const data: any = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("cmms_token", data.accessToken);
  return data;
}

export function logout() {
  localStorage.removeItem("cmms_token");
}

export function isAuthed() {
  return !!getToken();
}

// ---------- Work Orders ----------
export type WoListResp = { total: number; take: number; skip: number; items: any[] };
export type WoListParams = {
  q?: string;
  status?: number;
  type?: number;
  assetId?: string;
  locId?: string;
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
};

export type WorkOrderDto = {
  id: string;
  type: number;
  status: number;
  title: string;
  description?: string | null;
  assetId?: string | null;
  asset?: any | null;
  assignedToPersonId?: string | null;
  startAt?: string | null;
  stopAt?: string | null;
  durationMinutes?: number | null;
};

export async function getWorkOrders(p: WoListParams = {}): Promise<WoListResp> {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.status != null) qs.set("status", String(p.status));
  if (p.type != null) qs.set("type", String(p.type));
  if (p.assetId) qs.set("assetId", p.assetId);
  if (p.locId) qs.set("locId", p.locId);
  if (p.from) qs.set("from", p.from);
  if (p.to) qs.set("to", p.to);
  qs.set("take", String(p.take ?? 50));
  qs.set("skip", String(p.skip ?? 0));
  return apiFetch(`/api/work-orders?${qs.toString()}`) as Promise<WoListResp>;
}

export async function createWorkOrder(req: {
  title: string;
  description?: string | null;
  type: number;
  assetId?: string | null;
  assignedToPersonId?: string | null;
  startAt?: string | null;
  stopAt?: string | null;
}): Promise<WorkOrderDto> {
  return apiFetch(`/api/work-orders`, { method: "POST", body: JSON.stringify(req) }) as Promise<WorkOrderDto>;
}

export async function startWorkOrder(id: string) {
  return apiFetch(`/api/work-orders/${id}/start`, { method: "POST" });
}
export async function stopWorkOrder(id: string) {
  return apiFetch(`/api/work-orders/${id}/stop`, { method: "POST" });
}
export async function cancelWorkOrder(id: string) {
  return apiFetch(`/api/work-orders/${id}/cancel`, { method: "POST" });
}
export async function reopenWorkOrder(id: string) {
  return apiFetch(`/api/work-orders/${id}/reopen`, { method: "POST" });
}

// ---------- Assets ----------
export type AssetDto = { id: string; name: string; code?: string | null; locId?: string | null; locName?: string | null; isAct?: boolean };

export async function getAssets(params?: { q?: string; locId?: string; take?: number; ia?: boolean }): Promise<AssetDto[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.locId) qs.set("locId", params.locId);
  if (params?.take) qs.set("take", String(params.take));
  if (params?.ia) qs.set("ia", "true");
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/as${tail}`, { method: "GET" }) as Promise<AssetDto[]>;
}

// ---------- Locations ----------
export type LocDto = { id: string; name: string; code?: string | null; isAct?: boolean };

export async function getLocs(params?: { q?: string; take?: number; ia?: boolean }): Promise<LocDto[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.take) qs.set("take", String(params.take));
  if (params?.ia) qs.set("ia", "true");
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/locs${tail}`, { method: "GET" }) as Promise<LocDto[]>;
}

// ---------- People ----------
export type PersonDto = { id: string; displayName: string };

export async function getPeople(): Promise<PersonDto[]> {
  return apiFetch(`/api/people?take=500`, { method: "GET" }) as Promise<PersonDto[]>;
}

// ---------- Work Order Details ----------
export type WorkOrderDetailsDto = {
  id: string;
  type: number;
  status: number;
  title: string;
  description?: string | null;
  assetId?: string | null;
  assetName?: string | null;
  locId?: string | null;
  locName?: string | null;
  assignedToPersonId?: string | null;
  assignedToPersonName?: string | null;
  startAt?: string | null;
  stopAt?: string | null;
  durationMinutes?: number | null;
};

export async function getWorkOrderById(id: string): Promise<WorkOrderDetailsDto> {
  return apiFetch(`/api/work-orders/${id}`, { method: "GET" }) as Promise<WorkOrderDetailsDto>;
}

export async function updateWorkOrder(id: string, req: {
  title: string;
  description?: string | null;
  status: number;
  assetId?: string | null;
  assignedToPersonId?: string | null;
  startAt?: string | null;
  stopAt?: string | null;
}) {
  return apiFetch(`/api/work-orders/${id}`, { method: "PUT", body: JSON.stringify(req) });
}
