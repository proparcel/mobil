/**
 * Yol çizimi: polyline buffer (koridor polygon), intersection, difference.
 * - Köşelerde round join (daralma/asimetri yok).
 * - İsteğe bağlı: polyline uçlarını parsel sınırına uzatma (görünüm birleştirme).
 * polygon-clipping kullanır; ring formatı parcelSplitEngine ile uyumlu.
 */

import type { Point } from "../types/parcelSplit";
import * as polygonClipping from "polygon-clipping";
import { pointInPolygon } from "./parcelSplitEngine";

export type ClippingRing = [number, number][];

export function ringToClipping(ring: Point[]): ClippingRing {
  return ring.map((p) => [p.x, p.y] as [number, number]);
}

export function clippingToRing(r: ClippingRing): Point[] {
  return r.map((c) => ({ x: c[0], y: c[1] }));
}

/**
 * Doğru (P1-P2) ile segment (A-B) kesişimi.
 * Doğru: P1 + t*(P2-P1). Segment: A + s*(B-A), s in [0,1].
 * Kesim noktası döner; yoksa null.
 */
function lineSegmentIntersection(
  P1: Point,
  P2: Point,
  A: Point,
  B: Point
): Point | null {
  const vx = P2.x - P1.x;
  const vy = P2.y - P1.y;
  const wx = B.x - A.x;
  const wy = B.y - A.y;
  const ux = P1.x - A.x;
  const uy = P1.y - A.y;
  const wxv = wx * vy - wy * vx;
  const vxw = vx * wy - vy * wx;
  if (Math.abs(wxv) < 1e-12) return null; // paralel
  const s = (ux * vy - uy * vx) / wxv;
  const t = (ux * wy - uy * wx) / vxw;
  if (s < -1e-9 || s > 1 + 1e-9) return null;
  return { x: A.x + s * wx, y: A.y + s * wy };
}

/**
 * Noktanın ring kenarına (segmentlere) en yakın mesafe karesi ve o segmentteki en yakın nokta.
 */
export function closestPointOnRing(p: Point, ring: Point[]): { point: Point; distSq: number } {
  const n = ring.length - 1;
  if (n < 1) return { point: ring[0] ?? p, distSq: Infinity };
  let best: Point = ring[0];
  let bestDistSq = Infinity;
  for (let i = 0; i < n; i++) {
    const A = ring[i];
    const B = ring[i + 1];
    const abx = B.x - A.x;
    const aby = B.y - A.y;
    const apx = p.x - A.x;
    const apy = p.y - A.y;
    const ab2 = abx * abx + aby * aby || 1e-20;
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = A.x + t * abx;
    const cy = A.y + t * aby;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      best = { x: cx, y: cy };
    }
  }
  return { point: best, distSq: bestDistSq };
}

/**
 * Polyline'ın ilk/son noktasını parsel sınırına uzatır (sadece kullanıcı sınıra yakın çizmişse).
 * - İlk nokta: (points[0], points[1]) doğrusunu points[0] yönünde uzatıp ring ile ilk kesişimi alır; bu nokta ring'e tolerance içindeyse points[0] yerine koyar.
 * - Son nokta: (points[n-2], points[n-1]) doğrusunu points[n-1] yönünde uzatıp ring ile kesişim; aynı mantık.
 */
