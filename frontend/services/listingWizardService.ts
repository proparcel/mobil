/**
 * İlan sihirbazı self API — web ilan-create/api.js ile uyumlu
 */

import { authFormFetch, authJsonFetch, type ApiResult } from "./apiClient";
import type {
  EidsStatusPayload,
  ListingWizardState,
  ListingWizardStepKey,
} from "../src/types/listingWizard";

type Envelope<T> = { data?: T };

function unwrap<T>(res: ApiResult<Envelope<T> | T>): ApiResult<T> {
  if (!res.ok) return res;
  const raw = res.data as Envelope<T> | T;
  if (raw && typeof raw === "object" && "data" in (raw as object)) {
    return { ok: true, data: (raw as Envelope<T>).data as T };
  }
  return { ok: true, data: raw as T };
}

export async function getListingWizard(listingId: string): Promise<ApiResult<ListingWizardState>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  const res = await authJsonFetch<Envelope<ListingWizardState>>(
    `/api/v1/self/listings/${encodeURIComponent(id)}/wizard`,
  );
  return unwrap(res);
}

export async function patchListingContent(
  listingId: string,
  version: number,
  fields: Record<string, unknown>,
): Promise<ApiResult<ListingWizardState>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  const res = await authJsonFetch<Envelope<ListingWizardState>>(
    `/api/v1/self/listings/${encodeURIComponent(id)}/content`,
    { method: "PATCH", json: { version: Number(version), ...fields } },
  );
  return unwrap(res);
}

export async function completeWizardStep(
  listingId: string,
  stepKey: ListingWizardStepKey | string,
  version: number,
): Promise<ApiResult<ListingWizardState>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  const res = await authJsonFetch<Envelope<ListingWizardState>>(
    `/api/v1/self/listings/${encodeURIComponent(id)}/wizard/steps/${encodeURIComponent(stepKey)}`,
    { method: "PATCH", json: { version: Number(version) } },
  );
  return unwrap(res);
}

export async function jumpWizardStep(
  listingId: string,
  version: number,
  currentStep: ListingWizardStepKey | string,
): Promise<ApiResult<ListingWizardState>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  const res = await authJsonFetch<Envelope<ListingWizardState>>(
    `/api/v1/self/listings/${encodeURIComponent(id)}/wizard`,
    { method: "PATCH", json: { version: Number(version), current_step: currentStep } },
  );
  return unwrap(res);
}

export async function fetchEidsStatus(listingId?: string): Promise<ApiResult<EidsStatusPayload>> {
  const q = listingId ? `?listing_id=${encodeURIComponent(listingId)}` : "";
  const res = await authJsonFetch<Envelope<EidsStatusPayload>>(`/api/v1/self/eids/status${q}`);
  return unwrap(res);
}

export async function startEidsLogin(options?: {
  returnPath?: string;
  listingId?: string;
  mobileRedirect?: boolean;
}): Promise<ApiResult<{ auth_url?: string }>> {
  const res = await authJsonFetch<Envelope<{ auth_url?: string }>>("/api/v1/self/eids/start", {
    method: "POST",
    json: {
      return_path: options?.returnPath || "/portal/ilan/olustur/",
      mobile_state: {
        mobile_redirect: Boolean(options?.mobileRedirect ?? true),
        listing_id: options?.listingId || "",
      },
    },
  });
  return unwrap(res);
}

export async function authorizeListingEids(
  listingId: string,
  version: number,
  tasinmazId: string,
): Promise<ApiResult<ListingWizardState>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  const res = await authJsonFetch<Envelope<ListingWizardState>>(
    `/api/v1/self/listings/${encodeURIComponent(id)}/eids/authorize`,
    { method: "POST", json: { version: Number(version), tasinmaz_id: tasinmazId } },
  );
  return unwrap(res);
}

export async function uploadListingMedia(
  listingId: string,
  version: number,
  file: { uri: string; type?: string; name?: string },
): Promise<ApiResult<ListingWizardState>> {
  const id = String(listingId || "").trim();
  if (!id) return { ok: false, error: "listing_id gerekli" };
  const form = new FormData();
  form.append("version", String(version));
  form.append("file", {
    uri: file.uri,
    type: file.type || "image/jpeg",
    name: file.name || "photo.jpg",
  } as unknown as Blob);
  const res = await authFormFetch<Envelope<ListingWizardState>>(
    `/api/v1/self/listings/${encodeURIComponent(id)}/media`,
    form,
  );
  return unwrap(res);
}

export async function generateListingDescription(
  listingId: string,
  context: Record<string, unknown>,
): Promise<ApiResult<{ description?: string; title?: string }>> {
  const id = String(listingId || "").trim();
  const res = await authJsonFetch<Envelope<{ description?: string; title?: string }>>(
    `/api/v1/self/listings/${encodeURIComponent(id)}/ai-description`,
    { method: "POST", json: { context } },
  );
  return unwrap(res);
}

export async function generateListingTitle(
  listingId: string,
  context: Record<string, unknown>,
): Promise<ApiResult<{ title?: string }>> {
  const id = String(listingId || "").trim();
  const res = await authJsonFetch<Envelope<{ title?: string }>>(
    `/api/v1/self/listings/${encodeURIComponent(id)}/ai-title`,
    { method: "POST", json: { context } },
  );
  return unwrap(res);
}

export async function fetchListingCategoryBreadcrumb(
  leafId: string,
): Promise<ApiResult<{ breadcrumb?: Array<{ id?: string; label?: string }> }>> {
  const res = await authJsonFetch<Envelope<{ breadcrumb?: Array<{ id?: string; label?: string }> }>>(
    `/api/v1/public/listing-categories/breadcrumb/${encodeURIComponent(leafId)}`,
  );
  return unwrap(res);
}
