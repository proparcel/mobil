/**
 * Harita ekran görüntüsü için overlay projeksiyonu (mevcut kamera açısı korunur).
 */

import type { RefObject } from 'react';
import type { ShapeProperties } from '../maps/drawing/types';
import {
  isMapOverlayViewportReady,
  type MapOverlayViewport,
} from '../maps/drawing/mapOverlayViewport';
import { usesMapOverlayVisual } from '../maps/drawing/overlayShapePolicy';
import { textBoxHitSizePx } from '../maps/drawing/shapePickAtLngLat';
import { pinHitSizePx } from '../maps/drawing/mapPinStyles';
import {
  projectLngLatsBatch,
  projectOverlayShapes,
  type ProjectedShapeGeometry,
} from '../maps/drawing/shapeScreenProjection';

export type MapOverlayCapturePointItem = {
  shape: ShapeProperties;
  x: number;
  y: number;
  hitWidth: number;
  hitHeight: number;
};

export type MapOverlayCaptureVectorItem = {
  shape: ShapeProperties;
  geom: ProjectedShapeGeometry;
};

export type MapOverlayCapturePayload = {
  screenSpaceShapes: ShapeProperties[];
  vectorItems: MapOverlayCaptureVectorItem[];
  textBoxes: MapOverlayCapturePointItem[];
  pins: MapOverlayCapturePointItem[];
};

export function shapesNeedCaptureOverlayCompose(shapes: ShapeProperties[] | undefined): boolean {
  if (!shapes?.length) return false;
  return shapes.some(
    (s) =>
      (s.screenSpace && s.geometry?.type === 'LineString') || usesMapOverlayVisual(s),
  );
}

export async function projectMapOverlaysForCapture(
  mapRef: RefObject<any>,
  shapes: ShapeProperties[],
  viewport: MapOverlayViewport,
): Promise<MapOverlayCapturePayload> {
  const screenSpaceShapes = shapes.filter(
    (s) => s.screenSpace && s.geometry?.type === 'LineString',
  );

  const empty: MapOverlayCapturePayload = {
    screenSpaceShapes,
    vectorItems: [],
    textBoxes: [],
    pins: [],
  };

  if (!isMapOverlayViewportReady(viewport)) return empty;

  const vectorShapes = shapes.filter((s) => usesMapOverlayVisual(s) && s.type === 'arrow');
  const projectedVectors = await projectOverlayShapes(mapRef, vectorShapes, viewport);
  const vectorItems: MapOverlayCaptureVectorItem[] = vectorShapes
    .map((shape) => {
      const geom = projectedVectors[shape.id];
      return geom ? { shape, geom } : null;
    })
    .filter((x): x is MapOverlayCaptureVectorItem => x != null);

  const textboxShapes = shapes.filter(
    (s) =>
      s.type === 'textbox' &&
      !s.screenSpace &&
      s.geometry?.type === 'Point' &&
      Array.isArray(s.geometry.coordinates) &&
      s.geometry.coordinates.length >= 2,
  );
  const pinShapes = shapes.filter(
    (s) =>
      s.type === 'marker' &&
      !s.screenSpace &&
      s.geometry?.type === 'Point' &&
      Array.isArray(s.geometry.coordinates) &&
      s.geometry.coordinates.length >= 2,
  );

  const textBoxes: MapOverlayCapturePointItem[] = [];
  const pins: MapOverlayCapturePointItem[] = [];

  if (textboxShapes.length || pinShapes.length) {
    const allCoords: [number, number][] = [
      ...textboxShapes.map((s) => s.geometry.coordinates as [number, number]),
      ...pinShapes.map((s) => s.geometry.coordinates as [number, number]),
    ];
    const projected = await projectLngLatsBatch(mapRef, allCoords, viewport);
    const tbCount = textboxShapes.length;

    textboxShapes.forEach((shape, i) => {
      const p = projected[i];
      if (!p) return;
      const hit = textBoxHitSizePx(shape);
      textBoxes.push({
        shape,
        x: p[0],
        y: p[1],
        hitWidth: hit.width,
        hitHeight: hit.height,
      });
    });

    pinShapes.forEach((shape, i) => {
      const p = projected[tbCount + i];
      if (!p) return;
      const hit = pinHitSizePx(shape);
      pins.push({
        shape,
        x: p[0],
        y: p[1],
        hitWidth: hit.width,
        hitHeight: hit.height,
      });
    });
  }

  return { screenSpaceShapes, vectorItems, textBoxes, pins };
}