export function extendPolylineToBoundary(
  points: Point[],
  parentRing: Point[],
  toleranceMeters: number
): Point[] {
  const n = points.length;
  if (n < 2 || !parentRing?.length) return points;
  const tolSq = toleranceMeters * toleranceMeters;
  const out = [...points];
  const rn = parentRing.length;
  if (rn < 2) return out;

  // İlk nokta: ray p1 -> p0 ve ötesi (sınırı kesen ilk nokta, p0'a yakın tarafta)
  const p0 = points[0];
  const p1 = points[1];
  const { distSq: d0Sq } = closestPointOnRing(p0, parentRing);
  if (d0Sq <= tolSq) {
    const rayStart = p1;
    const rayEnd = {
      x: p0.x + (p0.x - p1.x) * 1000,
      y: p0.y + (p0.y - p1.y) * 1000,
    };
    const dx = rayEnd.x - rayStart.x;
    const dy = rayEnd.y - rayStart.y;
    const len2 = dx * dx + dy * dy || 1e-20;
    const t0 = ((p0.x - rayStart.x) * dx + (p0.y - rayStart.y) * dy) / len2;
    let best: Point | null = null;
    let bestT = Infinity;
    for (let i = 0; i < rn - 1; i++) {
      const A = parentRing[i];
      const B = parentRing[i + 1];
      const hit = lineSegmentIntersection(rayStart, rayEnd, A, B);
      if (!hit) continue;
      const t = ((hit.x - rayStart.x) * dx + (hit.y - rayStart.y) * dy) / len2;
      if (t >= t0 - 1e-9 && t < bestT) {
        bestT = t;
        best = hit;
      }
    }
    if (best) out[0] = best;
  }

  // Son nokta: ray pn1 -> pn0 ve ötesi
  const pn0 = points[n - 1];
  const pn1 = points[n - 2];
  const { distSq: dnSq } = closestPointOnRing(pn0, parentRing);
  if (dnSq <= tolSq) {
    const rayStart = pn1;
    const rayEnd = {
      x: pn0.x + (pn0.x - pn1.x) * 1000,
      y: pn0.y + (pn0.y - pn1.y) * 1000,
    };
    const dx = rayEnd.x - rayStart.x;
    const dy = rayEnd.y - rayStart.y;
    const len2 = dx * dx + dy * dy || 1e-20;
    const t0 = ((pn0.x - rayStart.x) * dx + (pn0.y - rayStart.y) * dy) / len2;
    let best: Point | null = null;
    let bestT = Infinity;
    for (let i = 0; i < rn - 1; i++) {
      const A = parentRing[i];
      const B = parentRing[i + 1];
      const hit = lineSegmentIntersection(rayStart, rayEnd, A, B);
      if (!hit) continue;
      const t = ((hit.x - rayStart.x) * dx + (hit.y - rayStart.y) * dy) / len2;
      if (t >= t0 - 1e-9 && t < bestT) {
        bestT = t;
        best = hit;
      }
    }
    if (best) out[n - 1] = best;
  }

  return out;
}

/**
 * Polyline'ı widthMeters genişliğinde koridor polygon yapar.
 * - Uçlarda round cap.
 * - Köşelerde round join (daralma/asimetri olmaz).
 */
export function buildRoadBufferPolygon(polylinePoints: Point[], widthMeters: number): Point[] {
  const n = polylinePoints.length;
  if (n < 2) return [];
  const W = Math.max(0.5, Math.min(30, widthMeters)) / 2;

  // Her vertex için gelen ve çıkan yönlerde sol/sağ offset noktaları
  const leftIn: Point[] = [];
  const leftOut: Point[] = [];
  const rightIn: Point[] = [];
  const rightOut: Point[] = [];

  for (let i = 0; i < n; i++) {
    if (i < n - 1) {
      const a = polylinePoints[i];
      const b = polylinePoints[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1e-10;
      const nx = -dy / len;
      const ny = dx / len;
      leftOut.push({ x: a.x + nx * W, y: a.y + ny * W });
      rightOut.push({ x: a.x - nx * W, y: a.y - ny * W });
    }
    if (i > 0) {
      const a = polylinePoints[i - 1];
      const b = polylinePoints[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1e-10;
      const nx = -dy / len;
      const ny = dx / len;
      leftIn.push({ x: b.x + nx * W, y: b.y + ny * W });
      rightIn.push({ x: b.x - nx * W, y: b.y - ny * W });
    }
  }

  const capSegments = 12;
  const joinSegments = 8;

  const ring: Point[] = [];
  const p0 = polylinePoints[0];
  const pn = polylinePoints[n - 1];

  // Başlangıç cap (round)
  const r0 = rightOut[0];
  const l0 = leftOut[0];
  const angleR0 = Math.atan2(r0.y - p0.y, r0.x - p0.x);
  ring.push(r0);
  for (let k = 1; k < capSegments; k++) {
    const t = k / capSegments;
    const angle = angleR0 + Math.PI * t;
    ring.push({ x: p0.x + W * Math.cos(angle), y: p0.y + W * Math.sin(angle) });
  }
  ring.push(l0);

  // Sol taraf: l0 -> köşe round join'ler (arc leftIn[i-1] -> leftOut[i]) -> ln
  for (let i = 1; i < n - 1; i++) {
    const li = leftIn[i - 1];
    const lo = leftOut[i];
    ring.push(li); // arc başlangıcı
    const center = polylinePoints[i];
    const angleIn = Math.atan2(li.y - center.y, li.x - center.x);
    const angleOut = Math.atan2(lo.y - center.y, lo.x - center.x);
    let delta = angleOut - angleIn;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const steps = Math.max(2, Math.min(joinSegments, Math.ceil(Math.abs(delta) / (Math.PI / 12))));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      const angle = angleIn + delta * t;
      ring.push({ x: center.x + W * Math.cos(angle), y: center.y + W * Math.sin(angle) });
    }
  }

  const ln = leftIn[leftIn.length - 1]; // son vertex sol noktası (leftIn[n-2])
  const rn = rightOut[rightOut.length - 1];
  ring.push(ln);

  // Bitiş cap (round)
  const angleLn = Math.atan2(ln.y - pn.y, ln.x - pn.x);
  for (let k = 1; k < capSegments; k++) {
    const t = k / capSegments;
    const angle = angleLn + Math.PI * t;
    ring.push({ x: pn.x + W * Math.cos(angle), y: pn.y + W * Math.sin(angle) });
  }
  ring.push(rn);
  ring.push(rightIn[rightIn.length - 1]); // sağ taraf son vertex (rightIn[n-2])

  // Sağ taraf geri: köşe round join'ler -> r0
  for (let i = n - 2; i >= 1; i--) {
    const ri = rightIn[i - 1];
    const ro = rightOut[i];
    const center = polylinePoints[i];
    const angleOut = Math.atan2(ro.y - center.y, ro.x - center.x);
    const angleIn = Math.atan2(ri.y - center.y, ri.x - center.x);
    let delta = angleIn - angleOut;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const steps = Math.max(2, Math.min(joinSegments, Math.ceil(Math.abs(delta) / (Math.PI / 12))));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      const angle = angleOut + delta * t;
      ring.push({ x: center.x + W * Math.cos(angle), y: center.y + W * Math.sin(angle) });
    }
    ring.push(ri);
  }

  ring.push(r0);
  return ring;
}

