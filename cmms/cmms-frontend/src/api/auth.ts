// src/api/auth.ts
import { apiFetch, clearToken, getToken, setToken } from "./http";

const USER_KEY = "cmms_user";
const PERMS_KEY = "cmms_perms";

export interface RoleLiteDto {
  id: string;
  code: string;
  name: string;
  rank: number;
}

export interface UserSummaryDto {
  id: string;
  username: string;
  displayName: string;
  roles: RoleLiteDto[];
  mustChangePassword: boolean;
}

export type LoginResponse = {
  token: string;
  user: UserSummaryDto;
  permissions: string[];
};

export async function login(username: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  if (data?.token) {
    setToken(data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    localStorage.setItem(PERMS_KEY, JSON.stringify(data.permissions));
  }
  return data;
}

export async function getMe(): Promise<{ user: UserSummaryDto, permissions: string[] }> {
  const data = await apiFetch<{ user: UserSummaryDto, permissions: string[] }>("/api/auth/me");
  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    localStorage.setItem(PERMS_KEY, JSON.stringify(data.permissions));
  }
  return data;
}

export async function changePassword(req: { currentPassword: string, newPassword: string }) {
  return await apiFetch("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

export function logout() {
  clearToken();
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PERMS_KEY);
}

export function isAuthed(): boolean {
  return !!getToken();
}

export function getCurrentUser(): UserSummaryDto | null {
  const s = localStorage.getItem(USER_KEY);
  return s ? JSON.parse(s) : null;
}

export function getPermissions(): string[] {
  const s = localStorage.getItem(PERMS_KEY);
  return s ? JSON.parse(s) : [];
}

export function hasPerm(code: string): boolean {
  const roles = getCurrentUser()?.roles || [];
  // R0 bypass in UI
  if (roles.some(r => r.rank === 0 || r.code === "R0_SYSTEM_ADMIN")) return true;

  const perms = getPermissions();
  return perms.includes(code);
}
