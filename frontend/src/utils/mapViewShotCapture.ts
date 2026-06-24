/**
 * MapView captureRef — ekranda görünen piksel kadrajı (2D/3D WYSIWYG).
 * Native kırpma yok; mapCropNorm şablonda görsel clip için kullanılır.
 */

import type { RefObject } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { verifyCaptureFile } from './screenshotManager';
import type { ScreenshotPreviewMapFrame } from './screenshotPreviewLayout';

export type MapCropNorm = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisibleMapCaptureResult = {
  mapUri: string;
  sourceViewport: { width: number; height: number };
  mapCropNorm: MapCropNorm | null;
};

export type MapWindowFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function measureViewInWindow(
  viewRef: RefObject<View | null>,
): Promise<MapWindowFrame | null> {
  return new Promise((resolve) => {
    const node = viewRef.current;
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (width > 1 && height > 1) resolve({ x, y, width, height });
      else resolve(null);
    });
  });
}

/** Önizleme harita çerçevesini mapContainer koordinatlarında 0..1 normalize eder. */
export async function computeMapCropNorm(
  mapContainerRef: RefObject<View | null>,
  previewMapFrame: ScreenshotPreviewMapFrame | null,
): Promise<MapCropNorm | null> {
  if (!previewMapFrame) return null;

  const mapFrame = await measureViewInWindow(mapContainerRef);
  if (!mapFrame || mapFrame.width <= 1 || mapFrame.height <= 1) return null;

  const relX = previewMapFrame.left - mapFrame.x;
  const relY = previewMapFrame.top - mapFrame.y;
  const relW = previewMapFrame.width;
  const relH = previewMapFrame.height;
  if (relW <= 1 || relH <= 1) return null;

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  return {
    x: clamp01(relX / mapFrame.width),
    y: clamp01(relY / mapFrame.height),
    width: clamp01(relW / mapFrame.width),
    height: clamp01(relH / mapFrame.height),
  };
}

export type CaptureVisibleMapParams = {
  mapContainerRef: RefObject<View | null>;
  previewMapFrame: ScreenshotPreviewMapFrame | null;
};

/**
 * Harita captureRef → ham PNG + sourceViewport + mapCropNorm (şablonda clip).
 */
export async function captureVisibleMapForShare(
  params: CaptureVisibleMapParams,
): Promise<VisibleMapCaptureResult | null> {
  const { mapContainerRef, previewMapFrame } = params;
  const node = mapContainerRef.current;
  if (!node) {
    console.warn('[mapViewShotCapture] map container ref yok');
    return null;
  }

  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  let mapUri: string | null = null;
  try {
    mapUri = await captureRef(node, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
  } catch (e) {
    console.warn('[mapViewShotCapture] captureRef hatası:', e);
    return null;
  }

  if (!mapUri || !(await verifyCaptureFile(mapUri))) {
    console.warn('[mapViewShotCapture] captureRef boş veya geçersiz');
    return null;
  }

  const mapFrame = await measureViewInWindow(mapContainerRef);
  const sourceViewport = mapFrame
    ? { width: mapFrame.width, height: mapFrame.height }
    : { width: 1, height: 1 };

  const mapCropNorm = await computeMapCropNorm(mapContainerRef, previewMapFrame);

  return { mapUri, sourceViewport, mapCropNorm };
}
