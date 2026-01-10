// src/api/auth.ts
import { apiFetch, clearToken, getToken, setToken } from "./http";

export type LoginResponse = {
  accessToken: string;
  [k: string]: any;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (data?.accessToken) setToken(data.accessToken);
  return data;
}

export function logout() {
  clearToken();
}

export function isAuthed(): boolean {
  return !!getToken();
}
