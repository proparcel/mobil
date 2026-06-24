/**
 * Shared API client helpers (auth + refresh support)
 */

import { API_URL } from "../config/api";
import { storageService } from "./storageService";
import { authService } from "./authService";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; code?: string; payload?: Record<string, unknown> };

export async function getApiAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  let accessToken = await storageService.getAccessToken();
  if (!accessToken) {
    const refreshed = await authService.refreshToken();
    accessToken = refreshed ? await storageService.getAccessToken() : null;
  }
  const headers: Record<string, string> = {
    ...(extra || {}),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function authJsonFetch<T>(
  endpoint: string,
  options: RequestInit & { json?: any } = {}
): Promise<ApiResult<T>> {
  const url = `${API_URL}${endpoint}`;
  const headers = await getApiAuthHeaders({
    "Content-Type": "application/json",
    ...(options.headers as any),
  });

  const body = options.json !== undefined ? JSON.stringify(options.json) : options.body;

  let res = await fetch(url, { ...options, headers, body });
  if (res.status === 401 && endpoint !== "/api/auth/token/refresh/") {
    const refreshed = await authService.refreshToken();
    const token = refreshed ? await storageService.getAccessToken() : null;
    if (token) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${token}` };
      res = await fetch(url, { ...options, headers: retryHeaders, body });
    }
  }

  const status = res.status;
  const text = await res.text();
  try {
    const parsed = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return {
        ok: false,
        status,
        error: parsed?.error || parsed?.detail || parsed?.message || `HTTP ${status}`,
        code: typeof parsed?.code === 'string' ? parsed.code : undefined,
        payload: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined,
      };
    }
    return { ok: true, data: parsed as T };
  } catch {
    if (!res.ok) {
      return {
        ok: false,
        status,
        error: `HTTP ${status}`,
        payload: text ? { bodyPreview: text.slice(0, 800), parseError: true } : undefined,
      };
    }
    return { ok: true, data: text as any as T };
  }
}

export async function authFormFetch<T>(
  endpoint: string,
  form: FormData,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const url = `${API_URL}${endpoint}`;
  const headers = await getApiAuthHeaders({
    ...(options.headers as any),
  });

  let res = await fetch(url, { ...options, method: "POST", headers, body: form });
  if (res.status === 401 && endpoint !== "/api/auth/token/refresh/") {
    const refreshed = await authService.refreshToken();
    const token = refreshed ? await storageService.getAccessToken() : null;
    if (token) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${token}` };
      res = await fetch(url, { ...options, method: "POST", headers: retryHeaders, body: form });
    }
  }

  const status = res.status;
  const text = await res.text();
  try {
    const parsed = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return {
        ok: false,
        status,
        error: parsed?.error || parsed?.detail || parsed?.message || `HTTP ${status}`,
        code: typeof parsed?.code === 'string' ? parsed.code : undefined,
        payload: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined,
      };
    }
    return { ok: true, data: parsed as T };
  } catch {
    if (!res.ok) {
      return {
        ok: false,
        status,
        error: `HTTP ${status}`,
        payload: text ? { bodyPreview: text.slice(0, 800), parseError: true } : undefined,
      };
    }
    return { ok: true, data: text as any as T };
  }
}

