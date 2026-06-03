import type { MapOverlayViewport } from "./mapOverlayViewport";
import type { ScreenPoint } from "./shapeScreenProjection";

export function isFiniteScreenPoint(p: ScreenPoint | null | undefined): p is ScreenPoint {
  return Boolean(p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

/** Ekran noktası viewport içinde mi? */
export function isScreenPointInsideViewport(
  p: ScreenPoint,
  viewport: MapOverlayViewport
): boolean {
  return (
    p[0] >= 0 &&
    p[0] <= viewport.width &&
    p[1] >= 0 &&
    p[1] <= viewport.height
  );
}
