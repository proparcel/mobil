/**
 * Web `myapp/static/js/quarter_info/layers.js` + `toolbar.js` ile aynı katman anahtarları.
 * `features` API alanı: veri var mı; `layers` içinde GeoJSON.
 */

export type QuarterLayerKind = "line" | "fill" | "circle" | "fillSlope" | "gridFill";

export type QuarterLayerDef = {
  layerId: string;
  /** API `features` objesi anahtarı (toolbar.js FEATURE_BUTTON_MAP) */
  featureKey: string;
  label: string;
  group: string;
  kind: QuarterLayerKind;
};

/** Web toolbar gruplarına göre sıra */
export const QUARTER_LAYER_DEFS: QuarterLayerDef[] = [
  { layerId: "quarter_polygon", featureKey: "quarter_polygon", label: "Mahalle sınırı", group: "Temel katmanlar", kind: "line" },
  { layerId: "centroid_point", featureKey: "center", label: "Mahalle merkezi", group: "Temel katmanlar", kind: "circle" },
  { layerId: "boundary_polygon", featureKey: "boundary", label: "Yapı sınırı", group: "Temel katmanlar", kind: "line" },
  { layerId: "quarter_slope_polygons", featureKey: "quarter_slope", label: "Mahalle eğimi", group: "Temel katmanlar", kind: "fillSlope" },

  { layerId: "clipped_roads_multilinestring", featureKey: "road", label: "Mahalle yolları", group: "Hatlar", kind: "line" },
  { layerId: "clipped_electric_multilinestring", featureKey: "electric", label: "Yüksek gerilim", group: "Hatlar", kind: "line" },
  { layerId: "clipped_railway_multilinestring", featureKey: "railway", label: "Demiryolları", group: "Hatlar", kind: "line" },
  { layerId: "clipped_waterway_multilinestring", featureKey: "waterway", label: "Nehir hatları", group: "Hatlar", kind: "line" },

  { layerId: "clipped_sit_polygon", featureKey: "sit", label: "Sit alanları", group: "Koruma alanı", kind: "fill" },
  { layerId: "city_sulakkoruma_polygon", featureKey: "sulakkoruma", label: "Sulak koruma", group: "Koruma alanı", kind: "fill" },
  { layerId: "clipped_millpark_polygon", featureKey: "millipark", label: "Milli parklar", group: "Koruma alanı", kind: "fill" },
  { layerId: "water_polygon", featureKey: "water", label: "Göller", group: "Koruma alanı", kind: "fill" },

  { layerId: "clipped_see_polygon", featureKey: "see", label: "Deniz manzarası", group: "Manzara", kind: "fill" },
  { layerId: "View_PRIMARY", featureKey: "view_primary", label: "Birincil manzara", group: "Manzara", kind: "fill" },
  { layerId: "View_R1", featureKey: "view_r1", label: "İkincil manzara", group: "Manzara", kind: "fill" },

  { layerId: "grid_multipolygon", featureKey: "grid", label: "Satış noktaları (ızgara)", group: "Noktalar", kind: "gridFill" },
];

/** Web LAYER_CONFIG paint özeti (RN Mapbox style objesine yakın) */
export const LAYER_PAINT: Record<
  string,
  {
    line?: { lineColor: string; lineWidth?: number; lineOpacity?: number };
    fill?: { fillColor: string; fillOpacity?: number };
    circle?: { circleColor: string; circleRadius?: number; circleOpacity?: number };
  }
> = {
  quarter_polygon: { line: { lineColor: "#60a5fa", lineWidth: 3, lineOpacity: 0.9 } },
  clipped_roads_multilinestring: { line: { lineColor: "#ff6b35", lineWidth: 3, lineOpacity: 0.8 } },
  clipped_waterway_multilinestring: { line: { lineColor: "#40E0D0", lineWidth: 4, lineOpacity: 0.8 } },
  clipped_electric_multilinestring: { line: { lineColor: "#FFD700", lineWidth: 3, lineOpacity: 0.9 } },
  clipped_railway_multilinestring: { line: { lineColor: "#C084FC", lineWidth: 4, lineOpacity: 0.9 } },
  clipped_sit_polygon: { fill: { fillColor: "#795548", fillOpacity: 0.4 } },
  city_sulakkoruma_polygon: { fill: { fillColor: "#00BCD4", fillOpacity: 0.3 } },
  clipped_millpark_polygon: { fill: { fillColor: "#4CAF50", fillOpacity: 0.4 } },
  water_polygon: { fill: { fillColor: "#2196F3", fillOpacity: 0.5 } },
  boundary_polygon: { line: { lineColor: "#FF5722", lineWidth: 2, lineOpacity: 0.8 } },
  centroid_point: { circle: { circleColor: "#E91E63", circleRadius: 8, circleOpacity: 0.9 } },
  quarter_slope_polygons: { fill: { fillColor: "#94a3b8", fillOpacity: 0.38 } },
  grid_multipolygon: { fill: { fillColor: "#888888", fillOpacity: 0.3 } },
  clipped_see_polygon: { fill: { fillColor: "#00BCD4", fillOpacity: 0.35 } },
  View_PRIMARY: { fill: { fillColor: "#8BC34A", fillOpacity: 0.4 } },
  View_R1: { fill: { fillColor: "#CDDC39", fillOpacity: 0.4 } },
};

/**
 * Web `renderLayer` ile aynı: Geometry veya Feature(Collection) → haritaya verilebilir GeoJSON.
 */
export function normalizeQuarterLayerGeoJson(raw: unknown): object | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (data.type === "FeatureCollection" || data.type === "Feature") return data as object;
  const t = String(data.type ?? "");
  if (
    t.includes("Polygon") ||
    t.includes("LineString") ||
    t.includes("Point") ||
    t.includes("MultiPolygon") ||
    t.includes("MultiLineString") ||
    t.includes("MultiPoint") ||
    t === "GeometryCollection"
  ) {
    return { type: "Feature", properties: {}, geometry: data };
  }
  return null;
}

export function buildInitialLayerVisibility(
  features: Record<string, boolean> | undefined,
  layers: Record<string, unknown> | undefined
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const def of QUARTER_LAYER_DEFS) {
    next[def.layerId] = false;
  }
  const hasQuarter =
    features?.quarter_polygon === true && layers?.quarter_polygon != null;
  if (hasQuarter) {
    next.quarter_polygon = true;
  }
  return next;
}
