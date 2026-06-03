/**
 * Harita + tasarımlı şablon ekran görüntüsü yakalama akışı.
 * Mapbox snapshot mevcut kamera (3D pitch/bearing dahil) ile alınır; overlay tek ViewShot'ta birleştirilir.
 */

import type { MutableRefObject, RefObject } from 'react';
import RNFS from 'react-native-fs';
import { waitForMapIdle, tryMapboxSnap, type MapReadyState } from './mapboxSnapshot';
import {
  capSnapDimensions,
  cleanupTempFiles,
  verifyCaptureFile,
  waitCaptureLayoutFrames,
} from './screenshotManager';
import { fetchStaticMapBase64 } from './staticMapCapture';
import type { ShapeProperties } from '../maps/drawing/types';
import {
  isMapOverlayViewportReady,
  type MapOverlayViewport,
} from '../maps/drawing/mapOverlayViewport';
import {
  projectMapOverlaysForCapture,
  shapesNeedCaptureOverlayCompose,
  type MapOverlayCapturePayload,
} from './mapOverlayCaptureProjection';
import type {
  CaptureWithMapUriOptions,
  CombinedScreenshotCaptureRef,
} from '../../components/app/CombinedScreenshotContainer';
import {
  buildShapesCacheKey,
  isPreviewSnapCacheValid,
  type PreviewSnapCacheEntry,
} from './captureSnapCache';
import { capturePerfMark, capturePerfSince } from './capturePerf';

export type CaptureMapResult = {
  mapUri: string;
  overlay: MapOverlayCapturePayload | null;
  sourceViewport: { width: number; height: number } | null;
  fromCache: boolean;
};

export type CaptureParcelShareMapParams = {
  parcelData?: any;
  mapRef?: RefObject<any>;
  mapReadyRef?: MutableRefObject<MapReadyState>;
  dimensions: { mapWidth: number; mapHeight: number };
  parcelDesign?: unknown;
  mapViewport?: MapOverlayViewport;
  shapes?: ShapeProperties[];
  bumpOverlayLayout?: () => void;
  getCameraFingerprint?: () => string;
  previewSnapCacheRef?: MutableRefObject<PreviewSnapCacheEntry | null>;
  previewPrewarmInFlightRef?: MutableRefObject<Promise<void> | null>;
};

async function waitForViewShotRef(
  ref: RefObject<{ capture?: () => Promise<string>; captureWithMapUri?: (uri: string, opts?: CaptureWithMapUriOptions) => Promise<string> } | null>,
  maxRetries = 20,
  intervalMs = 40,
): Promise<boolean> {
  if (ref.current?.captureWithMapUri || ref.current?.capture) return true;
  let retries = 0;
  while (!ref.current?.captureWithMapUri && !ref.current?.capture && retries < maxRetries) {
    await new Promise((r) => setTimeout(r, intervalMs));
    retries++;
  }
  return Boolean(ref.current?.captureWithMapUri || ref.current?.capture);
}

function resolveSnapDimensions(
  dimensions: { mapWidth: number; mapHeight: number },
  mapViewport?: MapOverlayViewport,
): { mapWidth: number; mapHeight: number } {
  if (isMapOverlayViewportReady(mapViewport ?? { width: 0, height: 0 })) {
    return capSnapDimensions({
      mapWidth: Math.round(mapViewport!.width),
      mapHeight: Math.round(mapViewport!.height),
    });
  }
  return capSnapDimensions({
    mapWidth: dimensions.mapWidth,
    mapHeight: dimensions.mapHeight,
  });
}

function isMapReadyIdle(mapReadyRef?: MutableRefObject<MapReadyState>): boolean {
  const s = mapReadyRef?.current;
  return Boolean(s?.didFinishLoadingMap && s?.didFinishLoadingStyle && s?.isIdle);
}

async function ensureMapRef(mapRef?: RefObject<any>): Promise<boolean> {
  if (mapRef?.current) return true;
  let retries = 0;
  while (!mapRef?.current && retries < 10) {
    await new Promise((r) => setTimeout(r, 50));
    retries++;
  }
  return Boolean(mapRef?.current);
}

