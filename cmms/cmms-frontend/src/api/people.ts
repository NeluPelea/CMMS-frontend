// src/api/people.ts
import { apiFetch } from "./http";

export type PersonDto = {
  id: string;
  displayName: string;
};

// lista simpla pt dropdown-uri (WorkOrdersPage / WorkOrderDetailsPage etc.)
export async function getPeopleSimple(): Promise<PersonDto[]> {
  // PeopleController intoarce Paged<PersonDto> (cu Items)
  const res = await apiFetch<any>(`/api/people?take=500`, { method: "GET" });

  // acceptam ambele forme: fie array direct, fie paged { items: [...] }
  const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  return items.map((x: any) => ({
    id: String(x.id),
    displayName: String(x.displayName ?? x.fullName ?? ""),
  }));
}

// Backward-compatible: paginile existente apeleaza getPeople()
export const getPeople = getPeopleSimple;

// optional (daca folosesti PeopleAvailability)
export type PersonLiteDto = {
  id: string;
  fullName: string;
  jobTitle: string;
  specialization: string;
};

export async function getAvailablePeople(params: {
  fromUtc: string;
  toUtc: string;
  q?: string;
  take?: number;
}): Promise<PersonLiteDto[]> {
  const usp = new URLSearchParams();
  usp.set("fromUtc", params.fromUtc);
  usp.set("toUtc", params.toUtc);
  if (params.q) usp.set("q", params.q);
  usp.set("take", String(params.take ?? 200));

  const res = await apiFetch<any>(`/api/people/available?${usp.toString()}`, {
    method: "GET",
  });

  return Array.isArray(res) ? (res as PersonLiteDto[]) : [];
}
