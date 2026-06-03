import type { ShapeType } from "@/src/maps/drawing/types";

/** Haritada yeni nokta/şekil/ölçüm yerleştiren aktif araç var mı? */
export type MapPlacementToolState = {
  measurementActive: boolean;
  shapeDrawingMode: ShapeType | null;
  freehandActive?: boolean;
  parcelSelectMode?: boolean;
};

export function isMapPlacementToolActive(state: MapPlacementToolState): boolean {
  return (
    state.measurementActive ||
    Boolean(state.shapeDrawingMode) ||
    Boolean(state.freehandActive) ||
    Boolean(state.parcelSelectMode)
  );
}
