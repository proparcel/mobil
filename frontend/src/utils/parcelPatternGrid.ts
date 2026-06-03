import type { RefObject } from 'react';
import bbox from '@turf/bbox';
import { feature } from '@turf/helpers';
import type { FeatureCollection, Geometry, Point, Polygon, Position } from 'geojson';
import type { ParcelFillPatternId } from '../constants/parcelPolygonDesign';
import {
  getPatternCellPx,
  getPatternGlyph,
  getPatternGridSpacingDeg,
  getPatternMapTextSize,
  getPatternTextSizeFromCellPx,
  PATTERN_CELL_PX_MAX,
  PATTERN_CELL_PX_MIN,
  PATTERN_MAX_GRID_POINTS,
  resolvePatternSizeScale,
} from '../constants/parcelPolygonDesign';
import {
  computeScreenBBoxFromPoints,
  type ScreenBBox,
  unprojectScreenPointsBatch,
} from '../maps/drawing/shapeScreenProjection';

export type ParcelPatternBuildOptions = {
  patternSizeScale?: number;
};

/** Harita projeksiyonu için parsel dış halka köşeleri */
export function collectGeometryRingCoords(geometry: Geometry): [number, number][] {
  const out: [number, number][] = [];
  const pushRing = (ring: Position[] | undefined) => {
    if (!ring?.length) return;
    const limit = ring.length > 1 ? ring.length - 1 : ring.length;
    for (let i = 0; i < limit; i++) {
      const c = ring[i];
      if (c && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
        out.push([c[0], c[1]]);
      }
    }
  };

  if (geometry.type === 'Polygon') {
    pushRing(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      pushRing(poly?.[0]);
    }
  }
  return out;
}

function ringContainsPoint(ring: Position[], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const denom = yj - yi;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (Math.abs(denom) < 1e-12 ? 1e-12 : denom) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(lng: number, lat: number, geometry: Geometry): boolean {
  if (geometry.type === 'Polygon') {
    const poly = geometry as Polygon;
    if (!poly.coordinates[0]?.length) return false;
    if (!ringContainsPoint(poly.coordinates[0], lng, lat)) return false;
    for (let h = 1; h < poly.coordinates.length; h++) {
      if (ringContainsPoint(poly.coordinates[h], lng, lat)) return false;
    }
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polyCoords) => {
      const poly: Polygon = { type: 'Polygon', coordinates: polyCoords };
      return pointInGeometry(lng, lat, poly);
    });
  }
  return false;
}

type ResolvedCell = { cellPx: number; textSize: number };

/** Ekran bbox + kullanıcı ölçeğine göre hücre; yoğunluk zoom ile birlikte değişir, glif boyutu sabit kalır */
export function resolvePatternCellForScreenBBox(
  screenBBox: ScreenBBox,
  userScale?: number | null
): ResolvedCell {
  let cellPx = getPatternCellPx(userScale);

  const estimateCount = (size: number) =>
    Math.max(1, Math.floor(screenBBox.w / size)) * Math.max(1, Math.floor(screenBBox.h / size));

  let count = estimateCount(cellPx);

  while (count > PATTERN_MAX_GRID_POINTS && cellPx < PATTERN_CELL_PX_MAX) {
    cellPx = Math.min(PATTERN_CELL_PX_MAX, Math.ceil(cellPx * 1.12));
    count = estimateCount(cellPx);
  }

  while (
    count < 2 &&
    cellPx > PATTERN_CELL_PX_MIN &&
    screenBBox.w > cellPx * 1.6 &&
    screenBBox.h > cellPx * 1.6
  ) {
    cellPx = Math.max(PATTERN_CELL_PX_MIN, Math.floor(cellPx * 0.88));
    count = estimateCount(cellPx);
  }

  return { cellPx, textSize: getPatternTextSizeFromCellPx(cellPx) };
}

/** Ekran piksel ızgarası — kaydırılmış satırlar (bal peteği) */
export function buildScreenGridCenters(screenBBox: ScreenBBox, cellPx: number): [number, number][] {
  const pad = cellPx * 0.38;
  const minX = screenBBox.minX + pad;
  const maxX = screenBBox.maxX - pad;
  const minY = screenBBox.minY + pad;
  const maxY = screenBBox.maxY - pad;

  if (maxX <= minX || maxY <= minY) {
    return [[(screenBBox.minX + screenBBox.maxX) / 2, (screenBBox.minY + screenBBox.maxY) / 2]];
  }

  const centers: [number, number][] = [];
  let row = 0;
  for (let y = minY + cellPx * 0.5; y <= maxY; y += cellPx) {
    const xShift = (row % 2) * (cellPx * 0.5);
    for (let x = minX + cellPx * 0.5 + xShift; x <= maxX; x += cellPx) {
      centers.push([x, y]);
    }
    row += 1;
  }
  return centers;
}

type PatternGlyphCandidate = {
  screen: [number, number];
  lng: number;
  lat: number;
  textSize: number;
};

