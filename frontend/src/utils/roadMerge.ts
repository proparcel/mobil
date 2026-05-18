/**
 * Yol birleştirme (merge): draft + mevcut yol snap/merge mantığı.
 * - computeMergeCandidate: draft uçlarının boundary veya mevcut yola snap adayı
 * - mergeRoads: draft + mevcut yolu tek polyline'da birleştir
 * - cleanupMergedPolyline: ardışık yakın noktaları temizle
 */

import type { Point } from "../types/parcelSplit";
import { closestPointOnRing } from "./roadGeometry";

export type RoadMergePreview = {
  active: boolean;
  draftEndpointIndex: 0 | 1;
  targetType: "boundary" | "road";
  targetPoint: Point;
  targetRoadSegmentIndex?: number;
  distance: number;
};

const EPS = 0.01;

/** Noktanın polyline üzerindeki en yakın nokta, mesafe karesi ve segment indeksi. */
function closestPointOnPolyline(
  p: Point,
  polyline: Point[]
): { point: Point; distSq: number; segmentIndex: number } | null {
  if (!polyline || polyline.length < 2) return null;
  let bestPoint: Point | null = null;
  let bestDistSq = Infinity;
  let bestSeg = -1;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const ab2 = abx * abx + aby * aby || 1e-20;
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      bestPoint = { x: cx, y: cy };
      bestSeg = i;
    }
  }
  if (!bestPoint || bestSeg < 0) return null;
  return { point: bestPoint, distSq: bestDistSq, segmentIndex: bestSeg };
}

/**
 * Draft uçları için boundary ve mevcut yol snap adaylarını hesaplar.
 * En küçük distance'lı candidate döner.
 */
export function computeMergeCandidate(
  draftPoints: Point[],
  existingRoad: Point[] | null,
  parentRing: Point[],
  tolMeters: number
): RoadMergePreview | null {
  if (!draftPoints || draftPoints.length < 2 || !parentRing || parentRing.length < 3) return null;
  const tolSq = tolMeters * tolMeters;
  const start = draftPoints[0];
  const end = draftPoints[draftPoints.length - 1];
  let best: RoadMergePreview | null = null;

  for (const [endpoint, endpointIndex] of [
    [start, 0] as const,
    [end, 1] as const,
  ]) {
    const p = endpoint as Point;
    const idx = endpointIndex as 0 | 1;

    const { point: boundaryPoint, distSq: boundaryDistSq } = closestPointOnRing(p, parentRing);
    if (boundaryDistSq <= tolSq) {
      const d = Math.sqrt(boundaryDistSq);
      if (!best || d < best.distance) {
        best = {
          active: true,
          draftEndpointIndex: idx,
          targetType: "boundary",
          targetPoint: boundaryPoint,
          distance: d,
        };
      }
    }

    if (existingRoad && existingRoad.length >= 2) {
      const roadRes = closestPointOnPolyline(p, existingRoad);
      if (roadRes && roadRes.distSq <= tolSq) {
        const d = Math.sqrt(roadRes.distSq);
        if (!best || d < best.distance) {
          best = {
            active: true,
            draftEndpointIndex: idx,
            targetType: "road",
            targetPoint: roadRes.point,
            targetRoadSegmentIndex: roadRes.segmentIndex,
            distance: d,
          };
        }
      }
    }
  }
  return best;
}

/**
 * Draft + mevcut yolu tek polyline'da birleştirir.
 * preview.targetType === "road" ise mevcut yola splice; "boundary" ise sadece draft'ı targetPoint'e snap edip extend.
 */
export function mergeRoads(
  draftPoints: Point[],
  existingRoad: Point[] | null,
  preview: RoadMergePreview,
  parentRing: Point[]
): Point[] {
  if (!draftPoints || draftPoints.length < 2) return [];
  const cleaned = cleanupMergedPolyline(draftPoints);
  if (cleaned.length < 2) return existingRoad ? [...existingRoad] : [];

  if (preview.targetType === "boundary") {
    const out = [...cleaned];
    if (preview.draftEndpointIndex === 0) {
      out[0] = preview.targetPoint;
    } else {
      out[out.length - 1] = preview.targetPoint;
    }
    return cleanupMergedPolyline(out);
  }

  if (preview.targetType === "road" && existingRoad && existingRoad.length >= 2) {
    const segIdx = Math.max(0, preview.targetRoadSegmentIndex ?? 0);
    const target = preview.targetPoint;

    const existingPartA = existingRoad.slice(0, segIdx + 1);
    const existingPartB = existingRoad.slice(segIdx + 1);

    const draftRest =
      preview.draftEndpointIndex === 0 ? cleaned.slice(1) : cleaned.slice(0, -1);

    const merged = [
      ...existingPartA,
      target,
      ...draftRest,
      ...existingPartB,
    ];
    return cleanupMergedPolyline(merged);
  }

  return existingRoad ? [...existingRoad] : cleaned;
}

/**
 * Mevcut yol yokken veya merge preview yokken: iki polyline'ı en yakın uçlardan birleştirir.
 */
export function appendRoadsByClosestEndpoints(
  existing: Point[],
  draft: Point[]
): Point[] {
  if (!draft || draft.length < 2) return existing;
  if (!existing || existing.length < 2) return draft;
  const exStart = existing[0];
  const exEnd = existing[existing.length - 1];
  const drStart = draft[0];
  const drEnd = draft[draft.length - 1];
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const d1 = d(exStart, drEnd);
  const d2 = d(exStart, drStart);
  const d3 = d(exEnd, drStart);
  const d4 = d(exEnd, drEnd);
  const best = Math.min(d1, d2, d3, d4);
  if (best === d1) return cleanupMergedPolyline([...draft, ...existing]);
  if (best === d2) return cleanupMergedPolyline([...draft].reverse().concat(existing));
  if (best === d3) return cleanupMergedPolyline([...existing, ...draft]);
  return cleanupMergedPolyline([...existing, ...[...draft].reverse()]);
}

/**
 * Ardışık çok yakın noktaları siler, min 2 vertex.
 */
export function cleanupMergedPolyline(merged: Point[]): Point[] {
  if (!merged || merged.length < 2) return merged;
  const epsSq = EPS * EPS;
  const out: Point[] = [merged[0]];
  for (let i = 1; i < merged.length; i++) {
    const prev = out[out.length - 1];
    const curr = merged[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (dx * dx + dy * dy > epsSq) out.push(curr);
  }
  if (out.length < 2 && merged.length >= 2) {
    out.push(merged[merged.length - 1]);
  }
  return out;
}
