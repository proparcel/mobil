import { DeviceEventEmitter } from "react-native";
import { SAVED_QUERIES_CHANGED } from "../constants/savedQueriesEvents";
import { createSavedQueryApi } from "../../services/savedQueriesApi";
import { parseAreaM2 } from "./dfaRows";
import {
  resolveMahalleTkgmFromLocationsLabel,
  resolveMahalleTkgmFromLocationsParts,
} from "./resolveMahalleTkgmFromLocations";
import { loadSavedQueries, upsertSavedQuery, type LocationHeader, type QueryMode } from "./savedQueries";

export type QuerySubmitPayload = {
  mahalleTkgmValue: number;
  mahalle?: string;
  ada: string;
  parsel: string;
  proparcelValue?: number;
  city?: string;
  town?: string;
};

function pickTkgmMahalleValue(props: Record<string, unknown>): number {
  const candidates = [
    props.mahalleId,
    props.MahalleId,
    props.tkgm_value,
    props.Tkgm_value,
    props.mahalle_tkgm_value,
    props.mahalleTkgmValue,
    props.QuarterIdFinal,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
}

function resolveMahalleTkgmValue(
  p: Record<string, unknown>,
  form?: Partial<QuerySubmitPayload>
): number {
  let v = Number(form?.mahalleTkgmValue);
  if (Number.isFinite(v) && v > 0) return v;

  v = pickTkgmMahalleValue(p);
  if (Number.isFinite(v) && v > 0) return v;

  const ilAd = String(form?.city ?? p.ilAd ?? p.IlAd ?? "");
  const ilceAd = String(form?.town ?? p.ilceAd ?? p.IlceAd ?? "");
  const mahalleAd = String(form?.mahalle ?? p.mahalleAd ?? p.MahalleAd ?? "");

  const fromParts = resolveMahalleTkgmFromLocationsParts(ilAd, ilceAd, mahalleAd);
  if (fromParts != null) return fromParts;

  const fromLabel = resolveMahalleTkgmFromLocationsLabel(mahalleAd);
  if (fromLabel != null) return fromLabel;

  const pp = form?.proparcelValue ?? p.proparcel_value ?? p.Proparcel_value;
  const proparcel = pp != null ? Number(pp) : NaN;
  if (Number.isFinite(proparcel) && proparcel > 0) return proparcel;

  return NaN;
}

/** Ada/Parsel formu veya TKGM properties → kayıt payload */
export function buildQueryPayloadFromTkgmProperties(
  props: Record<string, unknown> | null | undefined,
  form?: Partial<QuerySubmitPayload>
): QuerySubmitPayload | null {
  const p = props || {};
  const ada = String(form?.ada ?? p.adaNo ?? p.ada ?? p.Ada ?? "").trim();
  const parsel = String(form?.parsel ?? p.parselNo ?? p.parsel ?? p.Parsel ?? "").trim();
  if (!ada || !parsel) {
    console.warn("[persistQuery] ada/parsel eksik — kayıt atlandı");
    return null;
  }

  const mahalleTkgmValue = resolveMahalleTkgmValue(p, form);
  if (!Number.isFinite(mahalleTkgmValue) || mahalleTkgmValue <= 0) {
    console.warn("[persistQuery] mahalle TKGM çözülemedi — kayıt atlandı", {
      ada,
      parsel,
      ilAd: p.ilAd,
      mahalleAd: p.mahalleAd,
    });
    return null;
  }

  const ppRaw = form?.proparcelValue ?? p.proparcel_value ?? p.Proparcel_value;
  const proparcelValue =
    ppRaw != null && Number.isFinite(Number(ppRaw)) ? Number(ppRaw) : undefined;

  return {
    mahalleTkgmValue,
    mahalle: String(form?.mahalle ?? p.mahalleAd ?? p.MahalleAd ?? "").trim() || undefined,
    ada,
    parsel,
    proparcelValue,
    city: form?.city ?? (typeof p.ilAd === "string" ? p.ilAd : undefined),
    town: form?.town ?? (typeof p.ilceAd === "string" ? p.ilceAd : undefined),
  };
}

/**
 * Web `ppSaveSidebarQueryFromForm` — TKGM sorgusu sonrası Sorgularım listesine yazar.
 */
export async function persistQueryToMyQueries(
  payload: QuerySubmitPayload,
  tkgmProperties: Record<string, unknown> | null | undefined,
  isAuthenticated: boolean,
  mode: QueryMode = "simple"
): Promise<boolean> {
  const merged = buildQueryPayloadFromTkgmProperties(tkgmProperties, payload);
  if (!merged) return false;

  const props = tkgmProperties || {};
  const { ada, parsel, mahalleTkgmValue } = merged;
  const areaRaw =
    props.alan ?? props.area ?? props.area_m2 ?? props.yuzolcum ?? props.Yuzolcum ?? props.YUZOLCUM;
  const areaM2 = parseAreaM2(areaRaw);
  const proparcelValue = merged.proparcelValue ?? null;

  const location_header: LocationHeader = {
    ilAd: (props.ilAd as string) ?? merged.city ?? null,
    ilceAd: (props.ilceAd as string) ?? merged.town ?? null,
    mahalleAd: (props.mahalleAd as string) ?? merged.mahalle ?? null,
    adaNo: ada,
    parselNo: parsel,
  };

  await upsertSavedQuery({
    proparcel_value: proparcelValue,
    tkgm_value: mahalleTkgmValue,
    ada,
    parsel,
    mode,
    price_snapshot: {
      unit_price: null,
      total_price: null,
      area_m2: areaM2 > 0 ? areaM2 : null,
    },
    location_header,
  });

  if (isAuthenticated) {
    const mahalleAd = location_header.mahalleAd || "";
    const apiTitle = mahalleAd ? `${mahalleAd} - ${ada}/${parsel}` : `${ada}/${parsel}`;
    try {
      const apiRes = await createSavedQueryApi({
        tkgm_value: mahalleTkgmValue,
        ada,
        parsel,
        title: apiTitle,
        proparcel_value: proparcelValue,
      });
      if (!apiRes.ok) {
        console.warn("[persistQuery] API kayıt hatası (yerel kayıt duruyor):", apiRes.error);
      }
    } catch (err) {
      console.warn("[persistQuery] API kayıt exception (yerel kayıt duruyor):", err);
    }
  }

  DeviceEventEmitter.emit(SAVED_QUERIES_CHANGED);

  if (__DEV__) {
    const n = (await loadSavedQueries()).length;
    console.log(`[persistQuery] Sorgularım kaydedildi (${mode}), cihazda ${n} kayıt`);
  }
  return true;
}

/** TKGM JSON cevabı (harita tıklama / form) — tüm giriş noktaları için */
export async function persistTkgmResponseToMyQueries(
  data: { properties?: Record<string, unknown> | null },
  isAuthenticated: boolean,
  mode: QueryMode,
  form?: Partial<QuerySubmitPayload>
): Promise<boolean> {
  const payload = buildQueryPayloadFromTkgmProperties(data.properties ?? undefined, form);
  if (!payload) return false;
  return persistQueryToMyQueries(payload, data.properties ?? undefined, isAuthenticated, mode);
}

export const persistSimpleQueryToMyQueries = persistQueryToMyQueries;
