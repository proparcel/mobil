import type React from "react";
import type { ShapeProperties } from "./types";
import { computeTextBoxLayout } from "./textBoxLayout";

type MapRef = React.RefObject<any>;

async function lngLatToScreen(
  mapRef: MapRef,
  lngLat: [number, number]
): Promise<[number, number] | null> {
  const map = mapRef?.current;
  if (!map || typeof map.getPointInView !== "function") return null;
  try {
    const p = await map.getPointInView(lngLat);
    if (!p || p.length < 2) return null;
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y];
  } catch {
    return null;
  }
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
  screenPoint?: [number, number] | null
): Promise<string | null> {
  const tapPx = screenPoint ?? (await lngLatToScreen(mapRef, lngLat));
  if (!tapPx) return null;

  let best: { id: string; dist: number } | null = null;

  for (const shape of shapes) {
    if (shape.screenSpace || shape.geometry?.type !== "Point") continue;

    const coord = shape.geometry.coordinates as [number, number];
    const centerPx = await lngLatToScreen(mapRef, coord);
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
      const r = 28;
      const dist = Math.hypot(tx - cx, ty - cy);
      if (dist <= r && (!best || dist < best.dist)) {
        best = { id: shape.id, dist };
      }
    }
  }

  return best?.id ?? null;
}

export async function trySelectShapeAtLngLat(
  mapRef: MapRef,
  lngLat: [number, number],
  shapes: ShapeProperties[],
  screenPoint?: [number, number] | null
): Promise<string | null> {
  if (!shapes.length) return null;

  const pointHit = await trySelectPointShapeAtLngLat(mapRef, lngLat, shapes, screenPoint);
  if (pointHit) return pointHit;

  const map = mapRef?.current;
  if (!map || typeof map.queryRenderedFeaturesAtPoint !== "function") return null;

  try {
    const px = screenPoint ?? (await lngLatToScreen(mapRef, lngLat));
    if (!px) return null;

    const probes: [number, number][] = [
      px,
      [px[0] + 8, px[1]],
      [px[0] - 8, px[1]],
      [px[0], px[1] + 8],
      [px[0], px[1] - 8],
    ];

    for (const probe of probes) {
      const fc = await map.queryRenderedFeaturesAtPoint(probe, [], []);
      for (const f of fc?.features ?? []) {
        const sid = f?.properties?.shapeId;
        if (sid != null && String(sid).length > 0) {
          return String(sid);
        }
      }
    }
  } catch {
    /* ignore */
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
