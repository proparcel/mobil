/**
 * Ada/parsel TKGM sorgusu — yalnızca doğrudan cbsapi.tkgm.gov.tr (backend tkgm_view yok).
 */

import { authJsonFetch } from "../../services/apiClient";
import type { AdaParselSubmitPayload } from "../../components/AdaParselForm";
import { parseAreaM2 } from "./dfaRows";
import { fetchTkgmByCoords, fetchTkgmByIds, type TkgmError, TKGM_NO_RESPONSE_MESSAGE, isTkgmNoResponseError } from "./tkgmApi";
import type { PassiveConfirmFn } from "./tkgmPassiveParcel";

export type TkgmParcelResponse = {
  geometry?: unknown;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

function mapTkgmCatch(error: unknown): string {
  const err = error as TkgmError;
  if (err?.type === "TKGM_PARCEL_NOT_FOUND") {
    return err.message || "Parsel bulunamadı";
  }
  if (err?.type === "TKGM_RATE_LIMIT") {
    return err.message || "Günlük sorgu limiti aşıldı. Lütfen daha sonra tekrar deneyin.";
  }
  if (err?.type === "TIMEOUT") {
    return TKGM_NO_RESPONSE_MESSAGE;
  }
  if (err?.type === "CORS_OR_NETWORK_ERROR") {
    return err.message || "Parsel servisine bağlanılamadı.";
  }
  if (err?.type === "TKGM_UNAVAILABLE" || isTkgmNoResponseError(err)) {
    return TKGM_NO_RESPONSE_MESSAGE;
  }
  if (err?.type === "TKGM_INVALID_DATA") {
    return err.message || "Beklenmeyen bir yanıt alındı.";
  }
  if (err?.type === "TKGM_ERROR") {
    return err.message || TKGM_NO_RESPONSE_MESSAGE;
  }
  return err?.message || "Parsel sorgusu başarısız";
}

/** proparcel_value → mahalle TKGM (DB lookup; TKGM API değil) */
export async function resolveMahalleTkgmForDirectQuery(
  mahalleTkgmValue: number | null | undefined,
  proparcelValue: number | null | undefined,
): Promise<{ ok: true; mahalleTkgmValue: number } | { ok: false; error: string }> {
  const direct = Number(mahalleTkgmValue);
  if (Number.isFinite(direct) && direct > 0) {
    return { ok: true, mahalleTkgmValue: direct };
  }

  const pv = Number(proparcelValue);
  if (!Number.isFinite(pv) || pv <= 0) {
    return { ok: false, error: "Mahalle kodu bulunamadı." };
  }

  const res = await authJsonFetch<{ mahalle_tkgm_value?: number | string }>(
    `/api/proparcel_tkgm_lookup/?proparcel_value=${encodeURIComponent(String(pv))}`,
    { method: "GET" },
  );

  if (!res.ok) {
    return { ok: false, error: res.error || "Mahalle eşlemesi alınamadı." };
  }

  const mid = Number(res.data?.mahalle_tkgm_value);
  if (!Number.isFinite(mid) || mid <= 0) {
    return { ok: false, error: "Mahalle eşlemesi bulunamadı." };
  }

  return { ok: true, mahalleTkgmValue: mid };
}

export async function fetchTkgmParcelByAdaParsel(
  payload: Pick<AdaParselSubmitPayload, "mahalleTkgmValue" | "ada" | "parsel">,
  confirm?: PassiveConfirmFn,
): Promise<{ ok: true; data: TkgmParcelResponse } | { ok: false; error: string }> {
  try {
    // Pasif parsel ise onay sonrası normalize edilmiş (aktif) feature döner.
    const data = await fetchTkgmByIds(
      payload.mahalleTkgmValue,
      payload.ada,
      payload.parsel,
      undefined,
      confirm,
    );
    if (!data?.geometry) {
      return { ok: false, error: "Parsel bulunamadı veya geometri alınamadı." };
    }
    return { ok: true, data: data as TkgmParcelResponse };
  } catch (error) {
    return { ok: false, error: mapTkgmCatch(error) };
  }
}

export async function fetchTkgmParcelByCoords(
  lat: number,
  lon: number,
  confirm?: PassiveConfirmFn,
): Promise<{ ok: true; data: TkgmParcelResponse } | { ok: false; error: string }> {
  try {
    // Pasif parsel ise onay sonrası normalize edilmiş (aktif) feature döner.
    const data = await fetchTkgmByCoords(lat, lon, undefined, confirm);
    if (!data?.geometry) {
      return { ok: false, error: "Parsel bulunamadı veya geometri alınamadı." };
    }
    return { ok: true, data: data as TkgmParcelResponse };
  } catch (error) {
    return { ok: false, error: mapTkgmCatch(error) };
  }
}

/** Drone / 3D lisans reference_id: mahalleTkgm_ada_parsel */
export function buildParcelReferenceId(
  payload: AdaParselSubmitPayload,
  tkgm: TkgmParcelResponse,
): string {
  const props = (tkgm.properties || {}) as Record<string, unknown>;
  const m = String(props.mahalleId ?? props.mahalle_id ?? payload.mahalleTkgmValue).trim();
  const a = String(props.adaNo ?? props.ada ?? payload.ada).trim();
  const p = String(props.parselNo ?? props.parsel ?? payload.parsel).trim();
  return `${m}_${a}_${p}`;
}

function pickTkgmAreaRaw(props: Record<string, unknown>, tkgm: TkgmParcelResponse): unknown {
  return (
    props.alan ??
    props.Alan ??
    props.ALAN ??
    props.yuzolcum ??
    props.Yuzolcum ??
    props.area ??
    props.Area ??
    props.area_m2 ??
    (tkgm as Record<string, unknown>).alan ??
    (tkgm as Record<string, unknown>).yuzolcum ??
    (tkgm as Record<string, unknown>).Area
  );
}

/** TKGM alan metni (ör. "2.450,00" veya "2450 m²") → gösterim */
export function formatTkgmArea(value: unknown): string {
  const n = parseAreaM2(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${Math.round(n).toLocaleString("tr-TR")} m²`;
}

export function formatTkgmResultSummary(
  payload: AdaParselSubmitPayload,
  tkgm: TkgmParcelResponse,
  nitelik?: string,
): string {
  const props = (tkgm.properties || {}) as Record<string, unknown>;
  const ada = String(props.adaNo ?? props.ada ?? payload.ada).trim();
  const parsel = String(props.parselNo ?? props.parsel ?? payload.parsel).trim();
  const alanText = formatTkgmArea(pickTkgmAreaRaw(props, tkgm));
  const parts = [
    [payload.city, payload.town, payload.mahalle].filter(Boolean).join(" / "),
    ada && parsel ? `${ada} / ${parsel}` : "",
    alanText,
    nitelik ? nitelik : "",
  ].filter(Boolean);
  return parts.join(" · ");
}
