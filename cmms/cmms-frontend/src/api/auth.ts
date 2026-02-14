// src/api/auth.ts
import { apiFetch, clearToken, getToken, setToken, TOKEN_KEY } from "./http";

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
  personId?: string;
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

export async function impersonate(targetUserId: string): Promise<{ token: string }> {
  return await apiFetch<{ token: string }>("/api/security/impersonate", {
    method: "POST",
    body: JSON.stringify({ impersonatedUserId: targetUserId }),
  });
}

export function setImpersonationAuth(token: string, user: UserSummaryDto, perms: string[]) {
  setToken(token, true); // session only
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(PERMS_KEY, JSON.stringify(perms));
}

export async function getMe(): Promise<{ user: UserSummaryDto, permissions: string[] }> {
  const data = await apiFetch<{ user: UserSummaryDto, permissions: string[] }>("/api/auth/me");
  if (data.user) {
    const isSessionOnly = !!sessionStorage.getItem(TOKEN_KEY);
    if (isSessionOnly) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
      sessionStorage.setItem(PERMS_KEY, JSON.stringify(data.permissions));
    } else {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(PERMS_KEY, JSON.stringify(data.permissions));
    }
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
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(PERMS_KEY);
}

export function isAuthed(): boolean {
  return !!getToken();
}

export function isImpersonating(): boolean {
  return !!sessionStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): UserSummaryDto | null {
  if (isImpersonating()) {
    // Impersonation mode: ONLY use sessionStorage (no fallback to localStorage)
    const s = sessionStorage.getItem(USER_KEY);
    return s ? JSON.parse(s) : null;
  }
  // Normal mode: prefer sessionStorage, fallback to localStorage
  const s = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  return s ? JSON.parse(s) : null;
}

export function getPermissions(): string[] {
  if (isImpersonating()) {
    // Impersonation mode: ONLY use sessionStorage (no fallback to localStorage)
    const s = sessionStorage.getItem(PERMS_KEY);
    return s ? JSON.parse(s) : [];
  }
  // Normal mode: prefer sessionStorage, fallback to localStorage
  const s = sessionStorage.getItem(PERMS_KEY) || localStorage.getItem(PERMS_KEY);
  return s ? JSON.parse(s) : [];
}

export function hasPerm(code: string): boolean {
  const roles = getCurrentUser()?.roles || [];
  // R0 bypass in UI
  if (roles.some(r => r.rank === 0 || r.code === "R0_SYSTEM_ADMIN")) return true;

  const perms = getPermissions();
  return perms.includes(code);
}
