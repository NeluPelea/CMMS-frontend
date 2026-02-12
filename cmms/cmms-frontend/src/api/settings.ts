// src/api/settings.ts
import { apiFetch } from "./http";

export type SettingsDto = {
    vatRate: number;
    fxRonEur: number;
    fxRonUsd: number;
};

export async function getSettings(): Promise<SettingsDto> {
    return apiFetch<SettingsDto>("/api/settings", { method: "GET" });
}

export async function updateSettings(data: SettingsDto): Promise<void> {
    return apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify(data),
    });
}