function screenDistanceSq(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Ekranda üst üste binen glifleri gizle — ilk geçen korunur */
export function cullOverlappingPatternGlyphs(
  candidates: PatternGlyphCandidate[],
  minSeparationPx: number
): PatternGlyphCandidate[] {
  const minSep = Math.max(minSeparationPx, 1);
  const minSepSq = minSep * minSep;
  const kept: PatternGlyphCandidate[] = [];

  for (const item of candidates) {
    const overlaps = kept.some((other) => screenDistanceSq(item.screen, other.screen) < minSepSq);
    if (!overlaps) kept.push(item);
  }

  return kept;
}

type GeographicGlyphCandidate = {
  lng: number;
  lat: number;
  textSize: number;
};

function cullOverlappingGeographicGlyphs(
  candidates: GeographicGlyphCandidate[],
  minLatSep: number,
  minLngSep: number
): GeographicGlyphCandidate[] {
  const kept: GeographicGlyphCandidate[] = [];
  for (const item of candidates) {
    const overlaps = kept.some(
      (other) =>
        Math.abs(item.lng - other.lng) < minLngSep && Math.abs(item.lat - other.lat) < minLatSep
    );
    if (!overlaps) kept.push(item);
  }
  return kept;
}

/**
 * Ana yol: parseli ekran px ızgarasına böl, merkezleri coğrafi koordinata çevir.
 * Zoom in/out → hücre sayısı değişir; hücre/glif boyutu (px) sabit kalır → binme yok.
 */
export async function buildParcelPatternScreenGrid(
  mapRef: RefObject<any>,
  geometry: Geometry,
  patternId: ParcelFillPatternId,
  patternSizeScale = 1,
  projectedRing: [number, number][]
): Promise<FeatureCollection<Point>> {
  const glyph = getPatternGlyph(patternId);
  if (patternId === 'none' || !glyph) {
    return { type: 'FeatureCollection', features: [] };
  }

  const screenBBox = computeScreenBBoxFromPoints(projectedRing);
  if (!screenBBox) {
    return { type: 'FeatureCollection', features: [] };
  }

  const { cellPx, textSize } = resolvePatternCellForScreenBBox(screenBBox, patternSizeScale);
  const screenCenters = buildScreenGridCenters(screenBBox, cellPx);
  const lngLats = await unprojectScreenPointsBatch(mapRef, screenCenters);

  const candidates: PatternGlyphCandidate[] = [];
  for (let i = 0; i < lngLats.length; i++) {
    const ll = lngLats[i];
    const screen = screenCenters[i];
    if (!ll) continue;
    const [lng, lat] = ll;
    if (!pointInGeometry(lng, lat, geometry)) continue;
    candidates.push({ screen, lng, lat, textSize });
  }

  const minSeparationPx = Math.max(textSize * 0.92, cellPx * 0.78);
  const visible = cullOverlappingPatternGlyphs(candidates, minSeparationPx);

  const features: FeatureCollection<Point>['features'] = visible.map((item) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
    properties: { glyph, textSize: item.textSize },
  }));

  return { type: 'FeatureCollection', features };
}

function resolveBuildOptions(
  patternSizeScaleOrOptions: number | ParcelPatternBuildOptions
): ParcelPatternBuildOptions {
  if (typeof patternSizeScaleOrOptions === 'number') {
    return { patternSizeScale: patternSizeScaleOrOptions };
  }
  return patternSizeScaleOrOptions;
}

/**
 * Harita hazır değilken coğrafi bbox yedek ızgarası (sabit derece aralığı).
 */
export function buildParcelPatternPointCollection(
  geometry: Geometry | null | undefined,
  patternId: ParcelFillPatternId,
  patternSizeScaleOrOptions: number | ParcelPatternBuildOptions = 1
): FeatureCollection<Point> {
  const options = resolveBuildOptions(patternSizeScaleOrOptions);
  const userScale = options.patternSizeScale ?? 1;
  const glyph = getPatternGlyph(patternId);
  if (!geometry || patternId === 'none' || !glyph) {
    return { type: 'FeatureCollection', features: [] };
  }

  const effectiveScale = resolvePatternSizeScale(userScale);
  const textSize = getPatternMapTextSize(effectiveScale);
  const spacingDeg = getPatternGridSpacingDeg(effectiveScale);

  let minLng: number;
  let minLat: number;
  let maxLng: number;
  let maxLat: number;
  try {
    const b = bbox(feature(geometry));
    [minLng, minLat, maxLng, maxLat] = b;
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }

  const latMid = (minLat + maxLat) / 2;
  const cosLat = Math.max(0.25, Math.cos((latMid * Math.PI) / 180));
  const stepLng = spacingDeg / cosLat;

  const features: FeatureCollection<Point>['features'] = [];
  let row = 0;
  const geoCandidates: GeographicGlyphCandidate[] = [];

  for (let lat = minLat; lat <= maxLat + spacingDeg * 0.25; lat += spacingDeg) {
    const lngShift = (row % 2) * (stepLng * 0.5);
    for (let lng = minLng - lngShift; lng <= maxLng + stepLng; lng += stepLng) {
      if (!pointInGeometry(lng, lat, geometry)) continue;
      geoCandidates.push({ lng, lat, textSize });
    }
    row += 1;
  }

  const visible = cullOverlappingGeographicGlyphs(
    geoCandidates,
    spacingDeg * 0.82,
    stepLng * 0.82
  );

  for (const item of visible) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
      properties: { glyph, textSize: item.textSize },
    });
  }

  return { type: 'FeatureCollection', features };
}
