/**
 * Portal HTML sayfaları (ilan sihirbazı, mesajlar vb.) — Django kökü.
 * authJsonFetch ile aynı mantık: geliştirmede AUTH_API_URL (8000) tercih edilir.
 */
import { AUTH_API_URL, API_URL, FALLBACK_API_URL } from "./api";

export function getPortalSiteBaseUrl(): string {
  const raw = AUTH_API_URL || API_URL || FALLBACK_API_URL || "";
  return raw.replace(/\/$/, "");
}

/** path örn. "/portal/ilan/ilanlarim/" */
export function portalPageUrl(path: string): string {
  const base = getPortalSiteBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Web ProMahalle — `quarter_info_v2` URL sözleşmesi ile uyumlu (`readQuarterIdsFromUrl`). */
export function promahallePageUrl(q?: {
  city_id?: string;
  town_id?: string;
  quarter_id?: string;
  proparcel_value?: string;
  tkgm_value?: string;
}): string {
  const base = getPortalSiteBaseUrl();
  const path = "/mahalle-bilgileri/";
  const sp = new URLSearchParams();
  const add = (k: string, v?: string) => {
    const s = String(v ?? "").trim();
    if (s) sp.set(k, s);
  };
  if (q) {
    add("city_id", q.city_id);
    add("town_id", q.town_id);
    add("quarter_id", q.quarter_id);
    add("proparcel_value", q.proparcel_value);
    add("tkgm_value", q.tkgm_value);
  }
  const qs = sp.toString();
  return qs ? `${base}${path}?${qs}` : `${base}${path}`;
}
