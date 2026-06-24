/** Harita snapshot (kaynak viewport) → şablon alanı: Image resizeMode="cover" ile aynı dönüşüm */

import type { MapCropNorm } from './mapViewShotCapture';

export type CoverTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function computeCoverTransform(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): CoverTransform {
  if (!(srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0)) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const scaledW = srcW * scale;
  const scaledH = srcH * scale;
  return {
    scale,
    offsetX: (dstW - scaledW) / 2,
    offsetY: (dstH - scaledH) / 2,
  };
}

export function transformCapturePoint(
  x: number,
  y: number,
  t: CoverTransform,
): { x: number; y: number } {
  return {
    x: x * t.scale + t.offsetX,
    y: y * t.scale + t.offsetY,
  };
}

/** mapCropNorm ile kırpılmış kaynak → şablon (MapCaptureClippedImage ile aynı matematik). */
export function computeCropClipTransform(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  crop: MapCropNorm,
): CoverTransform {
  const cropW = crop.width * srcW;
  const cropH = crop.height * srcH;
  if (!(cropW > 0 && cropH > 0 && dstW > 0 && dstH > 0)) {
    return computeCoverTransform(srcW, srcH, dstW, dstH);
  }
  const scale = Math.max(dstW / cropW, dstH / cropH);
  return {
    scale,
    offsetX: -crop.x * srcW * scale,
    offsetY: -crop.y * srcH * scale,
  };
}

export function computeCaptureOverlayTransform(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  mapCropNorm?: MapCropNorm | null,
): CoverTransform {
  if (
    mapCropNorm &&
    mapCropNorm.width > 0 &&
    mapCropNorm.height > 0
  ) {
    return computeCropClipTransform(srcW, srcH, dstW, dstH, mapCropNorm);
  }
  return computeCoverTransform(srcW, srcH, dstW, dstH);
}
