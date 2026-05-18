/**
 * Kenar kaydırma (edge slide): half-plane polygon + polygon-clipping intersection.
 * Alternatif: vertex-tabanlı slide (updateTwoPiecesBySlidingEdgeVertex) – union'a güvenmez.
 */

import type { Point, Piece } from "../types/parcelSplit";
import { getBbox, type Bbox } from "./parcelSplitTransform";
import { polygonArea, getSharedEdgeIndices, pointInPolygon } from "./parcelSplitEngine";
import * as polygonClipping from "polygon-clipping";

/** Tüm geometri fonksiyonlarında kullanılacak EPS (1e-6 – 1e-4). */
const GEOM_EPS = 1e-6;
const SNAP_GRID = 1e-6;

const MIN_SLIDE_AREA = 5;
/** Sayısal hata nedeniyle toplam alan küçük sapma gösterebilir; 2 m² tolerans. Parent ile kesildiğinde daha fazla kayıp olabilir. */
const AREA_TOLERANCE = 2;
/** Parent ring ile kesim kullanıldığında kabul edilebilir alan farkı (m² veya oran). */
const AREA_TOLERANCE_WITH_PARENT = 100;
const HALF_PLANE_SCALE = 10;

function toClippingRing(ring: Point[]): [number, number][] {
  return ring.map((p) => [p.x, p.y] as [number, number]);
}

function fromClippingRing(r: [number, number][]): Point[] {
  return r.map((c) => ({ x: c[0], y: c[1] }));
}

/** Ring centroid (son nokta kapatma hariç). */
function ringCentroid(ring: Point[]): Point {
  const n = Math.max(1, ring.length - 1);
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    cx += ring[i].x;
    cy += ring[i].y;
  }
  return { x: cx / n, y: cy / n };
}

/** Garanti iç nokta: centroid concave'da dışarı çıkabilir; half-plane için güvenilir iç nokta gerekir. */
function getInteriorPoint(ring: Point[]): Point {
  const c = ringCentroid(ring);
  if (pointInPolygon(c, ring)) return c;
  const n = Math.max(1, ring.length - 1);
  let ax = 0, ay = 0;
  for (let i = 0; i < n; i++) {
    ax += ring[i].x;
    ay += ring[i].y;
  }
  const avg = { x: ax / n, y: ay / n };
  if (pointInPolygon(avg, ring)) return avg;
  const eps = [0.01, 0.05, 0.1, 0.2];
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    for (const s of eps) {
      for (const [dx, dy] of [[s, s], [-s, s], [s, -s], [-s, -s]]) {
        const cand = { x: p.x + dx, y: p.y + dy };
        if (pointInPolygon(cand, ring)) return cand;
      }
    }
  }
  return c;
}

