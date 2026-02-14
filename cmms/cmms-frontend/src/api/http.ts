// src/api/http.ts
const DEFAULT_API_BASE = "http://localhost:5026";

// Optional: set in cmms-frontend/.env as:
// VITE_API_BASE=http://localhost:5026
export const API_BASE: string = (import.meta as any)?.env?.VITE_API_BASE || DEFAULT_API_BASE;

export const TOKEN_KEY = "cmms_token";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, isSessionOnly: boolean = false) {
  if (isSessionOnly) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export type ApiError = Error & {
  status?: number;
  bodyText?: string;
  bodyJson?: any;
};

function makeError(message: string, status?: number, bodyText?: string, bodyJson?: any): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.bodyText = bodyText;
  err.bodyJson = bodyJson;
  return err;
}

async function readResponseBody(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (res.status === 204) return { json: null as any, text: "", contentType };

  if (contentType.includes("application/json")) {
    try {
      const json = await res.json();
      return { json, text: "", contentType };
    } catch {
      const text = await res.text();
      return { json: null as any, text, contentType };
    }
  }

  const text = await res.text();
  return { json: null as any, text, contentType };
}

/**
 * Fetch wrapper:
 * - injects Authorization header when token exists
 * - auto-sets Content-Type JSON when body is present
 * - parses JSON/text on both success and error
 */
export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const { json, text } = await readResponseBody(res);
    const msg =
      (json && (json.title || json.message || json.error))
        ? String(json.title || json.message || json.error)
        : (text || `HTTP ${res.status}`);
    throw makeError(msg, res.status, text, json);
  }

  const { json, text, contentType } = await readResponseBody(res);
  if (contentType.includes("application/json")) return json as T;
  return text as any as T;
}
