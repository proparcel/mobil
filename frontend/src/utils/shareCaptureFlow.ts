/**

 * Harita + tasarımlı şablon ekran görüntüsü yakalama akışı.

 * Önizleme: captureRef (WYSIWYG) + şablonda mapCropNorm clip; Mapbox live snap yedek.

 */



import type { MutableRefObject, RefObject } from 'react';

import { View } from 'react-native';

import RNFS from 'react-native-fs';

import { waitForMapIdle, tryMapboxSnap, tryMapboxSnapLiveView, type MapReadyState } from './mapboxSnapshot';

import {

  captureVisibleMapForShare,

  computeMapCropNorm,

  measureViewInWindow,

  type MapCropNorm,

  type VisibleMapCaptureResult,

} from './mapViewShotCapture';

import type { ScreenshotPreviewMapFrame } from './screenshotPreviewLayout';

import {

  capSnapDimensions,

  cleanupTempFiles,

  verifyCaptureFile,

  waitCaptureLayoutFrames,

} from './screenshotManager';

import { fetchStaticMapBase64 } from './staticMapCapture';

import type { ParcelPolygonDesignConfig } from '../constants/parcelPolygonDesign';

import type { StaticMapRenderPurpose } from '../constants/parcelMapStyle';

import type { ShapeProperties } from '../maps/drawing/types';