/**
 * Polygon alanı (işaretli); en büyük polygon'u seçmek için.
 */
function ringArea(ring: Point[]): number {
  let area = 0;
  const m = ring.length - 1;
  for (let i = 0; i < m; i++) {
    area += ring[i].x * ring[i + 1].y - ring[i + 1].x * ring[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Yol koridor polygon ile parent kesişimi; parent dışına taşmaz.
 * Birden fazla parça dönerse (L vb.) en büyük alanlı parçayı döner; böylece tam yol korunur.
 */
export function intersectRoadWithParent(roadRing: Point[], parentRing: Point[]): Point[] | null {
  try {
    const roadPoly: polygonClipping.Polygon = [ringToClipping(roadRing)];
    const parentPoly: polygonClipping.Polygon = [ringToClipping(parentRing)];
    const result = polygonClipping.intersection(roadPoly, parentPoly);
    if (!result?.length) return null;
    let best: Point[] | null = null;
    let bestArea = 0;
    for (const poly of result) {
      if (poly?.[0]?.length >= 3) {
        const r = clippingToRing(poly[0]);
        const area = ringArea(r);
        if (area > bestArea) {
          bestArea = area;
          best = r;
        }
      }
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * Parent'tan yol polygon çıkarılır; difference sonucu (MultiPolygon) her polygon dış ring → Point[].
 */
export function subtractRoadFromParent(parentRing: Point[], roadRing: Point[]): Point[][] {
  try {
    const parentPoly: polygonClipping.Polygon = [ringToClipping(parentRing)];
    const roadPoly: polygonClipping.Polygon = [ringToClipping(roadRing)];
    const result = polygonClipping.difference(parentPoly, roadPoly);
    if (!result?.length) return [];
    const out: Point[][] = [];
    for (const poly of result) {
      if (poly?.[0]?.length >= 3) {
        out.push(clippingToRing(poly[0]));
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Doğru parçası (P1-P2) ile ring kenarlarının kesişim noktaları.
 */
function lineSegmentRingIntersections(P1: Point, P2: Point, ring: Point[]): Point[] {
  const hits: Point[] = [];
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const hit = lineSegmentIntersection(P1, P2, ring[i], ring[i + 1]);
    if (hit) hits.push(hit);
  }
  return hits;
}

/**
 * Parent bbox orta X'inden geçen dikey centerline (2 nokta, metre uzayında).
 */
export function createVerticalCenterline(parentRing: Point[]): Point[] {
  if (!parentRing || parentRing.length < 3) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of parentRing) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const pad = Math.max(maxX - minX, maxY - minY, 10) * 2;
  const hits = lineSegmentRingIntersections(
    { x: cx, y: minY - pad },
    { x: cx, y: maxY + pad },
    parentRing
  );
  if (hits.length < 2) return [{ x: cx, y: minY }, { x: cx, y: maxY }];
  hits.sort((a, b) => a.y - b.y);
  return [hits[0], hits[hits.length - 1]];
}

/**
 * Parent bbox orta Y'sinden geçen yatay centerline (2 nokta, metre uzayında).
 */
export function createHorizontalCenterline(parentRing: Point[]): Point[] {
  if (!parentRing || parentRing.length < 3) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of parentRing) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const cy = (minY + maxY) / 2;
  const pad = Math.max(maxX - minX, maxY - minY, 10) * 2;
  const hits = lineSegmentRingIntersections(
    { x: minX - pad, y: cy },
    { x: maxX + pad, y: cy },
    parentRing
  );
  if (hits.length < 2) return [{ x: minX, y: cy }, { x: maxX, y: cy }];
  hits.sort((a, b) => a.x - b.x);
  return [hits[0], hits[hits.length - 1]];
}

/**
 * Doğru (p1→p2) boyunca s parametresine göre sıralı ring kesişimleri.
 * p1 + s*(p2-p1) formunda; s değerine göre sıralı Point[] döner.
 */
function lineRingIntersectionsSorted(p1: Point, p2: Point, ring: Point[]): Point[] {
  const vx = p2.x - p1.x;
  const vy = p2.y - p1.y;
  const len2 = vx * vx + vy * vy || 1e-20;
  const hits: { s: number; p: Point }[] = [];
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const hit = lineSegmentIntersection(p1, p2, ring[i], ring[i + 1]);
    if (hit) {
      const s = ((hit.x - p1.x) * vx + (hit.y - p1.y) * vy) / len2;
      hits.push({ s, p: hit });
    }
  }
  hits.sort((a, b) => a.s - b.s);
  return hits.map((h) => h.p);
}

/**
 * Seçili kenara paralel, polygon içine doğru offsetli centerline.
 * edgeIndex: parent ring'deki kenar indeksi; offsetMeters: içe kayma.
 * t doğrultusunda uzatılarak ring sınırına getirilir.
 */
export function createEdgeParallelCenterline(
  parentRing: Point[],
  edgeIndex: number,
  offsetMeters: number
): Point[] {
  if (!parentRing || parentRing.length < 3) return [];
  const n = parentRing.length - 1;
  const i = Math.max(0, Math.min(edgeIndex, n - 1));
  const a = parentRing[i];
  const b = parentRing[(i + 1) % parentRing.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1e-10;
  const nx = -dy / len;
  const ny = dx / len;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const inward = pointInPolygon({ x: mid.x + nx, y: mid.y + ny }, parentRing) ? 1 : -1;
  const d = inward * Math.abs(offsetMeters);
  const p1 = { x: a.x + nx * d, y: a.y + ny * d };
  const p2 = { x: b.x + nx * d, y: b.y + ny * d };
  const pad = Math.max(len * 2, 100);
  const q1 = { x: p1.x - dx / len * pad, y: p1.y - dy / len * pad };
  const q2 = { x: p2.x + dx / len * pad, y: p2.y + dy / len * pad };
  const hits = lineRingIntersectionsSorted(q1, q2, parentRing);
  if (hits.length < 2) return [p1, p2];
  return [hits[0], hits[hits.length - 1]];
}

/**
 * Polyline uçları ring dışındaysa en yakın ring noktasına çeker (kenara yapıştırma).
 * Kenara paralel yol sınırdan dışarı taşıyorsa uçları içeri çeker.
 */
export function clipPolylineToRing(points: Point[], parentRing: Point[]): Point[] {
  if (!points || points.length < 2 || !parentRing || parentRing.length < 3) return points ?? [];
  const out = [...points];
  if (!pointInPolygon(out[0], parentRing)) {
    const { point } = closestPointOnRing(out[0], parentRing);
    out[0] = point;
  }
  if (!pointInPolygon(out[out.length - 1], parentRing)) {
    const { point } = closestPointOnRing(out[out.length - 1], parentRing);
    out[out.length - 1] = point;
  }
  return out;
}
