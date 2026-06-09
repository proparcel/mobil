import { latLonToLocalMetres } from "./geoLocalMetres";
import type { CalibrationTransform } from "../types/calibrationTransform";
import type { VrLatLon } from "../types/vrParcelPayload";

const EARTH_RADIUS_M = 6378137;

export type CalibrationValidationCode =
  | "ok"
  | "too_close"
  | "low_precision"
  | "gps_poor"
  | "tap_too_close";

export const MIN_AB_DISTANCE_M = 3;
export const LOW_PRECISION_AB_DISTANCE_M = 4;
export const MAX_GPS_ACCURACY_M = 25;
export const MIN_TAP_SEPARATION_M = 0.3;

export function haversineMetres(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function validateGpsReferences(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
  gpsAccuracyA: number,
  gpsAccuracyB: number,
): CalibrationValidationCode {
  const dist = haversineMetres(aLat, aLon, bLat, bLon);
  if (dist < MIN_AB_DISTANCE_M) return "too_close";
  if (gpsAccuracyA > MAX_GPS_ACCURACY_M || gpsAccuracyB > MAX_GPS_ACCURACY_M) return "gps_poor";
  if (dist < LOW_PRECISION_AB_DISTANCE_M) return "low_precision";
  return "ok";
}

export function validateTapSeparation(
  arAx: number,
  arAz: number,
  arBx: number,
  arBz: number,
): CalibrationValidationCode {
  const dx = arBx - arAx;
  const dz = arBz - arAz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < MIN_TAP_SEPARATION_M) return "tap_too_close";
  return "ok";
}

export function getCalibrationValidationMessage(code: CalibrationValidationCode): string {
  switch (code) {
    case "too_close":
      return `Referans noktaları birbirine çok yakın (GPS mesafe yetersiz). Canlı panelde en az ${MIN_AB_DISTANCE_M} m görünmeden kaydetmeyin.`;
    case "low_precision":
      return "Referans mesafesi kısa; hassasiyet düşük olabilir. Mümkünse 3–5 metre yürüyün.";
    case "gps_poor":
      return "Konum hassasiyeti düşük. Açık alanda tekrar deneyin.";
    case "tap_too_close":
      return "Kamerada işaretlediğiniz noktalar çok yakın. Lütfen tekrar deneyin.";
    default:
      return "";
  }
}

function rotateYaw(x: number, z: number, yawDeg: number): { x: number; z: number } {
  const rad = (yawDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos,
  };
}

export type ArPoint = { x: number; y: number; z: number };

/** RN fallback kamera projeksiyon sabitleri — tap ve çizim aynı modeli kullanır */
export const AR_SCREEN_PROJECTION = {
  xScale: 4,
  zScale: 6,
  yOrigin: 0.65,
  minZ: 0.5,
} as const;

export function screenToArPoint(
  screenX: number,
  screenY: number,
  screenW: number,
  screenH: number,
): ArPoint {
  const nx = (screenX / screenW - 0.5) * AR_SCREEN_PROJECTION.xScale;
  const nz = (AR_SCREEN_PROJECTION.yOrigin - screenY / screenH) * AR_SCREEN_PROJECTION.zScale;
  return {
    x: nx,
    y: 0,
    z: Math.max(AR_SCREEN_PROJECTION.minZ, nz),
  };
}

export function arPointToScreen(
  point: ArPoint,
  screenW: number,
  screenH: number,
): { x: number; y: number; visible: boolean } {
  if (point.z < AR_SCREEN_PROJECTION.minZ * 0.25) {
    return { x: 0, y: 0, visible: false };
  }
  const x = (point.x / AR_SCREEN_PROJECTION.xScale + 0.5) * screenW;
  const y = (AR_SCREEN_PROJECTION.yOrigin - point.z / AR_SCREEN_PROJECTION.zScale) * screenH;
  const margin = 80;
  const visible =
    x >= -margin &&
    x <= screenW + margin &&
    y >= -margin &&
    y <= screenH + margin;
  return { x, y, visible };
}

export function transformGpsToArPoint(
  lat: number,
  lon: number,
  transform: CalibrationTransform,
): ArPoint {
  const origin: VrLatLon = { lat: transform.originLat, lon: transform.originLon };
  const local = latLonToLocalMetres({ lat, lon }, origin);
  const mapped = rotateYaw(
    local.east * transform.scale,
    local.north * transform.scale,
    transform.rotationYaw,
  );
  return {
    x: mapped.x + transform.translationX,
    y: transform.translationY,
    z: mapped.z + transform.translationZ,
  };
}

export function projectPolygonToScreen(
  polygon: VrLatLon[],
  transform: CalibrationTransform,
  screenW: number,
  screenH: number,
): { x: number; y: number; visible: boolean }[] {
  return polygon.map((p) => {
    const ar = transformGpsToArPoint(p.lat, p.lon, transform);
    return arPointToScreen(ar, screenW, screenH);
  });
}

export function computeCalibrationTransform(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
  arPointA: ArPoint,
  arPointB: ArPoint,
  gpsAccuracyA: number,
  gpsAccuracyB: number,
): CalibrationTransform {
  const origin: VrLatLon = { lat: aLat, lon: aLon };
  const geoA = latLonToLocalMetres(origin, origin);
  const geoB = latLonToLocalMetres({ lat: bLat, lon: bLon }, origin);

  const vGeoEast = geoB.east - geoA.east;
  const vGeoNorth = geoB.north - geoA.north;
  const vArX = arPointB.x - arPointA.x;
  const vArZ = arPointB.z - arPointA.z;

  const yawGeo = Math.atan2(vGeoEast, vGeoNorth) * (180 / Math.PI);
  const yawAr = Math.atan2(vArX, vArZ) * (180 / Math.PI);
  const rotationYaw = yawGeo - yawAr;

  const lenGeo = Math.sqrt(vGeoEast * vGeoEast + vGeoNorth * vGeoNorth);
  const lenAr = Math.sqrt(vArX * vArX + vArZ * vArZ);
  let scale = lenAr > 0.01 ? lenGeo / lenAr : 1;
  scale = Math.max(0.5, Math.min(2, scale));

  const mappedA = rotateYaw(geoA.east * scale, geoA.north * scale, rotationYaw);
  const translationX = arPointA.x - mappedA.x;
  const translationY = arPointA.y;
  const translationZ = arPointA.z - mappedA.z;

  const distScore = lenGeo >= 3 ? 1 : lenGeo >= 2 ? 0.6 : 0.2;
  const gpsScore = 1 / (1 + (gpsAccuracyA + gpsAccuracyB) * 0.5);
  const tapScore = lenAr >= 0.5 ? 1 : 0.4;
  const accuracyScore = Math.max(0, Math.min(1, distScore * 0.5 + gpsScore * 0.3 + tapScore * 0.2));

  return {
    originLat: aLat,
    originLon: aLon,
    rotationYaw,
    translationX,
    translationY,
    translationZ,
    scale,
    accuracyScore,
    createdAt: new Date().toISOString(),
  };
}

export function applyFineTuneToTransform(
  transform: CalibrationTransform,
  dx: number,
  dz: number,
  dyawDeg: number,
): CalibrationTransform {
  return {
    ...transform,
    fineTuneEastM: (transform.fineTuneEastM ?? 0) + dx,
    fineTuneNorthM: (transform.fineTuneNorthM ?? 0) + dz,
    fineTuneYawDeg: (transform.fineTuneYawDeg ?? 0) + dyawDeg,
  };
}
