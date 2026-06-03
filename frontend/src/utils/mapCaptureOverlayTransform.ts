/** Harita snapshot (kaynak viewport) → şablon alanı: Image resizeMode="cover" ile aynı dönüşüm */

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
