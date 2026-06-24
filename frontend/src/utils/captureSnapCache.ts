/** Önizleme modunda arka plan harita snapshot + overlay önbelleği */

import type { MapOverlayCapturePayload } from './mapOverlayCaptureProjection';
import type { ShapeProperties } from '../maps/drawing/types';

export type PreviewSnapCacheEntry = {
  fingerprint: string;
  shapesKey: string;
  mapUri: string;
  overlay: MapOverlayCapturePayload | null;
  sourceViewport: { width: number; height: number };
  createdAt: number;
};

export function buildCameraFingerprint(cam: {
  center?: [number, number] | null;
  zoom?: number;
  pitch?: number;
  heading?: number;
}): string {
  const lon = cam.center?.[0];
  const lat = cam.center?.[1];
  const z = cam.zoom ?? 0;
  const p = cam.pitch ?? 0;
  const h = cam.heading ?? 0;
  return `${Number(lon).toFixed(5)},${Number(lat).toFixed(5)}|${z.toFixed(2)}|${Math.round(p)}|${Math.round(h)}`;
}

export function buildShapesCacheKey(shapes: ShapeProperties[] | undefined): string {
  if (!shapes?.length) return '0';
  return shapes
    .map((s) => `${s.id ?? ''}:${s.type ?? ''}`)
    .sort()
    .join('|');
}

export const PREVIEW_SNAP_MAX_AGE_MS = 45_000;

export function isPreviewSnapCacheValid(
  entry: PreviewSnapCacheEntry | null | undefined,
  fingerprint: string,
  shapesKey?: string,
): entry is PreviewSnapCacheEntry {
  if (!entry) return false;
  if (entry.fingerprint !== fingerprint) return false;
  if (shapesKey !== undefined && entry.shapesKey !== shapesKey) return false;
  return Date.now() - entry.createdAt < PREVIEW_SNAP_MAX_AGE_MS;
}

/** Önizleme oturumundan kalan snap — fingerprint kontrolü yok (prewarm tamamlandıysa) */
export function isPreviewSnapCacheFresh(
  entry: PreviewSnapCacheEntry | null | undefined,
  shapesKey?: string,
): entry is PreviewSnapCacheEntry {
  if (!entry) return false;
  if (shapesKey !== undefined && entry.shapesKey !== shapesKey) return false;
  return Date.now() - entry.createdAt < PREVIEW_SNAP_MAX_AGE_MS;
}
