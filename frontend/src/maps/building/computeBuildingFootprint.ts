/**
 * Web building-manager.js (updateBuildingPreview) ile uyumlu bina tabanı (lon/lat ring) hesabı.
 * Mapbox FillExtrusion için kapalı polygon ring döner.
 */

import type { EdgeMeasureData, BBoxInfo } from "../../utils/edgeMeasurementsManager";
import type { RoofTemplateKey } from "./roofTemplates";

export type { RoofTemplateKey } from "./roofTemplates";

export type BuildingPositionPick =
  | "merkez"
  | "sol"
  | "sol-ust"
  | "ust"
  | "ust-sag"
  | "sag"
  | "sag-alt"
  | "alt"
  | "alt-sol";

export type BuildingFrameTemplateKey = "none" | "minimal_frame" | "grid_panel" | "soft_luxury";

export type BuildingSettings = {
  sag: number;
  sol: number;
  ust: number;
  alt: number;
  tabanM2: number;
  katSayisi: number;
  katYuksekligi: number;
  citYuksekligi: number;
  opacity: number;
  positionPick: BuildingPositionPick | string;
  genislik: number | null;
  uzunluk: number | null;
  /** Cam çerçeve şablonu (web ile aynı anahtarlar) */
  frameTemplate: BuildingFrameTemplateKey;
  /** Çatı şablonu (web ile aynı) */
  roofTemplate: RoofTemplateKey;
  /** Cam / kenarlık (web Cesium ile uyumlu) */
  windowGlassColor: string;
  windowBorderColor: string;
  windowBorderThicknessM: number;
  windowCrossMullion: boolean;
};

export function defaultBuildingSettings(): BuildingSettings {
  return {
    sag: 0,
    sol: 0,
    ust: 0,
    alt: 0,
    tabanM2: 100,
    katSayisi: 1,
    katYuksekligi: 3.2,
    citYuksekligi: 0,
    opacity: 100,
    positionPick: "merkez",
    genislik: null,
    uzunluk: null,
    frameTemplate: "none",
    roofTemplate: "flat_roof",
    windowGlassColor: "#475569",
    windowBorderColor: "#0f172a",
    windowBorderThicknessM: 0.08,
    windowCrossMullion: false,
  };
}

const getVal = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

/** Metre cinsinden doğu/kuzey ofsetini lon/lat'a çevir (web fallback ile aynı). */
function offsetMetersFromLonLat(lon: number, lat: number, dxEastM: number, dyNorthM: number): [number, number] {
  const lonOut = lon + dxEastM / (111320 * Math.cos((lat * Math.PI) / 180));
  const latOut = lat + dyNorthM / 110540;
  return [lonOut, latOut];
}

/** Yerel (u,v) vektörünü doğu-kuzey metreye çevir: [dxEast, dyNorth] */
function uvToEastNorth(u: number, v: number, cosR: number, sinR: number): [number, number] {
  const dx = u * cosR - v * sinR;
  const dy = u * sinR + v * cosR;
  return [dx, dy];
}

export type BuildingFootprintResult =
  | { ok: true; ring: [number, number][]; heightMeters: number; opacity01: number }
  | { ok: false; reason: string };

/** Kılavuz (çekme sonrası) iç dikdörtgen ölçüleri — max genişlik/uzunluk ve alan üst sınırı */
export type BuildingGuideLimits = {
  availW: number;
  availH: number;
  shortSideM: number;
  longSideM: number;
  maxRectAreaM2: number;
};

/**
 * Kenar çekme sonrası izin verilen taban dikdörtgeni (bbox u/v eksenleri).
 */
export function getBuildingGuideLimits(edgeData: EdgeMeasureData, settings: BuildingSettings): BuildingGuideLimits | null {
  const bbox = edgeData.bbox as BBoxInfo | undefined;
  if (!bbox?.center || bbox.center.length < 2) return null;

  const widthMBox = Number(bbox.width_m);
  const heightMBox = Number(bbox.height_m);
  if (!Number.isFinite(widthMBox) || !Number.isFinite(heightMBox) || widthMBox <= 0 || heightMBox <= 0) {
    return null;
  }

  const insetTop = getVal(settings.ust);
  const insetBottom = getVal(settings.alt);
  const insetRight = getVal(settings.sag);
  const insetLeft = getVal(settings.sol);

  const availW = Math.max(0.01, widthMBox - insetLeft - insetRight);
  const availH = Math.max(0.01, heightMBox - insetTop - insetBottom);
  const shortSideM = Math.min(availW, availH);
  const longSideM = Math.max(availW, availH);

  return {
    availW,
    availH,
    shortSideM,
    longSideM,
    maxRectAreaM2: availW * availH,
  };
}

/**
 * edge_measure_data + ayarlardan bina taban ring'i ve yükseklik (m) üretir.
 */
