import type { ParcelTerrain3d } from '../../../src/types/portal';

let currentPayload: ParcelTerrain3d | null = null;
let currentSnapshotId: number | null = null;
let currentEmbeddedDemo = false;
let currentAttemptId: string | null = null;

export function setTerrainPayload(
  snapshotId: number,
  payload: ParcelTerrain3d,
  options?: { embeddedDemo?: boolean; attemptId?: string },
): void {
  currentPayload = payload;
  currentSnapshotId = snapshotId;
  currentEmbeddedDemo = options?.embeddedDemo === true;
  currentAttemptId = options?.attemptId ?? null;
}

export function getTerrainPayload(): {
  snapshotId: number;
  payload: ParcelTerrain3d;
  embeddedDemo: boolean;
  attemptId: string | null;
} | null {
  if (currentPayload == null || currentSnapshotId == null) return null;
  return {
    snapshotId: currentSnapshotId,
    payload: currentPayload,
    embeddedDemo: currentEmbeddedDemo,
    attemptId: currentAttemptId,
  };
}

export function clearTerrainPayload(): void {
  currentPayload = null;
  currentSnapshotId = null;
  currentEmbeddedDemo = false;
  currentAttemptId = null;
}

export function getTerrainAttemptId(): string | null {
  return currentAttemptId;
}