/** Edge a->b için birim normal: sol (perpendicular). +d yönü "dışarı". */
function edgeUnitNormal(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/**
 * Kaydırılmış kenar: a' = a + n*d, b' = b + n*d.
 * containPoint bu yarı düzlemin içinde kalacak (intersection ile kesilecek taraf).
 * Dönen polygon: yarı düzlem (çok büyük bir dörtgen: a', b', b'+M*n, a'+M*n veya tersi).
 */
function buildHalfPlanePolygon(
  lineA: Point,
  lineB: Point,
  containPoint: Point,
  bbox: Bbox
): [number, number][] {
  const n = edgeUnitNormal(lineA, lineB);
  const M = HALF_PLANE_SCALE * Math.max(
    bbox.maxX - bbox.minX,
    bbox.maxY - bbox.minY,
    10
  );
  const dot = (containPoint.x - lineA.x) * n.x + (containPoint.y - lineA.y) * n.y;
  let p1: Point, p2: Point, p3: Point, p4: Point;
  if (dot >= 0) {
    p1 = lineA;
    p2 = lineB;
    p3 = { x: lineB.x + M * n.x, y: lineB.y + M * n.y };
    p4 = { x: lineA.x + M * n.x, y: lineA.y + M * n.y };
  } else {
    p1 = lineA;
    p2 = { x: lineA.x - M * n.x, y: lineA.y - M * n.y };
    p3 = { x: lineB.x - M * n.x, y: lineB.y - M * n.y };
    p4 = lineB;
  }
  return toClippingRing([p1, p2, p3, p4, p1]);
}

/** Polygon-clipping sonucundan en büyük alanlı poligonun dış ring'ini döndürür (MultiPolygon durumu için). */
function pickLargestRingFromClipping(clippingResult: number[][][][]): Point[] | null {
  if (!clippingResult?.length) return null;
  let best: Point[] | null = null;
  let bestArea = 0;
  for (const poly of clippingResult) {
    if (!poly?.[0]?.length) continue;
    const ring = fromClippingRing(poly[0]);
    if (ring.length < 3) continue;
    const a = polygonArea(ring);
    if (a > bestArea) {
      bestArea = a;
      best = ring;
    }
  }
  return best;
}

function intersectPolygons(
  ringA: Point[],
  ringB: Point[]
): Point[] | null {
  try {
    const a = [toClippingRing(ringA)];
    const b = [toClippingRing(ringB)];
    const result = polygonClipping.intersection(a, b);
    const ring = pickLargestRingFromClipping(result);
    return ring;
  } catch {
    return null;
  }
}

function unionPolygons(ringA: Point[], ringB: Point[]): Point[] | null {
  try {
    const a = [toClippingRing(ringA)];
    const b = [toClippingRing(ringB)];
    let result = polygonClipping.union(a, b);
    if (!result?.length) return null;
    if (result.length > 1 && result[0]?.length && result[1]?.length) {
      const merged = polygonClipping.union(result[0], result[1]);
      if (merged?.length === 1 && merged[0]?.length) result = merged;
    }
    const ring = pickLargestRingFromClipping(result);
    return ring;
  } catch {
    return null;
  }
}

/** Kenar eşleştirme: polygon-clipping sonrası koordinat kayması olabilir; 5 cm tolerans. */
const EDGE_MATCH_EPS = 0.05;

function pointEquals(p: Point, q: Point, eps: number = EDGE_MATCH_EPS): boolean {
  return Math.hypot(p.x - q.x, p.y - q.y) <= eps;
}

/** ring'te (a,b) veya (b,a) segmentini bulur; o kenarın uç noktalarını (ring'teki referans) döner. */
function findEdgeInRing(ring: Point[], a: Point, b: Point): { e1: Point; e2: Point } | null {
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const e1 = ring[i];
    const e2 = ring[i + 1];
    if (pointEquals(e1, a) && pointEquals(e2, b)) return { e1, e2 };
    if (pointEquals(e1, b) && pointEquals(e2, a)) return { e1, e2 };
  }
  return null;
}

/** Eski kenar (a,b) ile yeni kenar (a',b') arasındaki şerit dörtgeni. Kapalı ring: a -> b -> b' -> a' -> a. */
function buildStripRing(a: Point, b: Point, aPrime: Point, bPrime: Point): Point[] {
  return [a, b, bPrime, aPrime, a];
}

// ─── Vertex-tabanlı slide yardımcıları ─────────────────────────────────────────

function snapPoint(p: Point, grid: number = SNAP_GRID): Point {
  return {
    x: Math.round(p.x / grid) * grid,
    y: Math.round(p.y / grid) * grid,
  };
}

/** Signed area (CCW pozitif). */
function signedArea(ring: Point[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n - 1; i++) {
    sum += ring[i].x * ring[i + 1].y - ring[i + 1].x * ring[i].y;
  }
  if (n > 1 && (ring[0].x !== ring[n - 1].x || ring[0].y !== ring[n - 1].y)) {
    sum += ring[n - 1].x * ring[0].y - ring[0].x * ring[n - 1].y;
  }
  return sum / 2;
}

