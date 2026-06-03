import type React from "react";
import type { ShapeProperties } from "./types";
import { computeTextBoxLayout } from "./textBoxLayout";
import { pinHitSizePx } from "./mapPinStyles";
import { isOverlayVectorShape } from "./overlayShapePolicy";
import { projectLngLatsBatch, projectOverlayShapes } from "./shapeScreenProjection";
import { hitTestOverlayVectorAtScreenPoint } from "./shapeOverlayHitTest";
import type { MapOverlayViewport } from "./mapOverlayViewport";
import { isMapOverlayViewportReady } from "./mapOverlayViewport";

type MapRef = React.RefObject<any>;

async function lngLatToScreen(
  mapRef: MapRef,
  lngLat: [number, number],
  viewport?: MapOverlayViewport
): Promise<[number, number] | null> {
  const batch = await projectLngLatsBatch(mapRef, [lngLat], viewport);
  return batch[0] ?? null;
}

export function screenPointFromMapPressEvent(e: any): [number, number] | null {
  const px = e?.point ?? e?.properties;
  if (px && Number.isFinite(Number(px.x)) && Number.isFinite(Number(px.y))) {
    return [Number(px.x), Number(px.y)];
  }
  const sx = e?.properties?.screenPointX ?? e?.properties?.screenPoint?.[0];
  const sy = e?.properties?.screenPointY ?? e?.properties?.screenPoint?.[1];
  if (Number.isFinite(Number(sx)) && Number.isFinite(Number(sy))) {
    return [Number(sx), Number(sy)];
  }
  return null;
}

async function trySelectPointShapeAtLngLat(
  mapRef: MapRef,
  lngLat: [number, number],
  shapes: ShapeProperties[],
  screenPoint?: [number, number] | null,
  viewport?: MapOverlayViewport
): Promise<string | null> {
  const tapPxRaw = screenPoint ?? (await lngLatToScreen(mapRef, lngLat, viewport));
  if (!tapPxRaw) return null;
  const tapPx = tapPxRaw;

  let best: { id: string; dist: number } | null = null;

  for (const shape of shapes) {
    if (shape.screenSpace || shape.geometry?.type !== "Point") continue;

    const coord = shape.geometry.coordinates as [number, number];
      const centerPx = await lngLatToScreen(mapRef, coord, viewport);
    if (!centerPx) continue;

    const [tx, ty] = tapPx;
    const [cx, cy] = centerPx;

    if (shape.type === "textbox") {
      const textSize = typeof shape.textSize === "number" ? shape.textSize : 14;
      const shapeSizePercent =
        typeof shape.shapeSizePercent === "number" ? shape.shapeSizePercent : 100;
      const layout = computeTextBoxLayout(String(shape.text ?? ""), textSize, {
        boxFillEnabled: shape.boxFillEnabled !== false,
        shapeSizePercent,
      });
      const halfW = layout.widthPx / 2 + 14;
      const halfH = layout.heightPx / 2 + 14;
      if (Math.abs(tx - cx) <= halfW && Math.abs(ty - cy) <= halfH) {
        const dist = Math.hypot(tx - cx, ty - cy);
        if (!best || dist < best.dist) best = { id: shape.id, dist };
      }
      continue;
    }

    if (shape.type === "marker") {
      const hit = pinHitSizePx(shape);
      const halfW = hit.width / 2;
      const top = cy - hit.height;
      if (tx >= cx - halfW && tx <= cx + halfW && ty >= top && ty <= cy + 10) {
        const dist = Math.hypot(tx - cx, ty - (top + hit.height / 2));
        if (!best || dist < best.dist) best = { id: shape.id, dist };
      }
      continue;
    }
  }

  return best?.id ?? null;
}

export async function trySelectShapeAtLngLat(
  mapRef: MapRef,
  lngLat: [number, number],
  shapes: ShapeProperties[],
  screenPoint?: [number, number] | null,
  viewport?: MapOverlayViewport
): Promise<string | null> {
  if (!shapes.length) return null;

  const pointHit = await trySelectPointShapeAtLngLat(mapRef, lngLat, shapes, screenPoint, viewport);
  if (pointHit) return pointHit;

  const pxRaw = screenPoint ?? (await lngLatToScreen(mapRef, lngLat, viewport));
  if (!pxRaw) return null;
  const px = pxRaw;

  const vectorShapes = shapes.filter((s) => isOverlayVectorShape(s));
  if (vectorShapes.length > 0 && viewport && isMapOverlayViewportReady(viewport)) {
    const projected = await projectOverlayShapes(mapRef, vectorShapes, viewport);
    const vectorHit = hitTestOverlayVectorAtScreenPoint(px, vectorShapes, projected);
    if (vectorHit) return vectorHit;
  }

  return null;
}

export function textBoxHitSizePx(shape: ShapeProperties): { width: number; height: number } {
  const textSize = typeof shape.textSize === "number" ? shape.textSize : 14;
  const shapeSizePercent =
    typeof shape.shapeSizePercent === "number" ? shape.shapeSizePercent : 100;
  const layout = computeTextBoxLayout(String(shape.text ?? ""), textSize, {
    boxFillEnabled: shape.boxFillEnabled !== false,
    shapeSizePercent,
  });
  return {
    width: layout.widthPx + 16,
    height: layout.heightPx + 16,
  };
}
