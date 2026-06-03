export type MapOverlayViewport = {
  width: number;
  height: number;
};

export const DEFAULT_MAP_OVERLAY_VIEWPORT: MapOverlayViewport = {
  width: 1,
  height: 1,
};

export function isMapOverlayViewportReady(viewport: MapOverlayViewport): boolean {
  return viewport.width > 1 && viewport.height > 1;
}
