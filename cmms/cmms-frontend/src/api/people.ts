// src/api/people.ts
// UTF-8, fara diacritice
import { apiFetch } from "./http";

// ---------------- Types ----------------

export type PersonDto = {
    id: string;
    displayName: string;
    fullName: string;
    jobTitle: string;
    specialization: string;
    phone: string;
    email: string | null;
    isActive: boolean;

    // daca nu ai schema stabila in backend, foloseste unknown (nu any)
    workSchedule?: unknown;
    leaves?: unknown[];
};

export type PersonSimpleDto = {
    id: string;
    displayName: string;
};

export type PersonLiteDto = {
    id: string;
    fullName: string;
    jobTitle: string;
    specialization: string;
};

export interface Paged<T> {
    items: T[];
    total: number;
}

// 4) Update person
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

// Backend poate returna fie array direct, fie paged (uneori cu extra campuri: take/skip)
type PeopleListResp = PersonDto[] | (Paged<PersonDto> & Record<string, unknown>);

// ---------------- Helpers ----------------

function isObject(x: unknown): x is Record<string, unknown> {
    return !!x && typeof x === "object";
}

function isPaged<T>(x: unknown): x is Paged<T> {
    if (!isObject(x)) return false;
    return Array.isArray((x as { items?: unknown }).items) && typeof (x as { total?: unknown }).total === "number";
}

function asArray<T>(x: unknown): T[] {
    return Array.isArray(x) ? (x as T[]) : [];
}

function normString(x: unknown): string {
    return typeof x === "string" ? x : x == null ? "" : String(x);
}

function normTake(take?: number, fallback = 500): number {
    const n = Math.floor(take ?? fallback);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(n, 5000);
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

    return apiFetch<Paged<PersonDto>>(`/api/people?${usp.toString()}`, { method: "GET" });
}

// 2) Creare persoana (request separat, nu Partial<PersonDto>)
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

// 3) Activare / Dezactivare
export async function activatePerson(id: string): Promise<void> {
    await apiFetch<void>(`/api/people/${id}/activate`, { method: "POST" });
}

export async function deactivatePerson(id: string): Promise<void> {
    await apiFetch<void>(`/api/people/${id}/deactivate`, { method: "POST" });
}

// 4) Metoda simpla (compat) - intoarce doar id + displayName
export async function getPeopleSimple(params?: {
    take?: number;
    includeInactive?: boolean;
}): Promise<PersonSimpleDto[]> {
    const usp = new URLSearchParams();
    usp.set("take", String(normTake(params?.take, 500)));
    if (params?.includeInactive) usp.set("includeInactive", "true");

    const res = await apiFetch<PeopleListResp>(`/api/people?${usp.toString()}`, { method: "GET" });

    const items: PersonDto[] = isPaged<PersonDto>(res) ? res.items : asArray<PersonDto>(res);

    return items.map((x) => {
        const id = normString((x as { id?: unknown }).id);
        const displayName =
            normString((x as { displayName?: unknown }).displayName).trim() ||
            normString((x as { fullName?: unknown }).fullName).trim() ||
            "Fara nume";
        return { id, displayName };
    });
}

// Backward compatibility: ai folosit getPeople() in mai multe pagini
export const getPeople = getPeopleSimple;

// 5) Disponibilitate (PeopleAvailability)
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
    usp.set("take", String(normTake(params.take, 200)));

    const res = await apiFetch<unknown>(`/api/people/available?${usp.toString()}`, { method: "GET" });
    return asArray<PersonLiteDto>(res);
}