/**
 * Snap öncesi kısa bekleme.
 * Çizim/metin overlay'leri için map idle beklenmez — paylaşım sırasında isSharingRef
 * onMapIdle'ı keser ve 2.2s timeout'a yol açardı.
 */
async function waitBeforeSnap(
  mapReadyRef: MutableRefObject<MapReadyState> | undefined,
  needsOverlayRelayout: boolean,
  bumpOverlayLayout?: () => void,
): Promise<void> {
  const wasIdle = isMapReadyIdle(mapReadyRef);

  if (needsOverlayRelayout) {
    bumpOverlayLayout?.();
    await waitCaptureLayoutFrames(2);
  } else if (!wasIdle && mapReadyRef) {
    await waitForMapIdle(mapReadyRef, 1500, { resetIfAlreadyIdle: false });
  } else {
    await new Promise((r) => setTimeout(r, 50));
  }

  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

async function takeMapboxSnap(
  mapRef: RefObject<any>,
  snapDims: { mapWidth: number; mapHeight: number },
): Promise<string | null> {
  capturePerfMark('snap:mapbox');
  const mapUri = await tryMapboxSnap(mapRef, snapDims);
  capturePerfSince('snap:mapbox:done', 'snap:mapbox');
  return mapUri;
}

async function projectOverlaysIfNeeded(
  mapRef: RefObject<any>,
  shapes: ShapeProperties[] | undefined,
  snapDims: { mapWidth: number; mapHeight: number },
): Promise<MapOverlayCapturePayload | null> {
  if (!shapesNeedCaptureOverlayCompose(shapes)) return null;
  capturePerfMark('snap:overlay-project');
  const overlay = await projectMapOverlaysForCapture(mapRef, shapes!, {
    width: snapDims.mapWidth,
    height: snapDims.mapHeight,
  });
  capturePerfSince('snap:overlay-project:done', 'snap:overlay-project');
  return overlay;
}

/** Devam eden prewarm varsa tamamlanmasını bekler (paylaşım öncesi) */
export async function awaitPreviewSnapReady(
  inFlightRef?: MutableRefObject<Promise<void> | null>,
): Promise<void> {
  const pending = inFlightRef?.current;
  if (!pending) return;
  try {
    await pending;
  } catch {
    /* prewarm hatası paylaşımı durdurmasın */
  }
}

/**
 * Önizleme modunda arka planda harita snapshot + overlay projeksiyonunu önceden alır.
 */
export async function prewarmPreviewSnap(params: CaptureParcelShareMapParams): Promise<void> {
  const {
    mapRef,
    mapReadyRef,
    dimensions,
    mapViewport,
    bumpOverlayLayout,
    shapes,
    getCameraFingerprint,
    previewSnapCacheRef,
  } = params;
  if (!previewSnapCacheRef || !getCameraFingerprint) return;

  const fingerprint = getCameraFingerprint();
  const shapesKey = buildShapesCacheKey(shapes);
  if (isPreviewSnapCacheValid(previewSnapCacheRef.current, fingerprint, shapesKey)) return;

  if (!(await ensureMapRef(mapRef))) return;

  const snapDims = resolveSnapDimensions(dimensions, mapViewport);
  const needsOverlayRelayout = shapesNeedCaptureOverlayCompose(shapes);
  await waitBeforeSnap(mapReadyRef, needsOverlayRelayout, bumpOverlayLayout);

  const mapUri = await takeMapboxSnap(mapRef!, snapDims);
  if (!mapUri) return;

  const overlay = await projectOverlaysIfNeeded(mapRef!, shapes, snapDims);

  if (previewSnapCacheRef.current?.mapUri && previewSnapCacheRef.current.mapUri !== mapUri) {
    await cleanupTempFiles([previewSnapCacheRef.current.mapUri]);
  }

  previewSnapCacheRef.current = {
    fingerprint,
    shapesKey,
    mapUri,
    overlay,
    sourceViewport: { width: snapDims.mapWidth, height: snapDims.mapHeight },
    createdAt: Date.now(),
  };
}

/** Prewarm'ı başlatır; in-flight ref ile paylaşım bekleyebilir */
export function startPreviewSnapPrewarm(
  params: CaptureParcelShareMapParams,
): void {
  const inFlightRef = params.previewPrewarmInFlightRef;
  if (!inFlightRef) {
    void prewarmPreviewSnap(params);
    return;
  }
  if (inFlightRef.current) return;

  const task = prewarmPreviewSnap(params).finally(() => {
    if (inFlightRef.current === task) {
      inFlightRef.current = null;
    }
  });
  inFlightRef.current = task;
}

/**
 * Mapbox haritasını mevcut kamera açısıyla yakalar; overlay projeksiyonunu döndürür.
 */
export async function captureParcelShareMapUri(
  params: CaptureParcelShareMapParams,
): Promise<CaptureMapResult | null> {
  const {
    mapRef,
    mapReadyRef,
    dimensions,
    mapViewport,
    shapes,
    bumpOverlayLayout,
    getCameraFingerprint,
    previewSnapCacheRef,
    previewPrewarmInFlightRef,
  } = params;

  await awaitPreviewSnapReady(previewPrewarmInFlightRef);

  if (!(await ensureMapRef(mapRef))) {
    console.warn('[shareCaptureFlow] MapView ref yok');
    return null;
  }

  const snapDims = resolveSnapDimensions(dimensions, mapViewport);
  const fingerprint = getCameraFingerprint?.() ?? '';
  const shapesKey = buildShapesCacheKey(shapes);
  const cacheHit =
    previewSnapCacheRef &&
    fingerprint &&
    isPreviewSnapCacheValid(previewSnapCacheRef.current, fingerprint, shapesKey);

  let mapUri: string | null = null;
  let overlay: MapOverlayCapturePayload | null = null;
  let sourceViewport: { width: number; height: number } | null = null;
  let fromCache = false;

  if (cacheHit && previewSnapCacheRef?.current) {
    mapUri = previewSnapCacheRef.current.mapUri;
    overlay = previewSnapCacheRef.current.overlay;
    sourceViewport = previewSnapCacheRef.current.sourceViewport;
    fromCache = true;
    capturePerfMark('snap:cache-hit');
  } else {
    const needsOverlayRelayout = shapesNeedCaptureOverlayCompose(shapes);
    await waitBeforeSnap(mapReadyRef, needsOverlayRelayout, bumpOverlayLayout);
    mapUri = await takeMapboxSnap(mapRef!, snapDims);
    if (!mapUri) return null;
    overlay = await projectOverlaysIfNeeded(mapRef!, shapes, snapDims);
    sourceViewport = { width: snapDims.mapWidth, height: snapDims.mapHeight };
  }

  if (!mapUri) return null;

  return {
    mapUri,
    overlay,
    sourceViewport,
    fromCache,
  };
}

export async function captureCombinedScreenshotUri(
  combinedContainerRef: RefObject<CombinedScreenshotCaptureRef | null>,
  mapUri: string | null,
  options?: CaptureWithMapUriOptions & { mapOnly?: boolean },
): Promise<string> {
  if (!mapUri) {
    throw new Error('Harita görüntüsü alınamadı');
  }

  const skipViewShot = Boolean(options?.skipViewShot);
  if (skipViewShot) {
    const ok = await verifyCaptureFile(mapUri);
    if (!ok) throw new Error('Harita görüntüsü geçersiz');
    return mapUri;
  }

  await waitForViewShotRef(combinedContainerRef);

  const api = combinedContainerRef.current;
  if (!api) {
    throw new Error('Paylaşım şablonu hazır değil');
  }

  capturePerfMark('combined:viewshot');
  const combinedUri =
    typeof api.captureWithMapUri === 'function'
      ? await api.captureWithMapUri(mapUri, options)
      : await api.capture();
  capturePerfSince('combined:viewshot:done', 'combined:viewshot');

  if (!combinedUri) {
    throw new Error('Paylaşılacak görüntü bulunamadı');
  }
  return combinedUri;
}

export async function staticMapGeometryToFileUri(
  geometry: { type: string; coordinates: unknown },
): Promise<string | null> {
  const b64 = await fetchStaticMapBase64(geometry as any);
  if (!b64) return null;
  const path = `${RNFS.CachesDirectoryPath}/static_map_share_${Date.now()}.png`;
  await RNFS.writeFile(path, b64, 'base64');
  return `file://${path}`;
}
