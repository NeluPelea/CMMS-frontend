// src/api/people.ts
import { apiFetch } from "./http";

export type PersonDto = {
  id: string;
  displayName: string;
};

export async function getPeople(): Promise<PersonDto[]> {
  // Backend PeopleController returns list; keep it simple.
  return apiFetch<PersonDto[]>(`/api/people?take=500`, { method: "GET" });
}
