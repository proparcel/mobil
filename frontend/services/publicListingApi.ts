/**
 * GET /api/v1/public/listings/<uuid> — yayında ilan özeti (Pro bağlantısı için portal_snapshot_id).
 */

import { authJsonFetch, type ApiResult } from "./apiClient";

export type PublicListingPayload = {
  listing_id?: string;
  portal_snapshot_id?: number | null;
  title?: string | null;
};

type PublicListingEnvelope = {
  data?: PublicListingPayload;
  meta?: unknown;
};

export async function getPublicListing(listingId: string): Promise<ApiResult<PublicListingEnvelope>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  return authJsonFetch<PublicListingEnvelope>(`/api/v1/public/listings/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export function extractPublicListingPayload(res: ApiResult<PublicListingEnvelope>): PublicListingPayload | null {
  if (!res.ok || !res.data) return null;
  const body = res.data as PublicListingEnvelope;
  return body.data ?? null;
}

/** Yayınlanmış ilan tam payload — sosyal medya şablonu (web `fetchPublicListingDetailData`) */
export async function fetchPublicListingDetailData(
  listingId: string,
): Promise<ApiResult<{ data?: Record<string, unknown> }>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  return authJsonFetch<{ data?: Record<string, unknown> }>(`/api/v1/public/listings/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}