import {

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

import { fitParcelForShareCapture } from './parcelUtils';



export type { MapCropNorm };



export type CaptureMapResult = {

  mapUri: string;

  overlay: MapOverlayCapturePayload | null;

  sourceViewport: { width: number; height: number } | null;

  mapCropNorm: MapCropNorm | null;

  fromCache: boolean;

};



export type CaptureParcelShareMapParams = {

  parcelData?: any;

  mapRef?: RefObject<any>;

  cameraRef?: RefObject<any>;

  camRef?: RefObject<{ pitch?: number; zoom?: number; heading?: number }>;

  mapReadyRef?: MutableRefObject<MapReadyState>;

  dimensions: { mapWidth: number; mapHeight: number };

  parcelDesign?: ParcelPolygonDesignConfig | null;

  mapViewport?: MapOverlayViewport;

  shapes?: ShapeProperties[];

  bumpOverlayLayout?: () => void;

  getCameraFingerprint?: () => string;

  previewSnapCacheRef?: MutableRefObject<PreviewSnapCacheEntry | null>;

  isProgrammaticMoveRef?: MutableRefObject<boolean>;

  programmaticTimerRef?: MutableRefObject<ReturnType<typeof setTimeout> | null>;

  fromScreenshotPreview?: boolean;

  skipParcelFit?: boolean;

  mapContainerRef?: RefObject<View | null>;

  getPreviewMapFrameInWindow?: () => ScreenshotPreviewMapFrame | null;

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

): { mapWidth: number; mapHeight: number } {

  return capSnapDimensions({

    mapWidth: dimensions.mapWidth,

    mapHeight: dimensions.mapHeight,

  });

}



function isMapReadyIdle(mapReadyRef?: MutableRefObject<MapReadyState>): boolean {

  const s = mapReadyRef?.current;

  return Boolean(s?.didFinishLoadingMap && s?.didFinishLoadingStyle && s?.isIdle);

}



async function ensureParcelFitsForShareCapture(

  params: CaptureParcelShareMapParams,

  snapDims: { mapWidth: number; mapHeight: number },

): Promise<void> {

  const geometry = params.parcelData?.geometry;

  if (!geometry || !params.cameraRef || !params.mapRef) return;



  capturePerfMark('snap:fit-parcel');

  await fitParcelForShareCapture({

    mapRef: params.mapRef,

    cameraRef: params.cameraRef,

    camRef: params.camRef,

    geometry,

    viewport: { width: snapDims.mapWidth, height: snapDims.mapHeight },

    isProgrammaticMoveRef: params.isProgrammaticMoveRef,

    programmaticTimerRef: params.programmaticTimerRef,

  });

  capturePerfSince('snap:fit-parcel:done', 'snap:fit-parcel');



  if (params.mapReadyRef) {

    params.mapReadyRef.current.isIdle = false;

    await waitForMapIdle(params.mapReadyRef, 1500, { resetIfAlreadyIdle: false });

  }

  await new Promise((r) => requestAnimationFrame(() => r(null)));

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



/** Önizleme paylaşımı — captureRef birincil, takeSnapLiveView yedek; boyut zorlaması yok. */

async function takePreviewMapSnap(

  params: CaptureParcelShareMapParams,

): Promise<VisibleMapCaptureResult | null> {

  const { mapRef, mapContainerRef, getPreviewMapFrameInWindow } = params;

  const previewMapFrame = getPreviewMapFrameInWindow?.() ?? null;



  if (mapContainerRef?.current) {

    capturePerfMark('snap:viewshot');

    const captured = await captureVisibleMapForShare({

      mapContainerRef,

      previewMapFrame,

    });

    capturePerfSince('snap:viewshot:done', 'snap:viewshot');

    if (captured) return captured;

  }



  if (!mapRef?.current) return null;



  capturePerfMark('snap:mapbox-live');

  const mapUri = await tryMapboxSnapLiveView(mapRef);

  capturePerfSince('snap:mapbox-live:done', 'snap:mapbox-live');

  if (!mapUri) return null;



  const mapFrame = mapContainerRef ? await measureViewInWindow(mapContainerRef) : null;

  const sourceViewport = mapFrame

    ? { width: mapFrame.width, height: mapFrame.height }

    : { width: 1, height: 1 };

  const mapCropNorm = mapContainerRef

    ? await computeMapCropNorm(mapContainerRef, previewMapFrame)

    : null;



  return { mapUri, sourceViewport, mapCropNorm };

}



function resolveOverlayViewport(

  sourceViewport: { width: number; height: number } | null,

  snapDims: { mapWidth: number; mapHeight: number },

): MapOverlayViewport {

  if (sourceViewport && sourceViewport.width > 1 && sourceViewport.height > 1) {

    return sourceViewport;

  }

  return { width: snapDims.mapWidth, height: snapDims.mapHeight };

}



async function projectOverlaysIfNeeded(

  mapRef: RefObject<any>,

  shapes: ShapeProperties[] | undefined,

  viewport: MapOverlayViewport,

): Promise<MapOverlayCapturePayload | null> {

  if (!shapesNeedCaptureOverlayCompose(shapes)) return null;

  capturePerfMark('snap:overlay-project');

  const overlay = await projectMapOverlaysForCapture(mapRef, shapes!, viewport);

  capturePerfSince('snap:overlay-project:done', 'snap:overlay-project');

  return overlay;

}



async function tryStaticMapFallback(

  geometry: { type: string; coordinates: unknown } | undefined,

  parcelDesign?: ParcelPolygonDesignConfig | null,

): Promise<string | null> {

  if (!geometry) return null;

  try {

    return await staticMapGeometryToFileUri(geometry, parcelDesign, 'fullCapture');

  } catch {

    return null;

  }

}



/** Önizleme Onayla — her seferinde taze capture; cache/prewarm yok. */

async function captureScreenshotPreviewForShare(

  params: CaptureParcelShareMapParams,

): Promise<CaptureMapResult | null> {

  const { mapRef, mapReadyRef, dimensions, shapes, bumpOverlayLayout } = params;



  if (params.previewSnapCacheRef?.current?.mapUri) {

    await cleanupTempFiles([params.previewSnapCacheRef.current.mapUri]);

    params.previewSnapCacheRef.current = null;

  }



  if (!(await ensureMapRef(mapRef))) {

    console.warn('[shareCaptureFlow] MapView ref yok');

    return null;

  }



  const snapDims = resolveSnapDimensions(dimensions);

  const needsOverlayRelayout = shapesNeedCaptureOverlayCompose(shapes);



  if (mapReadyRef) {

    await waitForMapIdle(mapReadyRef, 2500, { resetIfAlreadyIdle: false });

  }

  if (needsOverlayRelayout) {

    bumpOverlayLayout?.();

  }

  await waitCaptureLayoutFrames(3);

  await new Promise((r) => requestAnimationFrame(() => r(null)));



  capturePerfMark('snap:preview-confirm');

  const captured = await takePreviewMapSnap(params);

  capturePerfSince('snap:preview-confirm:done', 'snap:preview-confirm');

  if (!captured?.mapUri) return null;



  const overlayViewport = resolveOverlayViewport(captured.sourceViewport, snapDims);

  const overlay = await projectOverlaysIfNeeded(mapRef!, shapes, overlayViewport);



  return {

    mapUri: captured.mapUri,

    overlay,

    sourceViewport: captured.sourceViewport,

    mapCropNorm: captured.mapCropNorm,

    fromCache: false,

  };

}



/**

 * Mapbox haritasını mevcut kamera açısıyla yakalar; overlay projeksiyonunu döndürür.

 */

export async function captureParcelShareMapUri(

  params: CaptureParcelShareMapParams,

): Promise<CaptureMapResult | null> {

  if (params.fromScreenshotPreview) {

    return captureScreenshotPreviewForShare(params);

  }



  const {

    mapRef,

    mapReadyRef,

    dimensions,

    shapes,

    bumpOverlayLayout,

    getCameraFingerprint,

    previewSnapCacheRef,

  } = params;



  if (!(await ensureMapRef(mapRef))) {

    console.warn('[shareCaptureFlow] MapView ref yok');

    return null;

  }



  const snapDims = resolveSnapDimensions(dimensions);

  const fingerprint = getCameraFingerprint?.() ?? '';

  const shapesKey = buildShapesCacheKey(shapes);

  const cached = previewSnapCacheRef?.current ?? null;



  if (cached) {

    const strictHit =

      Boolean(fingerprint) &&

      isPreviewSnapCacheValid(cached, fingerprint, shapesKey);



    if (strictHit) {

      capturePerfMark('snap:cache-hit');

      return {

        mapUri: cached.mapUri,

        overlay: cached.overlay,

        sourceViewport: cached.sourceViewport,

        mapCropNorm: null,

        fromCache: true,

      };

    }

  }



  await ensureParcelFitsForShareCapture(params, snapDims);



  const needsOverlayRelayout = shapesNeedCaptureOverlayCompose(shapes);

  await waitBeforeSnap(mapReadyRef, needsOverlayRelayout, bumpOverlayLayout);



  capturePerfMark('snap:mapbox');

  let mapUri = await tryMapboxSnap(mapRef!, snapDims);

  capturePerfSince('snap:mapbox:done', 'snap:mapbox');



  if (!mapUri) {

    mapUri = await tryStaticMapFallback(params.parcelData?.geometry, params.parcelDesign);

  }

  if (!mapUri) return null;



  const overlay = await projectOverlaysIfNeeded(mapRef!, shapes, snapDims);



  return {

    mapUri,

    overlay,

    sourceViewport: { width: snapDims.mapWidth, height: snapDims.mapHeight },

    mapCropNorm: null,

    fromCache: false,

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

  parcelDesign?: ParcelPolygonDesignConfig | null,

  purpose: StaticMapRenderPurpose = 'fullCapture',

): Promise<string | null> {

  const b64 = await fetchStaticMapBase64(geometry as any, parcelDesign, purpose);

  if (!b64) return null;

  const path = `${RNFS.CachesDirectoryPath}/static_map_share_${Date.now()}.png`;

  await RNFS.writeFile(path, b64, 'base64');

  return `file://${path}`;

}


