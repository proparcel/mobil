import type { ArReferencePoints } from "../types/mapReferencePoints";

type ArPoint = { x: number; y: number; z: number };

export function arPointDistanceM(a: ArPoint, b: ArPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function formatArDistanceM(distanceM: number): string {
  if (distanceM < 1) return `${Math.round(distanceM * 100)} cm`;
  return `${distanceM.toFixed(1)} m`;
}

export function computeArReferenceDistances(
  refs: Partial<ArReferencePoints>,
): { userToA?: number; userToB?: number; aToB?: number } {
  const result: { userToA?: number; userToB?: number; aToB?: number } = {};
  if (refs.userPoint && refs.referenceA) {
    result.userToA = arPointDistanceM(refs.userPoint, refs.referenceA);
  }
  if (refs.userPoint && refs.referenceB) {
    result.userToB = arPointDistanceM(refs.userPoint, refs.referenceB);
  }
  if (refs.referenceA && refs.referenceB) {
    result.aToB = arPointDistanceM(refs.referenceA, refs.referenceB);
  }
  return result;
}
