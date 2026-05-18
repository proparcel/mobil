/**
 * Yol kaydırma (road slide) geometri motoru.
 * - Segment handle: yol tamamı paralel kayar (translate).
 * - Vertex handle: tek köşe (dx, dy) ile taşınır.
 */

import type { Point } from "../types/parcelSplit";

const GEOM_EPS = 1e-6;

/** Kenar birim normali (sol): normalize(b-a) dikey. */
function edgeUnitNormal(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/** Segment paralel kaydırma: tüm noktaları normal yönünde offsetMeters taşır. */
export function translateRoadParallel(
  points: Point[],
  segmentIndex: number,
  offsetMeters: number,
  parentRing: Point[] | null
): { newPoints: Point[]; appliedOffsetMeters: number; clamped: boolean } | null {
  if (!points || points.length < 2 || segmentIndex < 0 || segmentIndex >= points.length - 1) {
    return null;
  }
  const a = points[segmentIndex];
  const b = points[segmentIndex + 1];
  const normal = edgeUnitNormal(a, b);

  let applied = offsetMeters;
  if (parentRing && parentRing.length >= 3) {
    const range = computeSafeOffsetRangeForRoad(points, segmentIndex, normal, parentRing);
    if (offsetMeters < range.minD || offsetMeters > range.maxD) {
      applied = Math.max(range.minD, Math.min(range.maxD, offsetMeters));
    }
  }

  if (Math.abs(applied) < GEOM_EPS) return null;

  const newPoints = points.map((p) => ({
    x: p.x + normal.x * applied,
    y: p.y + normal.y * applied,
  }));

  const clamped = Math.abs(applied - offsetMeters) > GEOM_EPS;

  if (__DEV__) {
    console.log("[ROAD_SLIDE][APPLY]", {
      type: "segment",
      segmentIndex,
      offsetMeters,
      applied,
      clamped,
    });
  }

  return { newPoints, appliedOffsetMeters: applied, clamped };
}

/** Tek vertex taşıma (dx, dy metre). */
export function moveRoadVertex(
  points: Point[],
  vertexIndex: number,
  dx: number,
  dy: number
): Point[] | null {
  if (!points || points.length < 2 || vertexIndex < 0 || vertexIndex >= points.length) {
    return null;
  }
  if (Math.abs(dx) < GEOM_EPS && Math.abs(dy) < GEOM_EPS) return null;

  const newPoints = points.map((p, i) =>
    i === vertexIndex ? { x: p.x + dx, y: p.y + dy } : { x: p.x, y: p.y }
  );

  if (__DEV__) {
    console.log("[ROAD_SLIDE][APPLY]", {
      type: "vertex",
      vertexIndex,
      dx,
      dy,
    });
  }

  return newPoints;
}

/** Yol noktalarının parent ring dışına taşmaması için güvenli offset aralığı. */
export function computeSafeOffsetRangeForRoad(
  points: Point[],
  segmentIndex: number,
  normal: Point,
  parentRing: Point[]
): { minD: number; maxD: number } {
  const step = 0.5;
  let minD = 0;
  let maxD = 0;

  const testInParent = (pts: Point[]): boolean => {
    for (const p of pts) {
      if (!pointInPolygon(p, parentRing)) return false;
    }
    return true;
  };

  const tryOffset = (d: number): boolean => {
    const newPoints = points.map((p) => ({
      x: p.x + normal.x * d,
      y: p.y + normal.y * d,
    }));
    return testInParent(newPoints);
  };

  for (let d = step; d <= 100; d += step) {
    if (tryOffset(-d)) minD = -d;
    else break;
  }
  for (let d = step; d <= 100; d += step) {
    if (tryOffset(d)) maxD = d;
    else break;
  }

  return { minD, maxD };
}

function pointInPolygon(p: Point, ring: Point[]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Segment indeksine göre normal döner (projeksiyon için). */
export function getSegmentNormal(points: Point[], segmentIndex: number): Point | null {
  if (!points || points.length < 2 || segmentIndex < 0 || segmentIndex >= points.length - 1) {
    return null;
  }
  const a = points[segmentIndex];
  const b = points[segmentIndex + 1];
  return edgeUnitNormal(a, b);
}
