import type { RefObject } from "react";

const BUILDING_EXTRUSION_LAYER_ID = "building-extrusion-fill";

/**
 * Haritada bina extrusion katmanına uzun basış / hit-test (modellerle aynı fikir).
 */
export async function trySelectBuildingAtLngLat(
  mapRef: RefObject<any>,
  lngLat: [number, number]
): Promise<string | null> {
  const map = mapRef?.current;
  if (!map || typeof map.getPointInView !== "function" || typeof map.queryRenderedFeaturesAtPoint !== "function") {
    return null;
  }
  try {
    const point = await map.getPointInView(lngLat);
    if (!point || point.length < 2) return null;
    const px = Number(point[0]);
    const py = Number(point[1]);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

    const probes: [number, number][] = [
      [0, 0],
      [12, 0],
      [-12, 0],
      [0, 12],
      [0, -12],
      [20, 20],
      [-20, -20],
    ];
    for (const [ox, oy] of probes) {
      const fc = await map.queryRenderedFeaturesAtPoint([px + ox, py + oy], [], [BUILDING_EXTRUSION_LAYER_ID]);
      const bid = fc?.features?.[0]?.properties?.id;
      if (bid == null || String(bid).length === 0) continue;
      if (String(bid) === "building-draft-preview") continue;
      return String(bid);
    }
    return null;
  } catch {
    return null;
  }
}