/** Ring'i normalize et: CCW, ardışık tekrarlar temizle, kapalı halka. */
function normalizeRing(ring: Point[], eps: number = GEOM_EPS): Point[] {
  if (!ring || ring.length < 3) return ring;
  let r = [...ring];
  if (r.length > 1 && Math.hypot(r[0].x - r[r.length - 1].x, r[0].y - r[r.length - 1].y) <= eps) {
    r = r.slice(0, -1);
  }
  const dedup: Point[] = [];
  for (let i = 0; i < r.length; i++) {
    const prev = dedup[dedup.length - 1];
    if (!prev || Math.hypot(r[i].x - prev.x, r[i].y - prev.y) > eps) {
      dedup.push({ x: r[i].x, y: r[i].y });
    }
  }
  if (dedup.length < 3) return ring;
  if (signedArea(dedup) < 0) dedup.reverse();
  if (dedup.length > 1 && (dedup[0].x !== dedup[dedup.length - 1].x || dedup[0].y !== dedup[dedup.length - 1].y)) {
    dedup.push({ x: dedup[0].x, y: dedup[0].y });
  }
  return dedup;
}

/** Ring'te i ve i+1 indeksli kenarı aPrime, bPrime ile değiştir. i=nv-1 ise wraparound (nv-1,0) kenarı. */
function replaceEdgeInRing(ring: Point[], i: number, aPrime: Point, bPrime: Point): Point[] {
  const n = ring.length;
  const nv = n > 1 && Math.hypot(ring[0].x - ring[n - 1].x, ring[0].y - ring[n - 1].y) < GEOM_EPS ? n - 1 : n;
  if (i < 0 || i >= nv) return ring;
  const out: Point[] = [];
  if (i === nv - 1) {
    out.push(snapPoint(bPrime));
    for (let j = 1; j < nv - 1; j++) out.push({ x: ring[j].x, y: ring[j].y });
    out.push(snapPoint(aPrime));
    out.push({ x: out[0].x, y: out[0].y });
    return out; /* kenar (nv-1,0) → (aPrime,bPrime), ring sırası: bPrime,p1,...,aPrime,bPrime */
  }
  for (let j = 0; j < nv; j++) {
    if (j === i) {
      out.push(snapPoint(aPrime));
      out.push(snapPoint(bPrime));
      j++;
    } else {
      out.push({ x: ring[j].x, y: ring[j].y });
    }
  }
  if (ring.length > nv) out.push({ x: out[0].x, y: out[0].y });
  return out;
}

/** Güvenli offset aralığı: minArea korunacak şekilde; basit sınırlar. */
function computeSafeOffsetRange(
  _ringA: Point[],
  _ringB: Point[],
  edgeIndexA: number,
  jB: number,
  _reversed: boolean,
  _normal: Point,
  _minArea: number
): { minD: number; maxD: number } {
  if (edgeIndexA < 0 || jB < 0) return { minD: -10, maxD: 10 };
  return { minD: -10, maxD: 10 };
}

/**
 * Vertex-tabanlı kenar kaydırma: shared edge'in iki ucunu (a,b) kaydırıp her iki polygon'a aynı yeni kenarı (a',b') yazar.
 * Union'a güvenmez; deterministik ve Martinez merge sorunlarından bağımsız.
 */
