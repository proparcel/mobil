/**
 * Portal HTML sayfaları (ilan sihirbazı, mesajlar vb.) — Django kökü.
 * authJsonFetch ile aynı mantık: geliştirmede AUTH_API_URL (8000) tercih edilir.
 */
import { AUTH_API_URL, API_URL, FALLBACK_API_URL } from "./api";

export function getPortalSiteBaseUrl(): string {
  const raw = AUTH_API_URL || API_URL || FALLBACK_API_URL || "";
  return raw.replace(/\/$/, "");
}

/** Mobil uygulama / paylaşım — Django portal sayfalarında mobil şablon. */
export function withMobileViewQuery(url: string): string {
  const s = String(url ?? "").trim();
  if (!s) return s;
  try {
    const u = new URL(s);
    u.searchParams.set("mobile_view", "1");
    return u.toString();
  } catch {
    if (/[?&]mobile_view=/i.test(s)) return s;
    return s.includes("?") ? `${s}&mobile_view=1` : `${s}?mobile_view=1`;
  }
}

/** path örn. "/portal/ilan/ilanlarim/" */
export function portalPageUrl(path: string): string {
  const base = getPortalSiteBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return withMobileViewQuery(`${base}${p}`);
}

/** Pro sorgu / ilan detay paylaşım linki (web `listingDetailHref` ile uyumlu). */
export function portalDetailShareUrl(options: {
  listingId?: string | number | null;
  snapshotId?: string | number | null;
  preferListing?: boolean;
}): string {
  const lid = String(options.listingId ?? "").trim();
  const sidRaw = options.snapshotId;
  const sid =
    sidRaw != null && String(sidRaw).trim() !== "" ? String(sidRaw).trim() : "";

  if (options.preferListing !== false && lid) {
    return portalPageUrl(`/portal/recent-queries/listing/${encodeURIComponent(lid)}/`);
  }
  if (sid) {
    return portalPageUrl(`/portal/recent-queries/${encodeURIComponent(sid)}/`);
  }
  if (lid) {
    return portalPageUrl(`/portal/recent-queries/listing/${encodeURIComponent(lid)}/`);
  }
  return "";
}

/**
 * Mobil Share.share için doğrudan https portal URL (Universal / App Link hedefi).
 * /go/ sarmalayıcı WhatsApp iç tarayıcısında uygulamayı açmaz; doğrudan portal linki gerekir.
 */
export function portalDetailShareMessageUrl(options: {
  listingId?: string | number | null;
  snapshotId?: string | number | null;
  preferListing?: boolean;
}): string {
  return portalDetailShareUrl(options);
}

/** Tarayıcıda uygulama yoksa mağaza — web banner veya manuel /go/ için. */
export function portalDetailShareGoUrl(options: {
  listingId?: string | number | null;
  snapshotId?: string | number | null;
  preferListing?: boolean;
}): string {
  const ul = portalDetailShareUrl(options);
  if (!ul) return portalPageUrl("/go/");
  const params = new URLSearchParams();
  params.set("ul", ul);
  return portalPageUrl(`/go/?${params.toString()}`);
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
  const raw = qs ? `${base}${path}?${qs}` : `${base}${path}`;
  return withMobileViewQuery(raw);
}
