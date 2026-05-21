/**
 * Ada/parsel TKGM sorgusu — ana sayfa `handleAdaParselSubmit` ile aynı endpoint.
 */

import { authJsonFetch } from "../../services/apiClient";
import type { AdaParselSubmitPayload } from "../../components/AdaParselForm";
import { parseAreaM2 } from "./dfaRows";

export type TkgmParcelResponse = {
  geometry?: unknown;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

export async function fetchTkgmParcelByAdaParsel(
  payload: AdaParselSubmitPayload,
): Promise<{ ok: true; data: TkgmParcelResponse } | { ok: false; error: string }> {
  const res = await authJsonFetch<TkgmParcelResponse>("/api/tkgm_view/", {
    method: "POST",
    json: {
      mahalleTkgmValue: payload.mahalleTkgmValue,
      mahalle: payload.mahalle,
      ada: payload.ada,
      parsel: payload.parsel,
      proparcelValue: payload.proparcelValue,
      map_mode: "2d",
      is3D: false,
    },
  });

  if (!res.ok) {
    return { ok: false, error: res.error || "TKGM sorgusu başarısız" };
  }

  if (!res.data?.geometry) {
    return { ok: false, error: "Parsel bulunamadı veya geometri alınamadı." };
  }

  return { ok: true, data: res.data };
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
