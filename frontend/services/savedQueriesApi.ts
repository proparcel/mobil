/**
 * Kayıtlı sorgular (Sorgularım) - Backend API
 * GET/POST /api/user/saved-queries/, DELETE /api/user/saved-queries/<id>/
 */

import { authJsonFetch } from "./apiClient";

export type ApiSavedQuery = {
  id: number;
  tkgm_value: number;
  ada: string;
  parsel: string;
  title: string;
  quarter_id: number | null;
  proparcel_value: number | null;
  created_at: string;
};

export async function listSavedQueriesApi(): Promise<
  { ok: true; results: ApiSavedQuery[] } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ results: ApiSavedQuery[] }>("/api/user/saved-queries/", {
    method: "GET",
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, results: res.data?.results ?? [] };
}

export async function createSavedQueryApi(payload: {
  tkgm_value: number;
  ada: string;
  parsel: string;
  title?: string;
  quarter_id?: number | null;
  proparcel_value?: number | null;
}): Promise<{ ok: true; data: ApiSavedQuery } | { ok: false; error: string }> {
  const res = await authJsonFetch<ApiSavedQuery>("/api/user/saved-queries/", {
    method: "POST",
    json: payload,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function deleteSavedQueryApi(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ ok?: boolean }>(`/api/user/saved-queries/${id}/`, {
    method: "DELETE",
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}
