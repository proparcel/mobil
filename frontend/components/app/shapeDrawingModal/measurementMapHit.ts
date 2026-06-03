/**
 * Haritada ölçüm / kenar katmanlarına dokunma ve uzun basışta silme için hit-test
 */
import type { RefObject } from "react";

const EDGE_LAYER_RE = /^edge-(?:bbox-line|lbl-layer|pick)-/;

const MEAS_LAYER_PATTERNS: RegExp[] = [
  /^meas-(?:pt|ln|label)-layer-(\d+)$/,
  /^meas-(?:poly-fill|poly-line|pg-fill|pg-stroke)-(\d+)$/,
  /^meas-(?:poly-fill|poly-line|pg-fill|pg-stroke)-layer-(\d+)$/,
];

const PICK_PROBE_OFFSETS_PX: [number, number][] = (() => {
  const out: [number, number][] = [[0, 0]];
  const ring = (d: number) => {
    for (const [x, y] of [
      [d, 0],
      [-d, 0],
      [0, d],
      [0, -d],
      [d, d],
      [d, -d],
      [-d, d],
      [-d, -d],
    ] as [number, number][]) {
      out.push([x, y]);
    }
  };
  ring(12);
  ring(24);
  ring(36);
  ring(48);
  return out;
})();

function measurementFeatureIndexFromLayerId(layerId: string): number | null {
  for (const re of MEAS_LAYER_PATTERNS) {
    const m = re.exec(layerId);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    if (Number.isFinite(idx)) return idx;
  }
  return null;
}

function groupIdFromMergedFeatureIndex(mergedFeatures: any[], idx: number): string | null {
  const gid = mergedFeatures[idx]?.properties?.measurementGroupId;
  return typeof gid === "string" && gid.length > 0 ? gid : null;
}

async function queryMeasurementHitAtLngLat(
  mapRef: RefObject<any>,
  lngLat: [number, number],
  mergedFeatures: any[]
): Promise<{ type: "edge" } | { type: "group"; groupId: string } | null> {
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

    for (const [ox, oy] of PICK_PROBE_OFFSETS_PX) {
      const fc = await map.queryRenderedFeaturesAtPoint([px + ox, py + oy]);
      const features = fc?.features ?? [];
      for (const feat of features) {
        const lid = String((feat as any)?.layer?.id ?? "");
        if (EDGE_LAYER_RE.test(lid)) {
          return { type: "edge" };
        }
        const idx = measurementFeatureIndexFromLayerId(lid);
        if (idx == null) continue;
        const groupId = groupIdFromMergedFeatureIndex(mergedFeatures, idx);
        if (groupId) {
          return { type: "group", groupId };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export type MeasurementDeleteTarget = { type: "edge" } | { type: "group"; groupId: string };

export async function tryHitMeasurementGroupAtLngLat(
  mapRef: RefObject<any>,
  lngLat: [number, number],
  mergedFeatures: any[]
): Promise<string | null> {
  const hit = await queryMeasurementHitAtLngLat(mapRef, lngLat, mergedFeatures);
  return hit?.type === "group" ? hit.groupId : null;
}

export async function tryHitMeasurementForDelete(
  mapRef: RefObject<any>,
  lngLat: [number, number],
  mergedFeatures: any[]
): Promise<MeasurementDeleteTarget | null> {
  return queryMeasurementHitAtLngLat(mapRef, lngLat, mergedFeatures);
}
