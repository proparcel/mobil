/**
 * Hisseli Parsel ekranı için geometri transform yardımcıları.
 * GeoJSON polygon / { type, ring } → normalize → metre (Web Mercator) + local origin.
 * View transform: world ↔ screen, fit-to-view.
 */

import type { Point, ViewTransform } from "../types/parcelSplit";

const R = 6378137; // metres (WGS84 sphere for Web Mercator)

function lonLatToMercatorMeters(lon: number, lat: number): Point {
  const maxLat = 85.05112878;
  const clampedLat = Math.max(-maxLat, Math.min(maxLat, lat));
  const x = (lon * Math.PI / 180) * R;
  const y = Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI / 180) / 2)) * R;
  return { x, y };
}

/** Web Mercator metre koordinatlarını WGS84 lon/lat'e çevir. */
export function mercatorMetersToLonLat(x: number, y: number): { lon: number; lat: number } {
  const lon = (x / R) * (180 / Math.PI);
  const latRad = Math.atan(Math.exp(y / R)) - Math.PI / 4;
  const lat = latRad * (360 / Math.PI);
  return { lon, lat };
}

/** lon/lat → Web Mercator metre → origin çıkar → local metre (parcel-split canvas koordinatı). */
export function lonLatToLocalMeters(lon: number, lat: number, originMeters: Point): Point {
  const m = lonLatToMercatorMeters(lon, lat);
  return { x: m.x - originMeters.x, y: m.y - originMeters.y };
}

/** Ring'i metre koordinatlarından bbox merkezine göre local metreye çeker; origin (mercator metre) döndürür.
 * Y ekseni çevrilir (y_local = cy - p.y) böylece Mercator kuzeyi (büyük y) ekranda yukarı (küçük SVG y) gelir;
 * aksi halde poligon ayna simetrisi (ters) görünürdü. */
export function toLocalMeters(ringMeters: Point[]): { points: Point[]; originMeters: Point } {
  if (!ringMeters || ringMeters.length < 3) {
    return { points: ringMeters || [], originMeters: { x: 0, y: 0 } };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ringMeters) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const points = ringMeters.map((p) => ({ x: p.x - cx, y: cy - p.y }));
  return { points, originMeters: { x: cx, y: cy } };
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function sanitizeRing(rawRing: unknown[]): Point[] {
  const out: Point[] = [];
  for (const p of rawRing || []) {
    const x = Array.isArray(p) ? toNum(p[0]) : toNum((p as { x?: number; lng?: number; lon?: number })?.x ?? (p as { lng?: number })?.lng ?? (p as { lon?: number })?.lon);
    const y = Array.isArray(p) ? toNum(p[1]) : toNum((p as { y?: number; lat?: number })?.y ?? (p as { lat?: number })?.lat);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  const dedup: Point[] = [];
  for (const pt of out) {
    const prev = dedup[dedup.length - 1];
    if (!prev || prev.x !== pt.x || prev.y !== pt.y) dedup.push(pt);
  }
  return dedup;
}

function parseRingFromCoords(ring: unknown[]): Point[] | null {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  const out: Point[] = [];
  for (const c of ring) {
    const arr = Array.isArray(c) ? c : [];
    const x = toNum(arr[0]);
    const y = toNum(arr[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push({ x, y });
  }
  return out.length >= 3 ? out : null;
}

export function getRingFromGeoJSON(geom: unknown): Point[] | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as { type?: string; coordinates?: unknown[] };
  if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) return null;
  if (g.type === "Polygon") {
    const ring = g.coordinates[0];
    return parseRingFromCoords(ring as unknown[]);
  }
  if (g.type === "MultiPolygon" && g.coordinates.length > 0) {
    const firstPoly = g.coordinates[0];
    const ring = Array.isArray(firstPoly) ? (firstPoly as unknown[])[0] : null;
    return ring ? parseRingFromCoords(ring as unknown[]) : null;
  }
  return null;
}

function isRingFormat(g: unknown): g is { type: string; ring: unknown[] } {
  return (
    !!g &&
    typeof g === "object" &&
    (g as { type?: string }).type === "Polygon" &&
    Array.isArray((g as { ring?: unknown[] }).ring)
  );
}

export type NormalizeToRingResult = { ring: Point[]; originMeters: Point } | null;

/** Normalize raw param to ring (local metre). GeoJSON: lon/lat → Web Mercator metre → local origin. */
export function normalizeToRing(raw: unknown): NormalizeToRingResult {
  if (raw == null) {
    if (__DEV__) console.log("[ParcelSplit] POLIGON YOK – normalizeToRing: raw null/undefined");
    return null;
  }
  if (__DEV__) {
    const rawType = typeof raw;
    const preview = rawType === "string" ? (raw as string).slice(0, 120) : rawType;
    console.log("[ParcelSplit] normalizeToRing raw", { rawType, preview });
  }
  while (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      if (__DEV__) console.log("[ParcelSplit] POLIGON YOK – normalizeToRing: JSON parse hatası");
      return null;
    }
  }
  if (typeof raw !== "object") {
    if (__DEV__) console.log("[ParcelSplit] POLIGON YOK – normalizeToRing: raw object değil", { typeof: typeof raw });
    return null;
  }
  const g = raw as { type?: string; coordinates?: unknown[]; ring?: unknown[] };
  if (g.coordinates != null) {
    const parsed = getRingFromGeoJSON(raw);
    const ringLonLat = parsed ? sanitizeRing(parsed) : [];
    if (ringLonLat.length < 3) {
      if (__DEV__) console.log("[ParcelSplit] POLIGON YOK – normalizeToRing: GeoJSON parse/sanitize < 3", { type: g.type, length: ringLonLat.length });
      return null;
    }
    const ringMeters = ringLonLat.map((p) => lonLatToMercatorMeters(p.x, p.y));
    const { points: ringLocal, originMeters } = toLocalMeters(ringMeters);
    if (ringLocal.length < 3) return null;
    const first = ringLocal[0];
    const last = ringLocal[ringLocal.length - 1];
    if (first.x !== last.x || first.y !== last.y) ringLocal.push({ ...first });
    if (__DEV__) {
      console.log("[ParcelSplit] normalizeToRing from GeoJSON (metre)", { type: g.type, ringLength: ringLocal.length, first: ringLocal[0], originMeters });
    }
    return { ring: ringLocal, originMeters };
  }
  if (isRingFormat(raw)) {
    const r = (raw as { ring: unknown[] }).ring;
    const ring = sanitizeRing(r);
    if (ring.length < 3) {
      if (__DEV__) console.log("[ParcelSplit] POLIGON YOK – normalizeToRing: ring formatında < 3 nokta (sanitize sonrası)", { length: ring.length });
      return null;
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first.x !== last.x || first.y !== last.y) ring.push({ ...first });
    return { ring, originMeters: { x: 0, y: 0 } };
  }
  if (__DEV__) {
    console.log("[ParcelSplit] POLIGON YOK – normalizeToRing: geçerli geometri yok", {
      hasCoordinates: g.coordinates != null,
      hasType: g.type,
      isRingFormat: isRingFormat(raw),
    });
  }
  return null;
}

export type Bbox = { minX: number; maxX: number; minY: number; maxY: number };

export function getBbox(ring: Point[]): Bbox {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of ring) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }
  return { minX, maxX, minY, maxY };
}