export function updateTwoPiecesBySlidingEdgeVertex(
  pieces: Piece[],
  pieceAId: string,
  pieceBId: string,
  edgeIndexA: number,
  offsetD: number,
  parentRing: Point[] | null,
  minArea: number = MIN_SLIDE_AREA,
  areaTol: number = AREA_TOLERANCE,
  eps: number = 0.05
): Piece[] | null {
  const pieceA = pieces.find((p) => p.id === pieceAId);
  const pieceB = pieces.find((p) => p.id === pieceBId);
  if (!pieceA || !pieceB) return null;

  const ringA = pieceA.polygon.ring;
  const ringB = pieceB.polygon.ring;
  const nA = Math.max(0, ringA.length - 1); /* kenar sayısı (kapalı ring) */
  if (edgeIndexA < 0 || edgeIndexA >= nA) return null;

  const shared = getSharedEdgeIndices(ringA, ringB, eps);
  if (!shared) {
    if (__DEV__) console.log("[edgeSlideGeometry] vertex slide: no shared edge", { ringALen: ringA.length, ringBLen: ringB.length, edgeIndexA });
    return null;
  }
  const { jB, reversed } = shared;

  const a = ringA[edgeIndexA];
  const b = ringA[edgeIndexA + 1];
  const normal = edgeUnitNormal(a, b);
  let clampedOffset = offsetD;
  const { minD, maxD } = computeSafeOffsetRange(ringA, ringB, edgeIndexA, jB, reversed, normal, minArea);
  if (offsetD < minD || offsetD > maxD) {
    clampedOffset = Math.max(minD, Math.min(maxD, offsetD));
    if (__DEV__ && Math.abs(clampedOffset - offsetD) > 0.01) {
      console.log("[edgeSlideGeometry] vertex slide clamped", { offsetD, clampedOffset, minD, maxD });
    }
  }
  if (Math.abs(clampedOffset) < GEOM_EPS) return null;

  const aPrime: Point = { x: a.x + normal.x * clampedOffset, y: a.y + normal.y * clampedOffset };
  const bPrime: Point = { x: b.x + normal.x * clampedOffset, y: b.y + normal.y * clampedOffset };

  let newRingA = replaceEdgeInRing(ringA, edgeIndexA, aPrime, bPrime);
  let newRingB = replaceEdgeInRing(ringB, jB, reversed ? bPrime : aPrime, reversed ? aPrime : bPrime);

  newRingA = normalizeRing(newRingA);
  newRingB = normalizeRing(newRingB);

  if (parentRing && parentRing.length >= 3) {
    const clippedA = intersectPolygons(newRingA, parentRing);
    const clippedB = intersectPolygons(newRingB, parentRing);
    if (!clippedA || !clippedB || clippedA.length < 3 || clippedB.length < 3) {
      if (__DEV__) console.log("[edgeSlideGeometry] vertex slide: clip with parent failed");
      return null;
    }
    newRingA = clippedA;
    newRingB = clippedB;
  }

  const areaA = polygonArea(newRingA);
  const areaB = polygonArea(newRingB);
  const oldAreaA = pieceA.area;
  const oldAreaB = pieceB.area;
  const totalOld = oldAreaA + oldAreaB;
  const totalNew = areaA + areaB;
  const areaDiff = Math.abs(totalNew - totalOld);

  if (areaA < minArea || areaB < minArea) return null;
  const effectiveTol = parentRing && parentRing.length >= 3
    ? Math.max(areaTol, AREA_TOLERANCE_WITH_PARENT, totalOld * 0.02)
    : areaTol;
  if (areaDiff > effectiveTol) return null;

  const violationsA: string[] = areaA < 100 ? ["MIN_AREA"] : [];
  const violationsB: string[] = areaB < 100 ? ["MIN_AREA"] : [];

  if (__DEV__) {
    console.log("[EDGE_SLIDE][VERTEX]", {
      edgeIndexA,
      offsetD: clampedOffset,
      A0: Math.round(oldAreaA),
      B0: Math.round(oldAreaB),
      A1: Math.round(areaA),
      B1: Math.round(areaB),
      dA: Math.round(areaA - oldAreaA),
      dB: Math.round(areaB - oldAreaB),
    });
  }

  const newPieceA: Piece = {
    ...pieceA,
    polygon: { type: "Polygon", ring: newRingA },
    area: areaA,
    violations: violationsA,
    valid: violationsA.length === 0,
  };
  const newPieceB: Piece = {
    ...pieceB,
    polygon: { type: "Polygon", ring: newRingB },
    area: areaB,
    violations: violationsB,
    valid: violationsB.length === 0,
  };

  return pieces.map((p) =>
    p.id === pieceAId ? newPieceA : p.id === pieceBId ? newPieceB : p
  );
}

/** Union yapılacak ring ile tam kenar paylaşması için şeridi o ring'in kenar koordinatlarıyla oluşturur. */
function buildStripRingForUnion(
  otherRing: Point[],
  a: Point,
  b: Point,
  normal: Point,
  offsetD: number
): Point[] | null {
  const edge = findEdgeInRing(otherRing, a, b);
  if (!edge) return null;
  const { e1, e2 } = edge;
  const e1Prime: Point = { x: e1.x + normal.x * offsetD, y: e1.y + normal.y * offsetD };
  const e2Prime: Point = { x: e2.x + normal.x * offsetD, y: e2.y + normal.y * offsetD };
  return [e1, e2, e2Prime, e1Prime, e1];
}

/**
 * İki parçanın paylaştığı kenarı offsetD metre normal yönünde kaydırarak yeni polygonları üretir.
 * Half-plane intersection: gap/overlap olmaz.
 * parentRing verilirse sonuç parent içinde kesilir (parsel dışına taşma yok).
 */
