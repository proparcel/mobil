/**
 * İlan portali self favori API — /api/v1/self/favorites
 * (ILAN_PORTAL_EXPOSE_ENGAGEMENT_API; mobil authJsonFetch ile Bearer)
 */

import { authJsonFetch, type ApiResult } from "./apiClient";

export function pickFavoriteId(row: Record<string, unknown> | null | undefined): string {
  if (!row || typeof row !== "object") return "";
  const raw = (row as { favorite_id?: unknown; favoriteId?: unknown; id?: unknown }).favorite_id
    ?? (row as { favoriteId?: unknown }).favoriteId
    ?? (row as { id?: unknown }).id;
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  return s || "";
}

export async function getFavoriteForListing(listingId: string): Promise<Record<string, unknown> | null> {
  const id = String(listingId || "").trim();
  if (!id) return null;
  const res = await authJsonFetch<{ items?: unknown[] }>(
    `/api/v1/self/favorites?listing_id=${encodeURIComponent(id)}&page_size=1`,
    { method: "GET" },
  );
  if (!res.ok) return null;
  const items = res.data.items;
  if (!Array.isArray(items) || !items[0]) return null;
  return items[0] as Record<string, unknown>;
}

export async function listFavoriteFolders(): Promise<Array<{ folder_id: string; name: string }>> {
  const res = await authJsonFetch<{ items?: unknown[] }>("/api/v1/self/favorite-folders", { method: "GET" });
  if (!res.ok) throw new Error(res.error);
  const items = res.data.items;
  if (!Array.isArray(items)) return [];
  return items.map((f: { folder_id?: unknown; name?: unknown }) => ({
    folder_id: String(f.folder_id ?? ""),
    name: String(f.name ?? "—"),
  }));
}

export async function createFavoriteFolder(name: string): Promise<void> {
  const res = await authJsonFetch("/api/v1/self/favorite-folders", {
    method: "POST",
    json: { name: String(name || "").trim() },
  });
  if (!res.ok) throw new Error(res.error);
}

export async function addFavorite(
  listingId: string,
  sourceSurface = "listing_detail",
  folderId?: string | null,
): Promise<Record<string, unknown> | null> {
  const id = String(listingId || "").trim();
  if (!id) throw new Error("listing_id gerekli");
  const body: Record<string, unknown> = { listing_id: id, source_surface: sourceSurface };
  const fid = folderId != null ? String(folderId).trim() : "";
  if (fid) body.folder_id = fid;
  const res = await authJsonFetch<{ data?: Record<string, unknown> }>("/api/v1/self/favorites", {
    method: "POST",
    json: body,
  });
  if (!res.ok) throw new Error(res.error);
  const payload = res.data as { data?: Record<string, unknown> };
  return payload.data ?? null;
}

export async function removeFavorite(favoriteId: string): Promise<void> {
  const fid = String(favoriteId || "").trim();
  if (!fid) throw new Error("favorite_id gerekli");
  const res = await authJsonFetch(`/api/v1/self/favorites/${encodeURIComponent(fid)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(res.error);
}

/** GET /api/v1/self/favorites — klasör veya tümü (folder_id yok). */
export type FavoriteListItem = {
  favorite_id?: string;
  listing_id?: string;
  folder_id?: string | null;
  created_at?: string | null;
  state?: string;
  snapshot?: {
    listing_summary?: {
      listing_id?: string;
      title?: string | null;
      category_main?: string | null;
      listing_type?: string | null;
      price_amount?: number | null;
      currency?: string | null;
      area_m2?: number | null;
      location_labels?: Record<string, string> | string | null;
    } | null;
    current_price_amount?: number | null;
    publication_status?: string | null;
  } | null;
};

export type FavoriteListPagination = {
  page: number;
  page_size: number;
  total_count: number;
};

export type FavoriteListResponse = {
  items?: FavoriteListItem[];
  pagination?: FavoriteListPagination;
};

export async function listMyFavorites(options: {
  page?: number;
  pageSize?: number;
  folderId?: string | null;
}): Promise<ApiResult<FavoriteListResponse>> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 30));
  let qs = `page=${page}&page_size=${pageSize}`;
  const fid = options.folderId != null ? String(options.folderId).trim() : "";
  if (fid) qs += `&folder_id=${encodeURIComponent(fid)}`;
  return authJsonFetch<FavoriteListResponse>(`/api/v1/self/favorites?${qs}`, { method: "GET" });
}
