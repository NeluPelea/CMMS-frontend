import { apiFetch } from "./http";

export interface CalendarDayDto {
    date: string; // ISO DateTime
    name?: string;
}

export interface AddDayReq {
    date: string; // yyyy-MM-dd
    name?: string;
}

// Holidays
export async function listHolidays(year?: number): Promise<CalendarDayDto[]> {
    const q = year ? `?year=${year}` : "";
    return apiFetch<CalendarDayDto[]>(`/api/calendar/holidays${q}`);
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
export async function listBlackouts(year?: number): Promise<CalendarDayDto[]> {
    const q = year ? `?year=${year}` : "";
    return apiFetch<CalendarDayDto[]>(`/api/calendar/blackouts${q}`);
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

