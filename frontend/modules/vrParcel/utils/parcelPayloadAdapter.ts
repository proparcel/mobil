import type { VrLatLon } from "../types/vrParcelPayload";
import type { VrParcelPayload } from "../types/vrParcelPayload";
import type { VrParcelSource } from "../types/vrParcelSource";

function pickValue(source: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const k of keys) {
    const v = source?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parseAreaM2(props: Record<string, unknown>): number | undefined {
  const raw =
    props?.alan ??
    props?.yuzolcum ??
    props?.Yuzolcum ??
    props?.ALAN ??
    props?.area ??
    props?.Area ??
    props?.area_m2;
  if (raw === null || raw === undefined || raw === "") return undefined;
  let n: number;
  if (typeof raw === "string") {
    const cleaned = String(raw)
      .trim()
      .replace(/\s/g, "")
      .replace(/m²|m2/gi, "")
      .replace(/\./g, "")
      .replace(",", ".");
    n = parseFloat(cleaned);
  } else {
    n = Number(raw);
  }
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

/** Modül içi GeoJSON normalize — shared parcelUtils değiştirilmez. */
function normalizeGeometryCoordinates(geometry: { type?: string; coordinates?: unknown }): typeof geometry {
  if (!geometry?.coordinates) return geometry;

  let first: [number, number] | null = null;
  try {
    const coords = geometry.coordinates as unknown;
    if (geometry.type === "Polygon" && Array.isArray((coords as number[][][])?.[0]?.[0])) {
      first = (coords as number[][][])[0][0] as [number, number];
    } else if (geometry.type === "MultiPolygon" && Array.isArray((coords as number[][][][])?.[0]?.[0]?.[0])) {
      first = (coords as number[][][][])[0][0][0] as [number, number];
    }
  } catch {
    /* ignore */
  }

  if (!first || typeof first[0] !== "number" || typeof first[1] !== "number") return geometry;

  const x = first[0];
  const y = first[1];
  const looksLikeLatLonTR =
    Number.isFinite(x) && Number.isFinite(y) && x >= 35 && x <= 43 && y >= 25 && y <= 46;
  if (!looksLikeLatLonTR) return geometry;

  const swap = (coords: unknown): unknown => {
    if (!Array.isArray(coords)) return coords;
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      return [coords[1], coords[0], ...coords.slice(2)];
    }
    return (coords as unknown[]).map(swap);
  };

  return { ...geometry, coordinates: swap(geometry.coordinates) };
}

function collectRingCoords(geometry: { type?: string; coordinates?: unknown }): [number, number][] {
  const allCoords: [number, number][] = [];
  const coords = geometry.coordinates as unknown;
  if (geometry.type === "Polygon" && Array.isArray(coords)) {
    const ring = (coords as number[][][])[0];
    if (ring) {
      for (const coord of ring) {
        if (coord && coord.length >= 2) allCoords.push([coord[0], coord[1]]);
      }
    }
  } else if (geometry.type === "MultiPolygon" && Array.isArray(coords)) {
    for (const polygon of coords as number[][][][]) {
      const ring = polygon?.[0];
      if (!ring) continue;
      for (const coord of ring) {
        if (coord && coord.length >= 2) allCoords.push([coord[0], coord[1]]);
      }
    }
  }
  return allCoords;
}

function ringToLatLonPolygon(ring: [number, number][]): VrLatLon[] {
  const polygon: VrLatLon[] = [];
  for (const [lon, lat] of ring) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    polygon.push({ lat, lon });
  }
  if (polygon.length > 1) {
    const first = polygon[0];
    const last = polygon[polygon.length - 1];
    if (first.lat === last.lat && first.lon === last.lon) {
      polygon.pop();
    }
  }
  return polygon;
}

function computeCentroid(ring: [number, number][]): VrLatLon | null {
  if (!ring.length) return null;
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;
  for (const [lon, lat] of ring) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    sumLon += lon;
    sumLat += lat;
    count += 1;
  }
  if (count === 0) return null;
  return { lat: sumLat / count, lon: sumLon / count };
}

export function buildVrParcelPayload(source: VrParcelSource): VrParcelPayload | null {
  if (!source?.geometry) return null;

  const normalized = normalizeGeometryCoordinates(source.geometry);
  const ring = collectRingCoords(normalized);
  const polygon = ringToLatLonPolygon(ring);
  if (polygon.length < 3) return null;

  const props = (source.properties || {}) as Record<string, unknown>;
  const ada = pickValue(props, ["adaNo", "ada", "Ada"]);
  const parsel = pickValue(props, ["parselNo", "parsel", "Parsel"]);
  const city = pickValue(props, ["ilAd", "il", "cityName", "CityName"]);
  const town = pickValue(props, ["ilceAd", "ilce", "townName", "TownName"]);
  const quarter = pickValue(props, ["mahalleAd", "mahalle", "quarterName", "QuarterName"]);
  const areaM2 = parseAreaM2(props);
  const center = computeCentroid(ring);
  if (!center) return null;

  const mahalle = quarter;
  const idFromProps = [city, town, mahalle, ada, parsel].filter(Boolean).join("-");
  const parcelId =
    source.id != null && String(source.id).trim() !== ""
      ? String(source.id)
      : idFromProps || `parcel-${Date.now()}`;

  return {
    parcelId,
    city: city || undefined,
    town: town || undefined,
    quarter: quarter || undefined,
    ada: ada || "—",
    parsel: parsel || "—",
    areaM2,
    center,
    polygon,
  };
}

export function hasValidVrPolygon(source: VrParcelSource | null): boolean {
  if (!source) return false;
  return buildVrParcelPayload(source) !== null;
}
