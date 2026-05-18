/**
 * Haritada ölçüm / kenar katmanlarına uzun basışta silme için hit-test
 */
import type { RefObject } from "react";

/** ShapeDrawingMapView katman adları: meas-{pt|ln|poly-fill|poly-line|label}-layer-{i} */
const MEAS_LAYER_RE = /^meas-(?:pt|ln|poly-fill|poly-line|label)-layer-(\d+)$/;
const EDGE_LAYER_RE = /^edge-(?:bbox-line|lbl-layer|pick)-/;

export type MeasurementDeleteTarget = { type: "edge" } | { type: "group"; groupId: string };

export async function tryHitMeasurementForDelete(
  mapRef: RefObject<any>,
  lngLat: [number, number],
  mergedFeatures: any[]
): Promise<MeasurementDeleteTarget | null> {
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
    const fc = await map.queryRenderedFeaturesAtPoint([px, py]);
    const features = fc?.features ?? [];
    for (const feat of features) {
      const lid = String((feat as any)?.layer?.id ?? "");
      if (EDGE_LAYER_RE.test(lid)) {
        return { type: "edge" };
      }
      const m = MEAS_LAYER_RE.exec(lid);
      if (m) {
        const idx = parseInt(m[1], 10);
        if (Number.isFinite(idx) && mergedFeatures[idx]) {
          const gid = mergedFeatures[idx]?.properties?.measurementGroupId;
          if (typeof gid === "string" && gid.length > 0) {
            return { type: "group", groupId: gid };
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
