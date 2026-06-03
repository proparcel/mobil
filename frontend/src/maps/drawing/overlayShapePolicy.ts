import type { ShapeProperties, ShapeType } from "./types";

/** Ekran overlay ile çizilen (Mapbox geometrisi yok) şekil tipleri. */
export const OVERLAY_POINT_SHAPE_TYPES: ShapeType[] = ["marker", "textbox"];

/** SVG overlay yalnızca ok — diğer vektörler Mapbox katmanında. */
export const OVERLAY_VECTOR_SHAPE_TYPES: ShapeType[] = ["arrow"];

export function isOverlayPointShape(shape: ShapeProperties): boolean {
  return !shape.screenSpace && OVERLAY_POINT_SHAPE_TYPES.includes(shape.type);
}

export function isOverlayVectorShape(shape: ShapeProperties): boolean {
  if (shape.screenSpace) return false;
  return OVERLAY_VECTOR_SHAPE_TYPES.includes(shape.type);
}

export function usesMapOverlayVisual(shape: ShapeProperties): boolean {
  return isOverlayPointShape(shape) || isOverlayVectorShape(shape);
}

export function shapeNeedsOverlayRelayout(shapes: ShapeProperties[]): boolean {
  return shapes.some((s) => usesMapOverlayVisual(s));
}