export function fitRingToView(
  ring: Point[],
  width: number,
  height: number,
  padding: number
): string {
  const b = getBbox(ring);
  const t = computeFitToView(b, width, height, padding);
  return ringToScreenPoints(ring, t);
}

export function worldToScreen(
  p: Point,
  t: ViewTransform
): { x: number; y: number } {
  return {
    x: p.x * t.scale + t.translateX,
    y: p.y * t.scale + t.translateY,
  };
}

export function screenToWorld(
  p: { x: number; y: number },
  t: ViewTransform
): Point {
  return {
    x: (p.x - t.translateX) / t.scale,
    y: (p.y - t.translateY) / t.scale,
  };
}

/** Max scale so tiny bbox doesn't blow up (e.g. span ~1e-6). */
const MAX_FIT_SCALE = 1e6;

export function computeFitToView(
  bbox: Bbox,
  width: number,
  height: number,
  padding: number
): ViewTransform {
  const { minX, maxX, minY, maxY } = bbox;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const w = width - 2 * padding;
  const h = height - 2 * padding;
  const scale = Math.min(w / spanX, h / spanY, MAX_FIT_SCALE);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const translateX = width / 2 - cx * scale;
  const translateY = height / 2 - cy * scale;
  if (__DEV__) {
    console.log("[ParcelSplit] computeFitToView", {
      bbox: { minX, maxX, minY, maxY },
      spanX,
      spanY,
      width,
      height,
      padding,
      scale,
      translateX,
      translateY,
    });
  }
  return { scale, translateX, translateY };
}

export function ringToScreenPoints(ring: Point[], t: ViewTransform): string {
  return ring.map((p) => {
    const s = worldToScreen(p, t);
    return `${s.x},${s.y}`;
  }).join(" ");
}

/** World-coord polygon points string for SVG viewBox coords (e.g. clipPath). */
export function ringToWorldPoints(ring: Point[]): string {
  return ring.map((p) => `${p.x},${p.y}`).join(" ");
}
