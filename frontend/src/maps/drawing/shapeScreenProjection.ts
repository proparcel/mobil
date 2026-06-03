import type { RefObject } from "react";
import type { ShapeProperties } from "./types";
import { getOverlayStrokeWidth } from "./mapOverlayStyles";
import { buildArrowScreenModel } from "./arrowOverlayGeometry";
import type { ArrowScreenModel } from "./arrowOverlayGeometry";
import { normalizeMapArrowVariant } from "./mapArrowStyles";
import {
  isFiniteScreenPoint,
  isScreenPointInsideViewport,
} from "./mapOverlayProjection";
import type { MapOverlayViewport } from "./mapOverlayViewport";

export type ScreenPoint = [number, number];

export type ProjectedShapeGeometry = {
  id: string;
  polylines: ScreenPoint[][];
  polygons: ScreenPoint[][];
  polygonIsArrowHead?: boolean[];
  arrow?: ArrowScreenModel;
};

export type ScreenBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
};

export function computeScreenBBoxFromPoints(
  points: ReadonlyArray<readonly [number, number]>
): ScreenBBox | null {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of points) {
    const x = pt[0];
    const y = pt[1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (!(w > 0) || !(h > 0)) return null;
  return { minX, minY, maxX, maxY, w, h };
}

export async function unprojectScreenPointsBatch(
  mapRef: RefObject<any>,
  points: ScreenPoint[]
): Promise<(ScreenPoint | null)[]> {
  if (!points.length) return [];
  const map = mapRef?.current;
  if (!map || typeof map.getCoordinateFromView !== "function") {
    return points.map(() => null);
  }

  return Promise.all(
    points.map(async ([x, y]) => {
      try {
        const c = await map.getCoordinateFromView([x, y]);
        if (!c || c.length < 2) return null;
        const lng = Number(c[0]);
        const lat = Number(c[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        return [lng, lat] as ScreenPoint;
      } catch {
        return null;
      }
    })
  );
}

export async function lngLatToScreenPoint(
  mapRef: RefObject<any>,
  lngLat: [number, number],
  viewport?: MapOverlayViewport
): Promise<ScreenPoint | null> {
  const batch = await projectLngLatsBatch(mapRef, [lngLat], viewport);
  return batch[0] ?? null;
}

export async function projectLngLatsBatch(
  mapRef: RefObject<any>,
  coords: [number, number][],
  _viewport?: MapOverlayViewport
): Promise<(ScreenPoint | null)[]> {
  if (!coords.length) return [];
  const map = mapRef?.current;
  if (!map || typeof map.getPointInView !== "function") {
    return coords.map(() => null);
  }

  return Promise.all(
    coords.map(async (lngLat) => {
      try {
        const p = await map.getPointInView(lngLat);
        if (!p || p.length < 2) return null;
        const x = Number(p[0]);
        const y = Number(p[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return [x, y] as ScreenPoint;
      } catch {
        return null;
      }
    })
  );
}

function collectArrowEndpoints(shape: ShapeProperties): [number, number][] | null {
  const geom = shape.geometry;
  if (geom?.type !== "LineString" || shape.type !== "arrow") return null;
  const coords = geom.coordinates as [number, number][];
  if (!coords || coords.length < 2) return null;
  return [coords[0], coords[coords.length - 1]];
}

/** Ok: her iki uç viewport içindeyse çiz; taşma varsa tamamen gizle (clamp yok). */
function projectArrowFromScreens(
  shape: ShapeProperties,
  startScreen: ScreenPoint,
  endScreen: ScreenPoint,
  viewport: MapOverlayViewport
): ProjectedShapeGeometry | null {
  if (
    !isScreenPointInsideViewport(startScreen, viewport) ||
    !isScreenPointInsideViewport(endScreen, viewport)
  ) {
    return null;
  }

  const strokeW = getOverlayStrokeWidth(shape, false);
  const variant = normalizeMapArrowVariant(shape.arrowVariant);
  const arrow = buildArrowScreenModel(startScreen, endScreen, strokeW, variant);
  if (!arrow) return null;

  return { id: shape.id, polylines: [], polygons: [], arrow };
}

function projectArrowGeometry(
  shape: ShapeProperties,
  viewport: MapOverlayViewport,
  startScreen: ScreenPoint | null,
  endScreen: ScreenPoint | null
): ProjectedShapeGeometry | null {
  if (!isFiniteScreenPoint(startScreen) || !isFiniteScreenPoint(endScreen)) {
    return null;
  }
  return projectArrowFromScreens(
    shape,
    [startScreen[0], startScreen[1]],
    [endScreen[0], endScreen[1]],
    viewport
  );
}

export async function projectShapeGeometry(
  mapRef: RefObject<any>,
  shape: ShapeProperties,
  viewport?: MapOverlayViewport
): Promise<ProjectedShapeGeometry | null> {
  if (shape.type !== "arrow" || !viewport) return null;
  const endpoints = collectArrowEndpoints(shape);
  if (!endpoints) return null;
  const [startScreen, endScreen] = await projectLngLatsBatch(mapRef, endpoints, viewport);
  return projectArrowGeometry(shape, viewport, startScreen, endScreen);
}

/** Overlay okları — tek batch projeksiyon (camera change sonrası bir kez). */
export async function projectOverlayShapes(
  mapRef: RefObject<any>,
  shapes: ShapeProperties[],
  viewport?: MapOverlayViewport
): Promise<Record<string, ProjectedShapeGeometry>> {
  if (!shapes.length || !viewport) return {};

  const arrowMeta: ShapeProperties[] = [];
  const arrowCoords: [number, number][] = [];

  for (const shape of shapes) {
    if (shape.type !== "arrow") continue;
    const endpoints = collectArrowEndpoints(shape);
    if (!endpoints) continue;
    arrowMeta.push(shape);
    arrowCoords.push(endpoints[0], endpoints[1]);
  }

  if (!arrowMeta.length) return {};

  const projected = await projectLngLatsBatch(mapRef, arrowCoords, viewport);
  const next: Record<string, ProjectedShapeGeometry> = {};

  for (let i = 0; i < arrowMeta.length; i++) {
    const shape = arrowMeta[i];
    const g = projectArrowGeometry(shape, viewport, projected[i * 2], projected[i * 2 + 1]);
    if (g) next[shape.id] = g;
  }

  return next;
}

export function pointsToSvg(points: ScreenPoint[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}
