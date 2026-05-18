/**
 * Komşuluk: kenar paylaşan parça bulma (edge segment / eps tolerans).
 */

import type { Piece, Point } from "../types/parcelSplit";
import { findNeighborSharingEdge as findNeighborByEdgeIndex } from "./parcelSplitEngine";

const ADJACENT_EPS = 0.02;

/**
 * pieceId'li parçanın edgeIndex'inci kenarını paylaşan komşu parçayı döndürür.
 * İki parça aynı segmenti (a-b) veya tersini (b-a) eps toleransla paylaşıyorsa komşu.
 */
export function findNeighborSharingEdge(
  pieces: Piece[],
  pieceId: string,
  edgeIndex: number,
  eps: number = ADJACENT_EPS
): Piece | null {
  return findNeighborByEdgeIndex(pieces, pieceId, edgeIndex, eps);
}

/**
 * Kenar segmenti (a, b) ile komşu arar: piece'ın ring'inde bu segmenti paylaşan edgeIndex'i bulup
 * findNeighborSharingEdge(pieces, pieceId, edgeIndex, eps) çağırır.
 */
export function findNeighborSharingSegment(
  pieces: Piece[],
  pieceId: string,
  a: Point,
  b: Point,
  eps: number = ADJACENT_EPS
): Piece | null {
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return null;
  const ring = piece.polygon.ring;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const r1 = ring[i];
    const r2 = ring[i + 1];
    const distA1 = Math.hypot(a.x - r1.x, a.y - r1.y);
    const distA2 = Math.hypot(a.x - r2.x, a.y - r2.y);
    const distB1 = Math.hypot(b.x - r1.x, b.y - r1.y);
    const distB2 = Math.hypot(b.x - r2.x, b.y - r2.y);
    const fwd = distA1 <= eps && distB2 <= eps;
    const rev = distA2 <= eps && distB1 <= eps;
    if (fwd || rev) return findNeighborByEdgeIndex(pieces, pieceId, i, eps);
  }
  return null;
}
