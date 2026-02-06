// src/api/people.ts
import { apiFetch } from "./http";

// 1. Definiția DTO-ului conform cu Entities.cs (folosind Guid/string pentru ID)
export type PersonDto = {
  id: string; // Guid în C# se mapează ca string în TS
  displayName: string;
  fullName: string;
  jobTitle: string;
  specialization: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  // Câmpurile de program și concedii sunt opționale în listă
  workSchedule?: any; 
  leaves?: any[];
};

export interface Paged<T> {
  items: T[];
  total: number;
}

// 2. Încărcare paginată (Filtrare și Paginare)
export async function getPeoplePaged(params: {
  take: number;
  skip: number;
  q?: string;
  includeInactive?: boolean;
}): Promise<Paged<PersonDto>> {
  const usp = new URLSearchParams();
  usp.set("take", String(params.take));
  usp.set("skip", String(params.skip));
  if (params.q) usp.set("q", params.q);
  if (params.includeInactive) usp.set("includeInactive", "true");

  return await apiFetch<Paged<PersonDto>>(`/api/people?${usp.toString()}`, {
    method: "GET",
  });
}

// 3. Creare persoană (Trimiterea câmpurilor noi din Entities.cs)
export async function createPerson(data: Partial<PersonDto>): Promise<PersonDto> {
  return await apiFetch<PersonDto>(`/api/people`, {
    method: "POST",
    body: JSON.stringify({
      ...data,
      // Ne asigurăm că string-urile nu sunt null dacă în C# sunt non-nullable
      fullName: data.fullName || "",
      jobTitle: data.jobTitle || "",
      specialization: data.specialization || "",
      phone: data.phone || "",
      isActive: data.isActive ?? true
    }),
  });
}

// 4. Activare / Dezactivare
export async function activatePerson(id: string): Promise<void> {
  await apiFetch(`/api/people/${id}/activate`, { method: "POST" });
}

export async function deactivatePerson(id: string): Promise<void> {
  await apiFetch(`/api/people/${id}/deactivate`, { method: "POST" });
}

// 5. Metoda simplă (Backward Compatibility)
export async function getPeopleSimple(): Promise<{id: string, displayName: string}[]> {
  const res = await apiFetch<any>(`/api/people?take=500`, { method: "GET" });
  const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  
  return items.map((x: any) => ({
    id: String(x.id),
    displayName: String(x.displayName || x.fullName || "Fără nume"),
  }));
}

export const getPeople = getPeopleSimple;

// 6. Disponibilitate (Dacă folosești PeopleAvailability în calendar)
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