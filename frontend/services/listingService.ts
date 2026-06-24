/**
 * İlan self API — taslak oluşturma, ilanlarım listesi
 */

import { authJsonFetch, type ApiResult } from "./apiClient";
import type {
  ListingDraftCreateEnvelope,
  ListingMineEnvelope,
} from "../src/types/listing";

/** POST /api/v1/self/listings/drafts — yeni taslak */
export async function createListingDraft(): Promise<
  ApiResult<ListingDraftCreateEnvelope>
> {
  return authJsonFetch<ListingDraftCreateEnvelope>("/api/v1/self/listings/drafts", {
    method: "POST",
    json: {},
  });
}

/** GET /api/v1/self/listings/mine — panel listesi */
export async function getMyListings(): Promise<ApiResult<ListingMineEnvelope>> {
  return authJsonFetch<ListingMineEnvelope>("/api/v1/self/listings/mine");
}

/** POST /api/v1/self/listings/<id>/deactivate — yayında ilanı pasife alır */
export async function deactivateListing(
  listingId: string,
  version: number,
): Promise<ApiResult<{ data?: Record<string, unknown> }>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  return authJsonFetch(`/api/v1/self/listings/${encodeURIComponent(id)}/deactivate`, {
    method: "POST",
    json: { version: Number(version) },
  });
}

/** POST /api/v1/self/listings/<id>/publish — pasif/taslak ilanı vitrine yayınlar */
export async function publishListing(
  listingId: string,
  version: number,
): Promise<ApiResult<{ data?: Record<string, unknown> }>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  return authJsonFetch(`/api/v1/self/listings/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    json: { version: Number(version), confirm_pro_query: false },
  });
}
