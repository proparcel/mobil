import { haversineMetres } from "./calibrationEngine";
import { latLonToLocalMetres } from "./geoLocalMetres";
import type { MapReferencePointKey, MapReferencePoints } from "../types/mapReferencePoints";
import type { VrLatLon } from "../types/vrParcelPayload";

/** Harita referans çiftleri için minimum kabul mesafesi (metre). */
export const MIN_MAP_REF_DISTANCE_M = 3;
/** Daha yüksek hassasiyet için önerilen mesafe. */
export const RECOMMENDED_MAP_REF_DISTANCE_M = 5;

export type MapReferenceValidationCode =
  | "ok"
  | "too_close"
  | "collinear"
  | "incomplete";

export function mapPointLabel(key: MapReferencePointKey): string {
  switch (key) {
    case "userPoint":
      return "Konumunuz";
    case "referenceA":
      return "Hedef A";
    case "referenceB":
      return "Hedef B";
  }
}

export function validateMapReferencePair(
  a: VrLatLon,
  b: VrLatLon,
): { code: MapReferenceValidationCode; distanceM: number; message: string } {
  const distanceM = haversineMetres(a.lat, a.lon, b.lat, b.lon);
  if (distanceM < MIN_MAP_REF_DISTANCE_M) {
    return {
      code: "too_close",
      distanceM,
      message: `Referans noktaları birbirine çok yakın (${distanceM.toFixed(1)} m). En az ${MIN_MAP_REF_DISTANCE_M} m mesafe bırakın.`,
    };
  }
  return {
    code: "ok",
    distanceM,
    message:
      distanceM < RECOMMENDED_MAP_REF_DISTANCE_M
        ? `${distanceM.toFixed(1)} m — kabul edildi (önerilen: ${RECOMMENDED_MAP_REF_DISTANCE_M} m+).`
        : `${distanceM.toFixed(1)} m — iyi mesafe.`,
  };
}

function minTriangleAreaForDistance(minDistM: number): number {
  // Eşkenar üçgen alanının ~%85'i: 3 m kenar → ~3.3 m² alt sınır
  return ((minDistM * minDistM * Math.sqrt(3)) / 4) * 0.85;
}

export function validateMapReferenceTriangle(
  refs: Partial<MapReferencePoints>,
): { ok: boolean; message?: string; quality: "low" | "ok" | "good" } {
  const { userPoint, referenceA, referenceB } = refs;
  if (!userPoint || !referenceA || !referenceB) {
    return { ok: false, quality: "low", message: "Üç harita noktası da seçilmeli." };
  }

  const ab = validateMapReferencePair(referenceA, referenceB);
  const ua = validateMapReferencePair(userPoint, referenceA);
  const ub = validateMapReferencePair(userPoint, referenceB);

  if (ab.code === "too_close" || ua.code === "too_close" || ub.code === "too_close") {
    return { ok: false, quality: "low", message: ab.message };
  }

  const uLocal = latLonToLocalMetres(userPoint, userPoint);
  const aLocal = latLonToLocalMetres(referenceA, userPoint);
  const bLocal = latLonToLocalMetres(referenceB, userPoint);
  const area2 =
    Math.abs(
      (aLocal.east - uLocal.east) * (bLocal.north - uLocal.north) -
        (bLocal.east - uLocal.east) * (aLocal.north - uLocal.north),
    ) / 2;

  const minDist = Math.min(ab.distanceM, ua.distanceM, ub.distanceM);
  const minArea = minTriangleAreaForDistance(minDist);
  if (area2 < minArea) {
    return {
      ok: false,
      quality: "low",
      message: "Seçilen üç nokta neredeyse aynı doğrultuda. Daha geniş açılı noktalar seçin.",
    };
  }

  if (minDist >= RECOMMENDED_MAP_REF_DISTANCE_M) return { ok: true, quality: "good" };
  return { ok: true, quality: "ok" };
}

export function validateMapUserAgainstGps(
  mapUser: VrLatLon,
  gpsLat: number,
  gpsLon: number,
  gpsAccuracyM: number,
): { ok: boolean; distanceM: number; message?: string } {
  const distanceM = haversineMetres(mapUser.lat, mapUser.lon, gpsLat, gpsLon);
  const threshold = Math.max(40, gpsAccuracyM * 2);
  if (distanceM > threshold) {
    return {
      ok: false,
      distanceM,
      message: `Harita konumunuz ile GPS yaklaşık ${Math.round(distanceM)} m sapıyor. GPS kararsız olabilir.`,
    };
  }
  return { ok: true, distanceM };
}
