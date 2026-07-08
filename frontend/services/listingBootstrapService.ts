/**
 * Pro sorgu snapshot → ilan taslağı bootstrap (web bootstrapFromPortalSnapshot.js port)
 */

import { createListingDraft } from "./listingService";
import {
  fetchListingCategoryBreadcrumb,
  getListingWizard,
  jumpWizardStep,
  patchListingContent,
} from "./listingWizardService";
import { getPortalRecentQuerySummary } from "./portalService";
import { queryTypeToDefaultListingLeafId } from "../src/utils/queryTypeToListingLeaf";

function sanitizeLocationLabels(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    out[k] = v;
  }
  return out;
}

export async function bootstrapListingFromPortalSnapshot(
  snapshotId: string,
): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  const sid = String(snapshotId ?? "").trim();
  if (!sid) return { ok: false, error: "Sorgu kimliği eksik." };

  const summaryRes = await getPortalRecentQuerySummary(Number(sid));
  if (!summaryRes.ok) return { ok: false, error: summaryRes.error || "Sorgu özeti alınamadı." };
  const summary = summaryRes.data as Record<string, unknown>;

  if (!summary.is_own_query) {
    return { ok: false, error: "Bu sorgu sonucu size ait değil." };
  }

  const leaf = queryTypeToDefaultListingLeafId(String(summary.query_type || ""));
  if (!leaf) {
    return {
      ok: false,
      error: "Bu sorgu tipi için otomatik kategori eşlemesi yok. Menüden kategori seçerek devam edin.",
    };
  }

  const bcRes = await fetchListingCategoryBreadcrumb(leaf);
  if (!bcRes.ok) return { ok: false, error: "Kategori bilgisi alınamadı." };
  const breadcrumb = Array.isArray(bcRes.data?.breadcrumb) ? bcRes.data!.breadcrumb! : [];

  const draftRes = await createListingDraft();
  if (!draftRes.ok) return { ok: false, error: draftRes.error || "Taslak oluşturulamadı." };
  const listingId = String(draftRes.data?.data?.listing_id || "").trim();
  if (!listingId) return { ok: false, error: "Taslak oluşturulamadı." };

  const wizRes = await getListingWizard(listingId);
  if (!wizRes.ok) return { ok: false, error: wizRes.error || "Sihirbaz yüklenemedi." };
  let version = Number(wizRes.data?.version ?? 0);

  const araziFromSnap =
    summary.arazi_m2 != null && summary.arazi_m2 !== "" ? Number(summary.arazi_m2) : null;
  const areaFromSummary =
    summary.area_m2 != null && summary.area_m2 !== "" ? Number(summary.area_m2) : null;
  const areaNum =
    araziFromSnap != null && Number.isFinite(araziFromSnap) && araziFromSnap > 0
      ? araziFromSnap
      : areaFromSummary != null && Number.isFinite(areaFromSummary) && areaFromSummary > 0
        ? areaFromSummary
        : null;

  const locationLabelsRaw = {
    il: summary.city_name || "",
    ilce: summary.town_name || "",
    mahalle: summary.quarter_name || "",
    ada: String(summary.ada ?? ""),
    parsel: String(summary.parsel ?? ""),
    alanM2:
      areaNum != null && Number.isFinite(areaNum) && areaNum > 0
        ? `${areaNum.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m²`
        : "",
    alanM2Numeric: areaNum != null && Number.isFinite(areaNum) && areaNum > 0 ? areaNum : undefined,
  };

  const originSnap = Number.parseInt(sid, 10);
  if (!Number.isFinite(originSnap) || originSnap <= 0) {
    return { ok: false, error: "Geçersiz sorgu kimliği." };
  }

  const fields: Record<string, unknown> = {
    category_leaf_id: leaf,
    category_breadcrumb: breadcrumb,
    title: (summary.title && String(summary.title).trim()) || "İlan",
    listing_type: "sale",
    currency: "TRY",
    portal_origin_snapshot_id: originSnap,
    ada: String(summary.ada ?? "").trim(),
    parsel: String(summary.parsel ?? "").trim(),
    city_id: summary.city_id != null ? String(summary.city_id) : "",
    district_id: summary.town_id != null ? String(summary.town_id) : "",
    quarter_id: summary.quarter_id != null ? String(summary.quarter_id) : "",
    proparcel_value:
      summary.proparcel_value != null && summary.proparcel_value !== ""
        ? Number(summary.proparcel_value)
        : null,
    mahalle_tkgm_value:
      summary.tkgm_value != null && summary.tkgm_value !== "" ? String(summary.tkgm_value) : "",
    location_resolved: true,
    location_labels: sanitizeLocationLabels(locationLabelsRaw),
  };

  if (areaNum != null && Number.isFinite(areaNum) && areaNum > 0) {
    fields.area_m2 = areaNum;
  }

  const la = summary.listing_attributes;
  if (la && typeof la === "object" && Object.keys(la as object).length > 0) {
    fields.listing_attributes = { ...(la as Record<string, unknown>) };
  }

  const totalPrice = summary.total_price ?? summary.listing_price_amount;
  if (totalPrice != null && Number.isFinite(Number(totalPrice)) && Number(totalPrice) > 0) {
    fields.price_amount = Math.round(Number(totalPrice));
  }

  const patchRes = await patchListingContent(listingId, version, fields);
  if (!patchRes.ok) return { ok: false, error: patchRes.error || "İlan içeriği yazılamadı." };
  version = Number(patchRes.data?.version ?? version);

  await jumpWizardStep(listingId, version, "eids_authorization");

  return { ok: true, listingId };
}
