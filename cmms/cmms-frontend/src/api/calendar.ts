import { apiFetch } from "./http";

export interface CalendarDayDto {
    date: string; // ISO DateTime
    name?: string;
    isAct: boolean;
}

export interface AddDayReq {
    date: string; // yyyy-MM-dd
    name?: string;
}

// Holidays
export async function listHolidays(year?: number, includeDeleted = false): Promise<CalendarDayDto[]> {
    const qs = new URLSearchParams();
    if (year) qs.set("year", year.toString());
    if (includeDeleted) qs.set("includeDeleted", "true");
    return apiFetch<CalendarDayDto[]>(`/api/calendar/holidays?${qs.toString()}`);
}

export async function addHoliday(req: AddDayReq): Promise<void> {
    return apiFetch("/api/calendar/holidays", {
        method: "POST",
        body: JSON.stringify(req),
    });
}

export async function deleteHoliday(date: string): Promise<void> {
    // date must be yyyy-MM-dd
    return apiFetch(`/api/calendar/holidays/${date}`, {
        method: "DELETE",
    });
}

// Blackouts
export async function listBlackouts(year?: number, includeDeleted = false): Promise<CalendarDayDto[]> {
    const qs = new URLSearchParams();
    if (year) qs.set("year", year.toString());
    if (includeDeleted) qs.set("includeDeleted", "true");
    return apiFetch<CalendarDayDto[]>(`/api/calendar/blackouts?${qs.toString()}`);
}

export async function addBlackout(req: AddDayReq): Promise<void> {
    return apiFetch("/api/calendar/blackouts", {
        method: "POST",
        body: JSON.stringify(req),
    });
}

export async function deleteBlackout(date: string): Promise<void> {
    return apiFetch(`/api/calendar/blackouts/${date}`, {
        method: "DELETE",
    });
}

export async function updateHoliday(originalDate: string, req: AddDayReq): Promise<void> {
    return apiFetch(`/api/calendar/holidays/${originalDate}`, {
        method: "PUT",
        body: JSON.stringify(req),
    });
}

export async function updateBlackout(originalDate: string, req: AddDayReq): Promise<void> {
    return apiFetch(`/api/calendar/blackouts/${originalDate}`, {
        method: "PUT",
        body: JSON.stringify(req),
    });
}

// Unit Work Schedule
export interface UnitWorkSchedule {
    id: string;
    monFriStart: string; // HH:mm:ss
    monFriEnd: string;
    satStart: string | null;
    satEnd: string | null;
    sunStart: string | null;
    sunEnd: string | null;
    updatedAtUtc: string;
}

export interface UnitWorkScheduleUpdateReq {
    monFriStart: string;
    monFriEnd: string;
    satStart: string | null;
    satEnd: string | null;
    sunStart: string | null;
    sunEnd: string | null;
}

export async function getUnitWorkSchedule(): Promise<UnitWorkSchedule> {
    return apiFetch<UnitWorkSchedule>("/api/calendar/unit-work-schedule");
}

export async function updateUnitWorkSchedule(req: UnitWorkScheduleUpdateReq): Promise<UnitWorkSchedule> {
    return apiFetch<UnitWorkSchedule>("/api/calendar/unit-work-schedule", {
        method: "PUT",
        body: JSON.stringify(req),
    });
}


