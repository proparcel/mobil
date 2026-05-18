/**
 * Bina taban poligonu (lon/lat ring) için alan (m²) ve dönüşümler.
 */

export type LngLatRing = [number, number][];

const METERS_PER_DEG_LAT = 111_320;

function cosLat(latDeg: number): number {
  return Math.cos((latDeg * Math.PI) / 180) || 1e-9;
}

/** Küçük poligonlar için yerel düzlem yaklaşımı (bina tabanı). */
export function ringAreaM2Approx(ring: LngLatRing): number {
  if (!ring || ring.length < 3) return 0;
  const refLat = ring[0][1];
  const mLon = METERS_PER_DEG_LAT * cosLat(refLat);
  const mLat = METERS_PER_DEG_LAT;
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n - 1; i++) {
    const x1 = ring[i][0] * mLon;
    const y1 = ring[i][1] * mLat;
    const x2 = ring[i + 1][0] * mLon;
    const y2 = ring[i + 1][1] * mLat;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function ringCentroidLngLat(ring: LngLatRing): [number, number] {
  let sx = 0;
  let sy = 0;
  let c = 0;
  const n = ring.length;
  for (let i = 0; i < n - 1; i++) {
    sx += ring[i][0];
    sy += ring[i][1];
    c += 1;
  }
  return c > 0 ? [sx / c, sy / c] : ring[0];
}

/** Metre cinsinden ofset (doğu/kuzey) — ModelManager ile aynı mantık */
export function offsetLngLatMeters(coord: [number, number], eastM: number, northM: number): [number, number] {
  const [lng, lat] = coord;
  const cos = cosLat(lat);
  const dLng = eastM / (METERS_PER_DEG_LAT * cos);
  const dLat = northM / METERS_PER_DEG_LAT;
  return [lng + dLng, lat + dLat];
}

/** Ring'i doğu-kuzey metre cinsinden ötele (tüm köşeler aynı delta). */
export function translateRingMeters(ring: LngLatRing, eastM: number, northM: number): LngLatRing {
  if (!ring.length) return ring;
  const p0 = ring[0];
  const p1 = offsetLngLatMeters(p0, eastM, northM);
  const dLng = p1[0] - p0[0];
  const dLat = p1[1] - p0[1];
  return ring.map(([lng, lat]) => [lng + dLng, lat + dLat] as [number, number]);
}

/** Merkez etrafında derece ile döndür (küçük alan). */
export function rotateRingDegrees(ring: LngLatRing, deltaDeg: number): LngLatRing {
  if (!ring.length) return ring;
  const c = ringCentroidLngLat(ring);
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const mLon = METERS_PER_DEG_LAT * cosLat(c[1]);
  const mLat = METERS_PER_DEG_LAT;
  return ring.map(([lng, lat]) => {
    const dx = (lng - c[0]) * mLon;
    const dy = (lat - c[1]) * mLat;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return offsetLngLatMeters(c, rx, ry);
  });
}

/** Merkez etrafında ölçek (1 = aynı). */
export function scaleRingUniform(ring: LngLatRing, factor: number): LngLatRing {
  if (!ring.length || !Number.isFinite(factor) || factor <= 0) return ring;
  const c = ringCentroidLngLat(ring);
  const mLon = METERS_PER_DEG_LAT * cosLat(c[1]);
  const mLat = METERS_PER_DEG_LAT;
  return ring.map(([lng, lat]) => {
    const dx = (lng - c[0]) * mLon;
    const dy = (lat - c[1]) * mLat;
    return offsetLngLatMeters(c, dx * factor, dy * factor);
  });
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = String(hex || "").trim();
  const m = /^#?([0-9a-fA-F]{6})$/.exec(h);
  if (!m) return { r: 156, g: 163, b: 175 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export const DEFAULT_BUILDING_HEX = "#9ca3af";
