/**
 * Hisseli Parsel: edge picking, polygon area, strip split, computeSplit.
 */

import type { Point, Polygon, PolygonEdge, Piece, LineString, RuleSet, SplitProfile, Orientation } from "../types/parcelSplit";
import { getBbox, type Bbox } from "./parcelSplitTransform";

export function buildEdges(ring: Point[]): PolygonEdge[] {
  const out: PolygonEdge[] = [];
  const n = ring.length;
  if (n < 3) return out;
  for (let i = 0; i < n - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    out.push({
      edgeId: String(i),
      i,
      a,
      b,
      mid,
      length,
      bbox: { minX, maxX, minY, maxY },
    });
  }
  return out;
}

export function distancePointToSegmentSquared(
  P: Point,
  A: Point,
  B: Point
): number {
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const apx = P.x - A.x;
  const apy = P.y - A.y;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 <= 1e-20 ? 0 : (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = A.x + t * abx;
  const cy = A.y + t * aby;
  const dx = P.x - cx;
  const dy = P.y - cy;
  return dx * dx + dy * dy;
}

export function pointInPolygon(P: Point, ring: Point[]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i].x, yi = ring[i].y;
    const xj = ring[j].x, yj = ring[j].y;
    if (yi > P.y !== yj > P.y && P.x < ((xj - xi) * (P.y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function pickNearestEdge(
  P: Point,
  edges: PolygonEdge[],
  tolW: number
): string | null {
  let bestId: string | null = null;
  let bestD2 = tolW * tolW;
  const expand = tolW;
  for (const e of edges) {
    const b = e.bbox;
    if (P.x < b.minX - expand || P.x > b.maxX + expand) continue;
    if (P.y < b.minY - expand || P.y > b.maxY + expand) continue;
    const d2 = distancePointToSegmentSquared(P, e.a, e.b);
    if (d2 < bestD2) {
      bestD2 = d2;
      bestId = e.edgeId;
    }
  }
  return bestId;
}

export function polygonArea(ring: Point[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n - 1; i++) {
    sum += ring[i].x * ring[i + 1].y - ring[i + 1].x * ring[i].y;
  }
  return Math.abs(sum) / 2;
}

export function getRules(profile: SplitProfile): RuleSet {
  if (profile === "arsa") {
    return {
      minArea: 100,
      areaToleranceRatio: 0.15,
      requireRoadFrontage: true,
      minFrontage: 5,
    };
  }
  return {
    minArea: 200,
    areaToleranceRatio: 0.25,
    requireRoadFrontage: false,
    minFrontage: 0,
  };
}

function toClippingRing(ring: Point[]): [number, number][] {
  return ring.map((p) => [p.x, p.y] as [number, number]);
}

function fromClippingRing(r: [number, number][]): Point[] {
  return r.map((c) => ({ x: c[0], y: c[1] }));
}

function makeVerticalBox(loX: number, hiX: number, minY: number, maxY: number): [number, number][] {
  return [
    [loX, minY],
    [hiX, minY],
    [hiX, maxY],
    [loX, maxY],
    [loX, minY],
  ];
}

function makeHorizontalBox(minX: number, maxX: number, loY: number, hiY: number): [number, number][] {
  return [
    [minX, loY],
    [maxX, loY],
    [maxX, hiY],
    [minX, hiY],
    [minX, loY],
  ];
}

export type SplitResult = {
  pieces: Piece[];
  splitLines: LineString[];
  cuts: number[];
  notes: string[];
};

import * as polygonClipping from "polygon-clipping";

function intersect(a: [number, number][][], b: [number, number][][]): [number, number][][][] {
  try {
    return polygonClipping.intersection(a, b);
  } catch {
    return [];
  }
}

function areaOfMulti(mp: [number, number][][][]): number {
  let total = 0;
  for (const poly of mp) {
    for (const ring of poly) {
      if (ring.length < 3) continue;
      let sum = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      }
      total += Math.abs(sum) / 2;
    }
  }
  return total;
}

function areaLeftOfCut(
  parent: [number, number][][],
  cut: number,
  axis: "x" | "y",
  bbox: Bbox
): number {
  const box =
    axis === "x"
      ? [makeVerticalBox(bbox.minX, cut, bbox.minY, bbox.maxY)]
      : [makeHorizontalBox(bbox.minX, bbox.maxX, bbox.minY, cut)];
  const mp = intersect(parent, box);
  return areaOfMulti(mp);
}

function findCutForTargetArea(
  parent: [number, number][][],
  targetArea: number,
  axis: "x" | "y",
  bbox: Bbox
): number {
  let lo = axis === "x" ? bbox.minX : bbox.minY;
  let hi = axis === "x" ? bbox.maxX : bbox.maxY;
  for (let iter = 0; iter < 45; iter++) {
    const mid = (lo + hi) / 2;
    const a = areaLeftOfCut(parent, mid, axis, bbox);
    if (a < targetArea) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function stripSplit(
  parentRing: Point[],
  n: number,
  axis: "x" | "y"
): { pieceRings: Point[][]; splitLines: LineString[]; cuts: number[] } {
  const bbox = getBbox(parentRing);
  const totalA = polygonArea(parentRing);
  const targetEach = totalA / n;
  const parent = [toClippingRing(parentRing)];
  const cuts: number[] = [];
  for (let k = 1; k < n; k++) {
    const targetCum = targetEach * k;
    const c = findCutForTargetArea(parent, targetCum, axis, bbox);
    cuts.push(c);
  }
  cuts.sort((a, b) => a - b);

  const pieceRings: Point[][] = [];
  const splitLines: LineString[] = [];
  let prev = axis === "x" ? bbox.minX : bbox.minY;
  const axisMax = axis === "x" ? bbox.maxX : bbox.maxY;

  for (let i = 0; i < n; i++) {
    const next = i === n - 1 ? axisMax : cuts[i];
    const box =
      axis === "x"
        ? [makeVerticalBox(prev, next, bbox.minY, bbox.maxY)]
        : [makeHorizontalBox(bbox.minX, bbox.maxX, prev, next)];
    const mp = intersect(parent, box);
    if (Array.isArray(mp) && mp[0]?.[0]) {
      const ring = fromClippingRing(mp[0][0]);
      const area = polygonArea(ring);
      if (area > 1e-6) pieceRings.push(ring);
    }
    if (i < n - 1) {
      const c = cuts[i];
      if (axis === "x") {
        splitLines.push({
          type: "LineString",
          coords: [
            { x: c, y: bbox.minY },
            { x: c, y: bbox.maxY },
          ],
        });
      } else {
        splitLines.push({
          type: "LineString",
          coords: [
            { x: bbox.minX, y: c },
            { x: bbox.maxX, y: c },
          ],
        });
      }
    }
    prev = next;
  }

  return { pieceRings, splitLines, cuts };
}

export function splitByFixedCuts(
  parentRing: Point[],
  axis: "x" | "y",
  fixedCuts: number[]
): SplitResult {
  const bbox = getBbox(parentRing);
  const parent = [toClippingRing(parentRing)];
  const sorted = [...fixedCuts].filter((c) => c > (axis === "x" ? bbox.minX : bbox.minY) && c < (axis === "x" ? bbox.maxX : bbox.maxY)).sort((a, b) => a - b);
  const minV = axis === "x" ? bbox.minX : bbox.minY;
  const maxV = axis === "x" ? bbox.maxX : bbox.maxY;
  const bounds = [minV, ...sorted, maxV];
  const pieceRings: Point[][] = [];
  const splitLines: LineString[] = [];

  for (let i = 0; i < bounds.length - 1; i++) {
    const lo = bounds[i];
    const hi = bounds[i + 1];
    const box =
      axis === "x"
        ? [makeVerticalBox(lo, hi, bbox.minY, bbox.maxY)]
        : [makeHorizontalBox(bbox.minX, bbox.maxX, lo, hi)];
    const inter = intersect(parent, box);
    if (Array.isArray(inter) && inter[0]?.[0]) {
      const ring = fromClippingRing(inter[0][0]);
      const area = polygonArea(ring);
      if (area > 1e-6) pieceRings.push(ring);
    }
    if (i < bounds.length - 2) {
      const c = sorted[i];
      if (axis === "x") {
        splitLines.push({
          type: "LineString",
          coords: [
            { x: c, y: bbox.minY },
            { x: c, y: bbox.maxY },
          ],
        });
      } else {
        splitLines.push({
          type: "LineString",
          coords: [
            { x: bbox.minX, y: c },
            { x: bbox.maxX, y: c },
          ],
        });
      }
    }
  }

  const rules = getRules("tarla");
  const targetEach = polygonArea(parentRing) / Math.max(1, pieceRings.length);
  const pieces: Piece[] = pieceRings.map((r, idx) => {
    const area = polygonArea(r);
    const violations: string[] = [];
    if (area < rules.minArea) violations.push("MIN_AREA");
    if (Math.abs(area - targetEach) > targetEach * rules.areaToleranceRatio)
      violations.push("AREA_TOLERANCE");
    return {
      id: `p${idx}`,
      polygon: { type: "Polygon", ring: r },
      area,
      violations,
      valid: violations.length === 0,
    };
  });

  return { pieces, splitLines, cuts: sorted, notes: [] };
}

export function computeSplit(params: {
  parentRing: Point[];
  profile: SplitProfile;
  mode: "by_area" | "by_count";
  targetArea?: number;
  targetCount?: number;
  orientation: "vertical" | "horizontal" | "auto";
  selectedRoadEdges: Set<string>;
}): SplitResult {
  const { parentRing, profile, mode, targetArea, targetCount, orientation, selectedRoadEdges } = params;
  const rules = getRules(profile);
  const totalA = polygonArea(parentRing);
  let n: number;
  if (mode === "by_area" && typeof targetArea === "number" && targetArea > 0) {
    n = Math.max(1, Math.round(totalA / targetArea));
  } else if (mode === "by_count" && typeof targetCount === "number" && targetCount >= 2) {
    n = Math.min(200, Math.max(2, Math.round(targetCount)));
  } else {
    n = 1;
  }
  const targetEach = totalA / n;
  const axis: "x" | "y" =
    orientation === "horizontal" ? "y" : orientation === "vertical" ? "x" : "x";
  const { pieceRings, splitLines, cuts } = stripSplit(parentRing, n, axis);
  const notes: string[] = [];
  if (pieceRings.length !== n) notes.push("SPLIT_COUNT_MISMATCH");

  const pieces: Piece[] = pieceRings.map((r, idx) => {
    const area = polygonArea(r);
    const violations: string[] = [];
    if (area < rules.minArea) violations.push("MIN_AREA");
    if (Math.abs(area - targetEach) > targetEach * rules.areaToleranceRatio)
      violations.push("AREA_TOLERANCE");
    if (rules.requireRoadFrontage && selectedRoadEdges.size === 0)
      violations.push("MIN_FRONTAGE");
    return {
      id: `p${idx}`,
      polygon: { type: "Polygon", ring: r },
      area,
      violations,
      valid: violations.length === 0,
    };
  });

  return { pieces, splitLines, cuts, notes };
}

export type ComputeSplitMultiParams = {
  parentRings: Point[][];
  targetCount: number;
  profile: SplitProfile;
  orientation: Orientation;
  selectedRoadEdges: Set<string>;
};

/**
 * N toplam adedi parentRings arasında alan oranına göre dağıtır (Hamilton / largest remainder),
 * her ring için computeSplit çağırır, pieces/splitLines birleştirir.
 */
export function computeSplitMultiTotalCount(params: ComputeSplitMultiParams): SplitResult {
  const { parentRings, targetCount: N, profile, orientation, selectedRoadEdges } = params;
  if (!parentRings.length) return { pieces: [], splitLines: [], cuts: [], notes: [] };
  const totalA = parentRings.reduce((sum, r) => sum + polygonArea(r), 0);
  if (totalA <= 0) return { pieces: [], splitLines: [], cuts: [], notes: [] };

  const areas = parentRings.map((r) => polygonArea(r));
  const q = areas.map((Ai) => (N * Ai) / totalA);
  const ni = q.map((qi) => Math.floor(qi));
  let kalan = N - ni.reduce((s, n) => s + n, 0);

  if (kalan > 0) {
    const remainders = q.map((qi, i) => ({ i, rem: qi - Math.floor(qi) }));
    remainders.sort((a, b) => b.rem - a.rem);
    for (let k = 0; k < kalan && k < remainders.length; k++) {
      ni[remainders[k].i] += 1;
    }
  }

  if (__DEV__) {
    console.log("[computeSplitMultiTotalCount] N, areas, q, ni, kalan:", {
      N,
      areas,
      q,
      ni,
      kalanAfter: N - ni.reduce((s, n) => s + n, 0),
    });
  }

  const allPieces: Piece[] = [];
  const allSplitLines: LineString[] = [];
  const allCuts: number[] = [];
  const notes: string[] = [];

  for (let i = 0; i < parentRings.length; i++) {
    const ring = parentRings[i];
    const count = ni[i];
    if (polygonArea(ring) < 1e-6) continue;

    if (count <= 0) {
      const singlePiece: Piece = {
        id: `${i}_p0`,
        polygon: { type: "Polygon", ring },
        area: polygonArea(ring),
        violations: [],
        valid: true,
      };
      allPieces.push(singlePiece);
      continue;
    }

    if (count === 1) {
      const singlePiece: Piece = {
        id: `${i}_p0`,
        polygon: { type: "Polygon", ring },
        area: polygonArea(ring),
        violations: [],
        valid: true,
      };
      allPieces.push(singlePiece);
      continue;
    }

    const result = computeSplit({
      parentRing: ring,
      profile,
      mode: "by_count",
      targetCount: count,
      orientation,
      selectedRoadEdges,
    });

    for (const p of result.pieces) {
      allPieces.push({
        ...p,
        id: `${i}_${p.id}`,
      });
    }
    for (const ls of result.splitLines) {
      allSplitLines.push(ls);
    }
    allCuts.push(...result.cuts);
    notes.push(...result.notes);
  }

  return { pieces: allPieces, splitLines: allSplitLines, cuts: allCuts, notes };
}

const ADJACENT_EPS = 0.02;

/** İki nokta eps mesafede eşit sayılır. */
function pointsEqual(a: Point, b: Point, eps: number = ADJACENT_EPS): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= eps;
}

/** pieceId'li parçanın komşu parça id'lerini döndürür (en az 2 nokta/segment paylaşan). */
export function findAdjacentPieces(
  pieces: Piece[],
  pieceId: string,
  eps: number = ADJACENT_EPS
): string[] {
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return [];
  const ringA = piece.polygon.ring;
  const nA = ringA.length - 1;
  const out: string[] = [];
  for (const other of pieces) {
    if (other.id === pieceId) continue;
    const ringB = other.polygon.ring;
    const nB = ringB.length - 1;
    let sharedCount = 0;
    for (let i = 0; i < nA; i++) {
      const a1 = ringA[i];
      const a2 = ringA[i + 1];
      for (let j = 0; j < nB; j++) {
        const b1 = ringB[j];
        const b2 = ringB[(j + 1) % nB];
        const fwd = pointsEqual(a1, b1, eps) && pointsEqual(a2, b2, eps);
        const rev = pointsEqual(a1, b2, eps) && pointsEqual(a2, b1, eps);
        if (fwd || rev) sharedCount += 2;
      }
    }
    if (sharedCount >= 2) out.push(other.id);
  }
  return out;
}

/** ringB'de ringA[edgeIndexA]..ringA[edgeIndexA+1] segmenti var mı (eps ile). */
function ringContainsSegment(
  ringA: Point[],
  edgeIndexA: number,
  ringB: Point[],
  eps: number
): boolean {
  const nB = ringB.length - 1;
  if (nB < 0) return false;
  const a1 = ringA[edgeIndexA];
  const a2 = ringA[edgeIndexA + 1];
  for (let j = 0; j <= nB; j++) {
    const j2 = (j + 1) % ringB.length;
    const b1 = ringB[j];
    const b2 = ringB[j2];
    const fwd = pointsEqual(a1, b1, eps) && pointsEqual(a2, b2, eps);
    const rev = pointsEqual(a1, b2, eps) && pointsEqual(a2, b1, eps);
    if (fwd || rev) return true;
  }
  return false;
}

/** pieceId'li parçanın edgeIndex'inci kenarını paylaşan komşu parçayı döndürür. */
export function findNeighborSharingEdge(
  pieces: Piece[],
  pieceId: string,
  edgeIndex: number,
  eps: number = ADJACENT_EPS
): Piece | null {
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return null;
  const ringA = piece.polygon.ring;
  const nA = ringA.length - 1;
  if (edgeIndex < 0 || edgeIndex >= nA) return null;
  for (const other of pieces) {
    if (other.id === pieceId) continue;
    if (ringContainsSegment(ringA, edgeIndex, other.polygon.ring, eps)) return other;
  }
  return null;
}

/** İki parçayı polygon union ile birleştirir; yeni Piece döner (id üretilir). */
export function mergePieces(pieceA: Piece, pieceB: Piece, newId?: string): Piece | null {
  try {
    const a = [toClippingRing(pieceA.polygon.ring)];
    const b = [toClippingRing(pieceB.polygon.ring)];
    const union = polygonClipping.union(a, b);
    if (!union?.length || !union[0]?.length || !union[0][0]?.length) return null;
    const ring = fromClippingRing(union[0][0]);
    if (ring.length < 3) return null;
    const area = polygonArea(ring);
    const rules = getRules("tarla");
    const violations: string[] = [];
    if (area < rules.minArea) violations.push("MIN_AREA");
    return {
      id: newId ?? `p-${pieceA.id}-${pieceB.id}-${Date.now()}`,
      polygon: { type: "Polygon", ring },
      area,
      violations,
      valid: violations.length === 0,
    };
  } catch {
    return null;
  }
}

/** Kenar (a->b) için birim normal: sol taraf (polygon içi) dışarı doğru. */
function edgeUnitNormal(a: Point, b: Point, outwardFromA: boolean): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  if (!outwardFromA) return { x: -nx, y: -ny };
  return { x: nx, y: ny };
}

/** pieceA'nın pieceB ile paylaştığı kenarın pieceA ring'indeki indeksini döner. Paylaşılan kenar yoksa null. */
export function findSharedEdgeIndexInPieceA(
  pieceA: { polygon: { ring: Point[] } },
  pieceB: { polygon: { ring: Point[] } },
  eps: number = ADJACENT_EPS
): number | null {
  const shared = findSharedEdge(pieceA.polygon.ring, pieceB.polygon.ring, eps);
  return shared ? shared.iA : null;
}

/** İki ring'te paylaşılan kenar indekslerini döner: { iA, jB, reversed }. */
export function getSharedEdgeIndices(
  ringA: Point[],
  ringB: Point[],
  eps: number = ADJACENT_EPS
): { iA: number; jB: number; reversed: boolean } | null {
  return findSharedEdge(ringA, ringB, eps);
}

/** Mevcut parçalardan bölme çizgilerini türetir (edge slide sonrası görsel senkron için). */
export function deriveSplitLinesFromPieces(
  pieces: Piece[],
  eps: number = ADJACENT_EPS
): LineString[] {
  const lines: LineString[] = [];
  const seen = new Set<string>();
  for (const pieceA of pieces) {
    const adj = findAdjacentPieces(pieces, pieceA.id, eps);
    for (const bid of adj) {
      const key = [pieceA.id, bid].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      const pieceB = pieces.find((p) => p.id === bid);
      if (!pieceB) continue;
      const shared = findSharedEdge(pieceA.polygon.ring, pieceB.polygon.ring, eps);
      if (!shared) continue;
      const ringA = pieceA.polygon.ring;
      const a = ringA[shared.iA];
      const b = ringA[(shared.iA + 1) % ringA.length];
      lines.push({ type: "LineString", coords: [a, b] });
    }
  }
  return lines;
}

/** İki ring'te paylaşılan kenar indekslerini bulur (eps ile). (pieceAEdgeIndex, pieceBStartIndex, reversed). */
function findSharedEdge(
  ringA: Point[],
  ringB: Point[],
  eps: number
): { iA: number; jB: number; reversed: boolean } | null {
  const nA = ringA.length - 1;
  const nB = ringB.length - 1;
  for (let i = 0; i < nA; i++) {
    const a1 = ringA[i];
    const a2 = ringA[i + 1];
    for (let j = 0; j < nB; j++) {
      const b1 = ringB[j];
      const b2 = ringB[(j + 1) % nB];
      if (pointsEqual(a1, b1, eps) && pointsEqual(a2, b2, eps)) return { iA: i, jB: j, reversed: false };
      if (pointsEqual(a1, b2, eps) && pointsEqual(a2, b1, eps)) return { iA: i, jB: j, reversed: true };
    }
  }
  return null;
}

/** ringA'nın edgeIndexA'inci kenarını ringB'de arar; jB ve reversed döner. */
function findSharedEdgeAt(
  ringA: Point[],
  ringB: Point[],
  edgeIndexA: number,
  eps: number
): { jB: number; reversed: boolean } | null {
  const nA = ringA.length - 1;
  const nB = ringB.length - 1;
  if (edgeIndexA < 0 || edgeIndexA >= nA) return null;
  const a1 = ringA[edgeIndexA];
  const a2 = ringA[edgeIndexA + 1];
  for (let j = 0; j < nB; j++) {
    const b1 = ringB[j];
    const b2 = ringB[(j + 1) % nB];
    if (pointsEqual(a1, b1, eps) && pointsEqual(a2, b2, eps)) return { jB: j, reversed: false };
    if (pointsEqual(a1, b2, eps) && pointsEqual(a2, b1, eps)) return { jB: j, reversed: true };
  }
  return null;
}

const MIN_SLIDE_AREA = 5;
const MIN_EDGE_GAP = 0.1;

/**
 * Ortak kenarı normal doğrultusunda kaydırarak iki parçayı günceller.
 * pieceA kenar boyunca +offset, pieceB -offset (toplam alan korunur).
 */
export function updateTwoPiecesBySlidingSharedEdge(
  pieceA: Piece,
  pieceB: Piece,
  edgeIndexA: number,
  offsetMeters: number,
  minArea: number = MIN_SLIDE_AREA
): { pieceA: Piece; pieceB: Piece } | null {
  const ringA = pieceA.polygon.ring;
  const ringB = pieceB.polygon.ring;
  const nA = ringA.length - 1;
  if (edgeIndexA < 0 || edgeIndexA >= nA) return null;
  const shared = findSharedEdgeAt(ringA, ringB, edgeIndexA, ADJACENT_EPS);
  if (!shared) return null;
  const a1 = ringA[edgeIndexA];
  const a2 = ringA[edgeIndexA + 1];
  const normal = edgeUnitNormal(a1, a2, true);
  const step = Math.max(MIN_EDGE_GAP, Math.abs(offsetMeters));
  const sign = offsetMeters >= 0 ? 1 : -1;
  const dx = sign * step * normal.x;
  const dy = sign * step * normal.y;

  const newRingA = ringA.map((p, i) => {
    if (i === edgeIndexA || i === edgeIndexA + 1) return { x: p.x + dx, y: p.y + dy };
    return { ...p };
  });
  const jB = shared.jB;
  const jB2 = (jB + 1) % ringB.length;
  const newRingB = ringB.map((p, i) => {
    if (i === jB || i === jB2) return { x: p.x - dx, y: p.y - dy };
    return { ...p };
  });

  const areaA = polygonArea(newRingA);
  const areaB = polygonArea(newRingB);
  if (areaA < minArea || areaB < minArea) return null;
  const rules = getRules("tarla");
  const violA: string[] = [];
  const violB: string[] = [];
  if (areaA < rules.minArea) violA.push("MIN_AREA");
  if (areaB < rules.minArea) violB.push("MIN_AREA");

  return {
    pieceA: {
      ...pieceA,
      polygon: { type: "Polygon", ring: newRingA },
      area: areaA,
      violations: violA,
      valid: violA.length === 0,
    },
    pieceB: {
      ...pieceB,
      polygon: { type: "Polygon", ring: newRingB },
      area: areaB,
      violations: violB,
      valid: violB.length === 0,
    },
  };
}