export function computeBuildingFootprint(
  edgeData: EdgeMeasureData,
  settings: BuildingSettings
): BuildingFootprintResult {
  const bbox = edgeData.bbox as BBoxInfo | undefined;
  if (!bbox?.center || bbox.center.length < 2) {
    return { ok: false, reason: "Kenar ölçü verisi (bbox) yok." };
  }

  const widthMBox = Number(bbox.width_m);
  const heightMBox = Number(bbox.height_m);
  if (!Number.isFinite(widthMBox) || !Number.isFinite(heightMBox) || widthMBox <= 0 || heightMBox <= 0) {
    return { ok: false, reason: "Parsel bbox genişlik/yükseklik bilgisi eksik. Önce kenar ölçülerini yükleyin." };
  }

  const insetTop = getVal(settings.ust);
  const insetBottom = getVal(settings.alt);
  const insetRight = getVal(settings.sag);
  const insetLeft = getVal(settings.sol);
  const targetArea = getVal(settings.tabanM2);

  const rotationRad = ((bbox.rotation_deg ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);

  const insetCenterU = (insetLeft - insetRight) / 2;
  const insetCenterV = (insetBottom - insetTop) / 2;

  const [dxInset, dyInset] = uvToEastNorth(insetCenterU, insetCenterV, cosR, sinR);
  const bboxCLon = bbox.center[0];
  const bboxCLat = bbox.center[1];
  const [centerLon, centerLat] = offsetMetersFromLonLat(bboxCLon, bboxCLat, dxInset, dyInset);

  let widthM: number;
  let heightM: number;

  const availW0 = Math.max(0.01, widthMBox - insetLeft - insetRight);
  const availH0 = Math.max(0.01, heightMBox - insetTop - insetBottom);

  const hasG = settings.genislik !== null && typeof settings.genislik === "number" && settings.genislik > 0;
  const hasU = settings.uzunluk !== null && typeof settings.uzunluk === "number" && settings.uzunluk > 0;

  if (hasG && hasU) {
    widthM = Math.min(Math.max(0.1, settings.genislik!), availW0);
    heightM = Math.min(Math.max(0.1, settings.uzunluk!), availH0);
    /* Alan üst sınırı UI’da (clampGenislik / clampUzunluk) zorunlu; burada ekstra ölçek yok */
  } else if (settings.genislik !== null && typeof settings.genislik === "number" && settings.genislik > 0) {
    widthM = Math.max(0.1, settings.genislik);
    if (targetArea > 0 && widthM > 0) {
      heightM = targetArea / widthM;
    } else {
      heightM = Math.max(0.1, heightMBox - insetTop - insetBottom);
    }
  } else if (settings.uzunluk !== null && typeof settings.uzunluk === "number" && settings.uzunluk > 0) {
    heightM = Math.max(0.1, settings.uzunluk);
    if (targetArea > 0 && heightM > 0) {
      widthM = targetArea / heightM;
    } else {
      widthM = Math.max(0.1, widthMBox - insetLeft - insetRight);
    }
  } else {
    widthM = Math.max(0.1, widthMBox - insetLeft - insetRight);
    heightM = Math.max(0.1, heightMBox - insetTop - insetBottom);
    if (targetArea > 0) {
      const currentArea = widthM * heightM;
      if (currentArea > 0) {
        const scale = Math.sqrt(targetArea / currentArea);
        widthM *= scale;
        heightM *= scale;
      }
    }
  }

  /** İzin verilen iç dikdörtgen (kılavuz / çekme sınırı) — taşmayı önle */
  const availW = availW0;
  const availH = availH0;
  const scaleFit = Math.min(1, availW / Math.max(widthM, 1e-9), availH / Math.max(heightM, 1e-9));
  widthM *= scaleFit;
  heightM *= scaleFit;

  const maxU = (widthMBox - insetLeft - insetRight - widthM) / 2;
  const maxV = (heightMBox - insetTop - insetBottom - heightM) / 2;
  let offsetU = 0;
  let offsetV = 0;
  const pos = String(settings.positionPick || "merkez");
  if (pos.includes("sol")) offsetU = -maxU;
  if (pos.includes("sag")) offsetU = maxU;
  if (pos.includes("ust")) offsetV = maxV;
  if (pos.includes("alt")) offsetV = -maxV;

  const finalU = insetCenterU + offsetU;
  const finalV = insetCenterV + offsetV;

  const halfW = widthM / 2;
  const halfH = heightM / 2;

  const cornersUv: [number, number][] = [
    [-halfW + finalU, -halfH + finalV],
    [halfW + finalU, -halfH + finalV],
    [halfW + finalU, halfH + finalV],
    [-halfW + finalU, halfH + finalV],
  ];

  const ringLonLat: [number, number][] = cornersUv.map(([u, v]) => {
    const [dx, dy] = uvToEastNorth(u, v, cosR, sinR);
    return offsetMetersFromLonLat(centerLon, centerLat, dx, dy);
  });

  // Kapalı ring
  if (ringLonLat.length >= 1) {
    ringLonLat.push([ringLonLat[0][0], ringLonLat[0][1]]);
  }

  const floors = Math.max(1, getVal(settings.katSayisi));
  const floorH = getVal(settings.katYuksekligi) > 0 ? getVal(settings.katYuksekligi) : 3.2;
  const buildingHeight = floors * floorH;

  let opacityValue = getVal(settings.opacity);
  opacityValue = Math.max(0, Math.min(100, opacityValue)) / 100;

  return {
    ok: true,
    ring: ringLonLat,
    heightMeters: buildingHeight,
    opacity01: opacityValue,
  };
}
