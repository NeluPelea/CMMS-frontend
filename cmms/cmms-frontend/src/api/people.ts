// src/api/people.ts
// UTF-8, fara diacritice
import { apiFetch } from "./http";

// ---------------- Types ----------------

export type PersonScheduleDto = {
    monFriStartMinutes: number;
    monFriEndMinutes: number;
    satStartMinutes?: number | null;
    satEndMinutes?: number | null;
    sunStartMinutes?: number | null;
    sunEndMinutes?: number | null;
    timezone: string;
};

export type PersonDetailsDto = {
    id: string;
    displayName: string;
    fullName: string;
    jobTitle: string;
    specialization: string;
    phone: string;
    email: string | null;
    isActive: boolean;
    currentStatus: string;
    schedule?: PersonScheduleDto | null;
};

// IMPORTANT: acesta este DTO-ul de LISTA (GET /api/people)
// Backend trimite hasCustomSchedule + scheduleSummary.
export type PersonDto = {
    id: string;
    displayName: string;
    fullName: string;
    jobTitle: string;
    specialization: string;
    phone: string;
    email: string | null;
    isActive: boolean;

    hasCustomSchedule: boolean;
    scheduleSummary: string | null;
};

// List simplificat (folosit in dropdown-uri)
export type PersonSimpleDto = {
    id: string;
    displayName: string;
};

// Availability endpoint (GET /api/people/availability) intoarce PersonLiteDto din backend:
// { id, fullName, displayName }
export type PersonLiteDto = {
    id: string;
    fullName: string;
    displayName: string;
};

export interface Paged<T> {
    items: T[];
    total: number;
}

// ---------------- Helpers ----------------

function isObject(x: unknown): x is Record<string, unknown> {
    return !!x && typeof x === "object";
}

function asArray<T>(x: unknown): T[] {
    return Array.isArray(x) ? (x as T[]) : [];
}

function normString(x: unknown): string {
    return typeof x === "string" ? x : x == null ? "" : String(x);
}

function normTake(take?: number, fallback = 50): number {
    const n = Math.floor(take ?? fallback);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    // backend MaxTake = 200; aici lasam putin mai mult, dar nu e necesar
    return Math.min(n, 200);
}

function toPaged<T>(res: unknown): Paged<T> {
    if (isObject(res)) {
        const items = (res as { items?: unknown }).items;
        const total = (res as { total?: unknown }).total;
        if (Array.isArray(items) && typeof total === "number") {
            return { items: items as T[], total };
        }
    }
    // fallback: daca API ar returna direct array (compat)
    return { items: asArray<T>(res), total: Array.isArray(res) ? res.length : 0 };
}

// ---------------- API ----------------

// 1) Lista paginata (filtrare + paginare)
export async function getPeoplePaged(params: {
    take: number;
    skip: number;
    q?: string;
    includeInactive?: boolean;
}): Promise<Paged<PersonDto>> {
    const usp = new URLSearchParams();
    usp.set("take", String(normTake(params.take, 50)));
    usp.set("skip", String(Math.max(0, Math.floor(params.skip ?? 0))));
    if (params.q) usp.set("q", params.q);
    if (params.includeInactive) usp.set("includeInactive", "true");

    const res = await apiFetch<unknown>(`/api/people?${usp.toString()}`, { method: "GET" });
    return toPaged<PersonDto>(res);
}

// 2) Creare persoana
export type CreatePersonReq = {
    displayName?: string;
    fullName: string;
    jobTitle: string;
    specialization: string;
    phone: string;
    email?: string | null;
    isActive?: boolean;
};

export async function createPerson(req: CreatePersonReq): Promise<PersonDto> {
    const fullName = normString(req.fullName).trim();
    const displayName = (normString(req.displayName).trim() || fullName).trim();

    return apiFetch<PersonDto>(`/api/people`, {
        method: "POST",
        body: JSON.stringify({
            displayName,
            fullName,
            jobTitle: normString(req.jobTitle),
            specialization: normString(req.specialization),
            phone: normString(req.phone),
            email: req.email ?? null,
            isActive: req.isActive ?? true,
        }),
    });
}

// 3) Update person
export type UpdatePersonReq = {
    displayName?: string;
    fullName: string;
    jobTitle: string;
    specialization: string;
    phone: string;
    email?: string | null;
    isActive?: boolean;
};

export async function updatePerson(id: string, req: UpdatePersonReq): Promise<PersonDto> {
    const fullName = normString(req.fullName).trim();
    const displayName = (normString(req.displayName).trim() || fullName).trim();

    return apiFetch<PersonDto>(`/api/people/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
            displayName,
            fullName,
            jobTitle: normString(req.jobTitle),
            specialization: normString(req.specialization),
            phone: normString(req.phone),
            email: req.email ?? null,
            isActive: req.isActive ?? true,
        }),
    });
}

// 4) Activare / Dezactivare (endpoint dedicat)
export async function activatePerson(id: string): Promise<void> {
    await apiFetch<void>(`/api/people/${encodeURIComponent(id)}/activate`, { method: "POST" });
}

export async function deactivatePerson(id: string): Promise<void> {
    await apiFetch<void>(`/api/people/${encodeURIComponent(id)}/deactivate`, { method: "POST" });
}

// 5) Metoda simpla (compat) - pentru dropdown-uri
export async function getPeopleSimple(params?: { take?: number; includeInactive?: boolean }): Promise<PersonSimpleDto[]> {
    const usp = new URLSearchParams();
    usp.set("take", String(normTake(params?.take, 200)));
    if (params?.includeInactive) usp.set("includeInactive", "true");

    const res = await apiFetch<unknown>(`/api/people?${usp.toString()}`, { method: "GET" });
    const paged = toPaged<PersonDto>(res);

    return paged.items.map((x) => {
        const displayName = (x.displayName || x.fullName || "").trim() || "Fara nume";
        return { id: x.id, displayName };
    });
}

export const getPeople = getPeopleSimple;

// 6) Detalii persoana (include schedule in minute)
export async function getPersonDetails(id: string): Promise<PersonDetailsDto> {
    return apiFetch<PersonDetailsDto>(`/api/people/${encodeURIComponent(id)}`, { method: "GET" });
}

// 7) Update schedule (minute)
export type UpdatePersonScheduleReq = {
    monFriStartMinutes: number;
    monFriEndMinutes: number;
    satStartMinutes?: number | null;
    satEndMinutes?: number | null;
    sunStartMinutes?: number | null;
    sunEndMinutes?: number | null;
    timezone?: string | null;
};

export async function updatePersonSchedule(id: string, req: UpdatePersonScheduleReq): Promise<void> {
    await apiFetch<void>(`/api/people/${encodeURIComponent(id)}/schedule`, {
        method: "PUT",
        body: JSON.stringify(req),
    });
}

// 8) Disponibilitate (PeopleAvailability)
export async function getAvailablePeople(params: {
    fromUtc: string;
    toUtc: string;
}): Promise<PersonLiteDto[]> {
    const usp = new URLSearchParams();
    usp.set("fromUtc", params.fromUtc);
    usp.set("toUtc", params.toUtc);

    const res = await apiFetch<unknown>(`/api/people/availability?${usp.toString()}`, { method: "GET" });
    return asArray<PersonLiteDto>(res);
}