export function updateTwoPiecesBySlidingEdge(
  pieces: Piece[],
  pieceAId: string,
  pieceBId: string,
  edgeIndexA: number,
  offsetD: number,
  parentRing: Point[] | null,
  minArea: number = MIN_SLIDE_AREA,
  areaTol: number = AREA_TOLERANCE
): Piece[] | null {
  const pieceA = pieces.find((p) => p.id === pieceAId);
  const pieceB = pieces.find((p) => p.id === pieceBId);
  if (!pieceA || !pieceB) return null;

  const ringA = pieceA.polygon.ring;
  const ringB = pieceB.polygon.ring;
  const nA = ringA.length - 1;
  if (edgeIndexA < 0 || edgeIndexA >= nA) return null;

  const a = ringA[edgeIndexA];
  const b = ringA[edgeIndexA + 1];
  const normal = edgeUnitNormal(a, b);
  const aPrime: Point = { x: a.x + normal.x * offsetD, y: a.y + normal.y * offsetD };
  const bPrime: Point = { x: b.x + normal.x * offsetD, y: b.y + normal.y * offsetD };

  const bbox = parentRing && parentRing.length >= 3
    ? getBbox(parentRing)
    : (() => {
        const all: Point[] = [...ringA, ...ringB];
        return getBbox(all);
      })();
  const expand = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, 1) * 2;
  const bigBbox: Bbox = {
    minX: bbox.minX - expand,
    maxX: bbox.maxX + expand,
    minY: bbox.minY - expand,
    maxY: bbox.maxY + expand,
  };

  const C_A = getInteriorPoint(ringA);
  const C_B = getInteriorPoint(ringB);
  const halfPlaneA = buildHalfPlanePolygon(aPrime, bPrime, C_A, bigBbox);
  const halfPlaneB = buildHalfPlanePolygon(aPrime, bPrime, C_B, bigBbox);
  const halfPlaneARing = fromClippingRing(halfPlaneA);
  const halfPlaneBRing = fromClippingRing(halfPlaneB);

  /* Union'da tam kenar eşleşmesi için şeridi her ring'in kendi kenar koordinatlarıyla oluşturuyoruz. */
  const stripForA = buildStripRingForUnion(ringA, a, b, normal, offsetD) ?? buildStripRing(a, b, aPrime, bPrime);
  const sharedIndices = getSharedEdgeIndices(ringA, ringB, 0.05);
  const b1 = sharedIndices ? ringB[sharedIndices.jB] : null;
  const nB = Math.max(1, ringB.length - 1);
  const b2 = sharedIndices ? ringB[(sharedIndices.jB + 1) % nB] : null;
  const stripForB = (b1 && b2)
    ? (buildStripRingForUnion(ringB, b1, b2, normal, offsetD) ?? buildStripRing(b1, b2, { x: b1.x + normal.x * offsetD, y: b1.y + normal.y * offsetD }, { x: b2.x + normal.x * offsetD, y: b2.y + normal.y * offsetD }))
    : buildStripRing(a, b, aPrime, bPrime);

  let newRingA: Point[] | null;
  let newRingB: Point[] | null;
  if (offsetD >= 0) {
    /* Kenar B tarafına kayıyor: A şeridi kazanır, B yarı-düzlemle kesilir. */
    newRingA = unionPolygons(ringA, stripForA);
    newRingB = intersectPolygons(ringB, halfPlaneBRing);
  } else {
    /* Kenar A tarafına kayıyor: A yarı-düzlemle kesilir, B şeridi kazanır. */
    newRingA = intersectPolygons(ringA, halfPlaneARing);
    newRingB = unionPolygons(ringB, stripForB);
  }
  if (!newRingA || !newRingB) {
    if (__DEV__) console.log("[edgeSlideGeometry] union/intersection empty", { edgeIndexA, offsetD });
    return null;
  }

  const areaA0 = polygonArea(ringA);
  const areaB0 = polygonArea(ringB);
  const areaA1 = polygonArea(newRingA);
  const areaB1 = polygonArea(newRingB);

  let clippedA = newRingA;
  let clippedB = newRingB;
  if (parentRing && parentRing.length >= 3) {
    const rawA = intersectPolygons(newRingA, parentRing);
    const rawB = intersectPolygons(newRingB, parentRing);
    if (!rawA || !rawB || rawA.length < 3 || rawB.length < 3) {
      if (__DEV__) console.log("[edgeSlideGeometry] clip with parent failed");
      return null;
    }
    clippedA = rawA;
    clippedB = rawB;
    newRingA = clippedA;
    newRingB = clippedB;
  }

  const areaA2 = polygonArea(newRingA);
  const areaB2 = polygonArea(newRingB);
  if (__DEV__) {
    console.log("[EDGE_SLIDE][AREAS]", {
      edgeIndexA,
      offsetD,
      A0: Math.round(areaA0),
      B0: Math.round(areaB0),
      A1: Math.round(areaA1),
      B1: Math.round(areaB1),
      A2: Math.round(areaA2),
      B2: Math.round(areaB2),
      dA_clipBefore: Math.round(areaA1 - areaA0),
      dA_clipAfter: Math.round(areaA2 - areaA0),
      dB_clipBefore: Math.round(areaB1 - areaB0),
      dB_clipAfter: Math.round(areaB2 - areaB0),
    });
  }

  const areaA = areaA2;
  const areaB = areaB2;
  const oldAreaA = pieceA.area;
  const oldAreaB = pieceB.area;
  const totalOld = oldAreaA + oldAreaB;
  const totalNew = areaA + areaB;
  const areaDiff = Math.abs(totalNew - totalOld);

  if (areaA < minArea || areaB < minArea) {
    if (__DEV__) console.log("[edgeSlideGeometry] clamp: minArea", { areaA, areaB, minArea });
    return null;
  }
  const effectiveTol = parentRing && parentRing.length >= 3
    ? Math.max(areaTol, AREA_TOLERANCE_WITH_PARENT, totalOld * 0.02)
    : areaTol;
  if (areaDiff > effectiveTol) {
    if (__DEV__) console.log("[edgeSlideGeometry] clamp: area not preserved", { totalOld, totalNew, areaDiff, effectiveTol });
    return null;
  }

  const violationsA: string[] = [];
  const violationsB: string[] = [];
  if (areaA < 100) violationsA.push("MIN_AREA");
  if (areaB < 100) violationsB.push("MIN_AREA");

  const newPieceA: Piece = {
    ...pieceA,
    polygon: { type: "Polygon", ring: newRingA },
    area: areaA,
    violations: violationsA,
    valid: violationsA.length === 0,
  };
  const newPieceB: Piece = {
    ...pieceB,
    polygon: { type: "Polygon", ring: newRingB },
    area: areaB,
    violations: violationsB,
    valid: violationsB.length === 0,
  };

  if (__DEV__) {
    console.log("[edgeSlideGeometry] slide", {
      edgeIndexA,
      offsetD,
      areaA: Math.round(areaA),
      areaB: Math.round(areaB),
      deltaA: Math.round(areaA - oldAreaA),
      deltaB: Math.round(areaB - oldAreaB),
    });
  }

  return pieces.map((p) =>
    p.id === pieceAId ? newPieceA : p.id === pieceBId ? newPieceB : p
  );
}

/**
 * Normal yönünü belirler: +offsetD ile A büyür, B küçülür.
 * C_B - C_A vektörüne göre: n komşuya (B) doğru bakıyorsa, +d A'yı büyütür.
 */
export function slideDirectionNormal(
  ringA: Point[],
  edgeIndexA: number
): Point {
  const a = ringA[edgeIndexA];
  const b = ringA[edgeIndexA + 1];
  return edgeUnitNormal(a, b);
}

/** Offset uygulanmış kenar uç noktaları (preview çizgi için). */
export function offsetEdgeEndpoints(
  a: Point,
  b: Point,
  offsetD: number
): { aPrime: Point; bPrime: Point } {
  const n = edgeUnitNormal(a, b);
  return {
    aPrime: { x: a.x + n.x * offsetD, y: a.y + n.y * offsetD },
    bPrime: { x: b.x + n.x * offsetD, y: b.y + n.y * offsetD },
  };
}
