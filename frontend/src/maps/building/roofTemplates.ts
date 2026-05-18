/**
 * Web building-roof-templates.js ile aynı çatı şablonları ve GeoJSON üretimi (Mapbox 2D).
 */

import type { Feature, FeatureCollection, Geometry } from "geojson";

export type RoofTemplateKey = "flat_roof" | "pitched_roof" | "house_gable_roof" | "terrace_pergola_roof";

export type LngLat = { lng: number; lat: number };

export type BuildingRoofFootprint = {
  id: string;
  coordinates: LngLat[];
  baseHeight?: number;
  buildingHeight: number;
  floors?: number;
};

export type RoofTemplateConfig = {
  parapetHeight: number;
  roofThickness: number;
  ridgeHeight: number;
  overhang: number;
  terraceInset: number;
  pergolaHeight: number;
  pergolaSpacing: number;
  materialColor: string;
  accentColor: string;
  /** Ev çatısı: iki yamaç rengi (üstten ayrım) */
  slopeColorA?: string;
  slopeColorB?: string;
};

export const ROOF_TEMPLATE_CONFIGS: Record<RoofTemplateKey, RoofTemplateConfig> = {
  flat_roof: {
    parapetHeight: 0.9,
    roofThickness: 0.25,
    ridgeHeight: 0,
    overhang: 0,
    terraceInset: 0,
    pergolaHeight: 0,
    pergolaSpacing: 0,
    materialColor: "#70757a",
    accentColor: "#4f5459",
  },
  pitched_roof: {
    parapetHeight: 0.15,
    roofThickness: 0.28,
    ridgeHeight: 2.4,
    overhang: 0.35,
    terraceInset: 0,
    pergolaHeight: 0,
    pergolaSpacing: 0,
    materialColor: "#8b5e3c",
    accentColor: "#5e3d27",
  },
  house_gable_roof: {
    parapetHeight: 0.25,
    roofThickness: 0.32,
    ridgeHeight: 4.1,
    overhang: 0.45,
    terraceInset: 0,
    pergolaHeight: 0,
    pergolaSpacing: 0,
    materialColor: "#c45c2d",
    accentColor: "#6b2f12",
    slopeColorA: "#c65d32",
    slopeColorB: "#9a4524",
  },
  terrace_pergola_roof: {
    parapetHeight: 1.05,
    roofThickness: 0.25,
    ridgeHeight: 0,
    overhang: 0,
    terraceInset: 1.5,
    pergolaHeight: 2.8,
    pergolaSpacing: 1.6,
    materialColor: "#666b70",
    accentColor: "#2f3134",
  },
};

export function normalizeRoofTemplate(v: string | undefined | null): RoofTemplateKey {
  if (
    v === "pitched_roof" ||
    v === "house_gable_roof" ||
    v === "terrace_pergola_roof" ||
    v === "flat_roof"
  )
    return v;
  return "flat_roof";
}

export const ROOF_TEMPLATE_OPTIONS: Array<{ label: string; value: RoofTemplateKey; description?: string }> = [
  { label: "Düz çatı", value: "flat_roof", description: "Plaza, residence, modern yapı" },
  { label: "Eğimli çatı", value: "pitched_roof", description: "Hafif eğim / endüstriyel" },
  { label: "Ev çatısı (kırma)", value: "house_gable_roof", description: "Klasik kiremit, iki yamaç + mahya" },
  { label: "Teras + pergola", value: "terrace_pergola_roof", description: "Çatı terası" },
];

function pointsCloseLngLat(a: LngLat, b: LngLat, eps = 1e-9): boolean {
  return Math.abs(a.lng - b.lng) < eps && Math.abs(a.lat - b.lat) < eps;
}

function ensureClosedPolygon(coords: LngLat[]): LngLat[] {
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (pointsCloseLngLat(first, last)) return coords;
  return [...coords, first];
}

function getPolygonCentroid(coords: LngLat[]): LngLat {
  const closed = ensureClosedPolygon(coords);
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const p1 = closed[i];
    const p2 = closed[i + 1];
    const f = p1.lng * p2.lat - p2.lng * p1.lat;
    area += f;
    cx += (p1.lng + p2.lng) * f;
    cy += (p1.lat + p2.lat) * f;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-12) {
    const avgLng = coords.reduce((s, p) => s + p.lng, 0) / coords.length;
    const avgLat = coords.reduce((s, p) => s + p.lat, 0) / coords.length;
    return { lng: avgLng, lat: avgLat };
  }
  cx /= 6 * area;
  cy /= 6 * area;
  return { lng: cx, lat: cy };
}

function metersToLng(meters: number, lat: number): number {
  const metersPerDegree = 111320 * Math.cos((lat * Math.PI) / 180);
  return meters / metersPerDegree;
}

function metersToLat(meters: number): number {
  return meters / 110540;
}

function offsetPointApprox(p: LngLat, dxMeters: number, dyMeters: number): LngLat {
  return {
    lng: p.lng + metersToLng(dxMeters, p.lat),
    lat: p.lat + metersToLat(dyMeters),
  };
}

function getBoundingBox(coords: LngLat[]) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const p of coords) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

function getLongAxisDirection(coords: LngLat[]): "x" | "y" {
  const bbox = getBoundingBox(coords);
  const dx = bbox.maxLng - bbox.minLng;
  const dy = bbox.maxLat - bbox.minLat;
  return dx >= dy ? "x" : "y";
}

function insetPolygonApprox(coords: LngLat[], insetMeters: number): LngLat[] {
  const centroid = getPolygonCentroid(coords);
  return coords.map((p) => {
    const dx = p.lng - centroid.lng;
    const dy = p.lat - centroid.lat;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const shrinkLng = metersToLng(insetMeters, p.lat);
    const shrinkLat = metersToLat(insetMeters);
    return {
      lng: p.lng - (dx / length) * shrinkLng,
      lat: p.lat - (dy / length) * shrinkLat,
    };
  });
}

function openRingVertices(coords: LngLat[]): LngLat[] {
  const closed = ensureClosedPolygon(coords);
  if (closed.length < 2) return [];
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (pointsCloseLngLat(first, last)) {
    return closed.slice(0, -1);
  }
  return closed.slice();
}

function midPoint(a: LngLat, b: LngLat): LngLat {
  return { lng: (a.lng + b.lng) / 2, lat: (a.lat + b.lat) / 2 };
}

function distMetersHaversine(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const dφ = ((b.lat - a.lat) * Math.PI) / 180;
  const dλ = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dφ / 2) * Math.sin(dφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) * Math.sin(dλ / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function buildGableSplitFromQuadFootprint(p: LngLat[]): {
  ridgeStart: LngLat;
  ridgeEnd: LngLat;
  slopePolygons: LngLat[][];
} {
  const L01 = distMetersHaversine(p[0], p[1]);
  const L12 = distMetersHaversine(p[1], p[2]);
  const L23 = distMetersHaversine(p[2], p[3]);
  const L30 = distMetersHaversine(p[3], p[0]);
  const avg02 = (L01 + L23) / 2;
  const avg13 = (L12 + L30) / 2;
  let ridgeStart: LngLat;
  let ridgeEnd: LngLat;
  let trapA: LngLat[];
  let trapB: LngLat[];
  if (avg02 >= avg13) {
    const m12 = midPoint(p[1], p[2]);
    const m30 = midPoint(p[3], p[0]);
    ridgeStart = m12;
    ridgeEnd = m30;
    trapA = ensureClosedPolygon([p[0], p[1], m12, m30]);
    trapB = ensureClosedPolygon([m30, m12, p[2], p[3]]);
  } else {
    const m01 = midPoint(p[0], p[1]);
    const m23 = midPoint(p[2], p[3]);
    ridgeStart = m01;
    ridgeEnd = m23;
    trapA = ensureClosedPolygon([p[1], p[2], m23, m01]);
    trapB = ensureClosedPolygon([m01, m23, p[3], p[0]]);
  }
  return { ridgeStart, ridgeEnd, slopePolygons: [trapA, trapB] };
}

function buildGableSplitTrapezoidsBbox(coords: LngLat[]): {
  ridgeStart: LngLat;
  ridgeEnd: LngLat;
  slopePolygons: LngLat[][];
} {
  const bbox = getBoundingBox(coords);
  const axis = getLongAxisDirection(coords);
  const midLng = (bbox.minLng + bbox.maxLng) / 2;
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  if (axis === "x") {
    const NW = { lng: bbox.minLng, lat: bbox.maxLat };
    const NE = { lng: bbox.maxLng, lat: bbox.maxLat };
    const SW = { lng: bbox.minLng, lat: bbox.minLat };
    const SE = { lng: bbox.maxLng, lat: bbox.minLat };
    const eastMid = { lng: bbox.maxLng, lat: midLat };
    const westMid = { lng: bbox.minLng, lat: midLat };
    return {
      ridgeStart: westMid,
      ridgeEnd: eastMid,
      slopePolygons: [
        ensureClosedPolygon([NW, NE, eastMid, westMid]),
        ensureClosedPolygon([westMid, eastMid, SE, SW]),
      ],
    };
  }
  const NW = { lng: bbox.minLng, lat: bbox.maxLat };
  const NE = { lng: bbox.maxLng, lat: bbox.maxLat };
  const SW = { lng: bbox.minLng, lat: bbox.minLat };
  const SE = { lng: bbox.maxLng, lat: bbox.minLat };
  const northMid = { lng: midLng, lat: bbox.maxLat };
  const southMid = { lng: midLng, lat: bbox.minLat };
  return {
    ridgeStart: southMid,
    ridgeEnd: northMid,
    slopePolygons: [
      ensureClosedPolygon([NW, northMid, southMid, SW]),
      ensureClosedPolygon([northMid, NE, SE, southMid]),
    ],
  };
}

function buildGableSplitTrapezoids(coords: LngLat[]): {
  ridgeStart: LngLat;
  ridgeEnd: LngLat;
  slopePolygons: LngLat[][];
} {
  const open = openRingVertices(coords);
  if (open.length === 4) {
    return buildGableSplitFromQuadFootprint(open);
  }
  return buildGableSplitTrapezoidsBbox(coords);
}

export function ridgeLineFromQuadFootprint(coords: LngLat[]): [LngLat, LngLat] | null {
  const open = openRingVertices(coords);
  if (open.length !== 4) return null;
  const p = open;
  const L01 = distMetersHaversine(p[0], p[1]);
  const L12 = distMetersHaversine(p[1], p[2]);
  const L23 = distMetersHaversine(p[2], p[3]);
  const L30 = distMetersHaversine(p[3], p[0]);
  const avg02 = (L01 + L23) / 2;
  const avg13 = (L12 + L30) / 2;
  if (avg02 >= avg13) {
    return [midPoint(p[1], p[2]), midPoint(p[3], p[0])];
  }
  return [midPoint(p[0], p[1]), midPoint(p[2], p[3])];
}

function lngLatLerp(a: LngLat, b: LngLat, t: number): LngLat {
  return {
    lng: a.lng + (b.lng - a.lng) * t,
    lat: a.lat + (b.lat - a.lat) * t,
  };
}

/** Döndürülmüş dikdörtgen teras: kirişler kısa kenara paralel (web building-roof-templates ile aynı). */
function generatePergolaBeamsOrientedQuad(
  terracePolygon: LngLat[],
  spacingMeters: number
): Array<[LngLat, LngLat]> | null {
  const open = openRingVertices(terracePolygon);
  if (open.length !== 4) return null;
  const p = open;
  const L01 = distMetersHaversine(p[0], p[1]);
  const L12 = distMetersHaversine(p[1], p[2]);
  const L23 = distMetersHaversine(p[2], p[3]);
  const L30 = distMetersHaversine(p[3], p[0]);
  const avg02 = (L01 + L23) / 2;
  const avg13 = (L12 + L30) / 2;
  const beams: Array<[LngLat, LngLat]> = [];
  if (avg02 >= avg13) {
    const longLen = L01;
    const count = Math.max(2, Math.floor(longLen / spacingMeters));
    for (let i = 0; i <= count; i++) {
      const t = count > 0 ? i / count : 0;
      beams.push([lngLatLerp(p[0], p[1], t), lngLatLerp(p[3], p[2], t)]);
    }
  } else {
    const longLen = L12;
    const count = Math.max(2, Math.floor(longLen / spacingMeters));
    for (let i = 0; i <= count; i++) {
      const t = count > 0 ? i / count : 0;
      beams.push([lngLatLerp(p[1], p[2], t), lngLatLerp(p[0], p[3], t)]);
    }
  }
  return beams;
}

function generatePergolaBeams(
  terracePolygon: LngLat[],
  spacingMeters: number
): Array<[LngLat, LngLat]> {
  const oriented = generatePergolaBeamsOrientedQuad(terracePolygon, spacingMeters);
  if (oriented && oriented.length) return oriented;
  const bbox = getBoundingBox(terracePolygon);
  const axis = getLongAxisDirection(terracePolygon);
  const beams: Array<[LngLat, LngLat]> = [];
  if (axis === "x") {
    const centerLat = (bbox.minLat + bbox.maxLat) / 2;
    const totalHeightMeters = (bbox.maxLat - bbox.minLat) * 110540;
    const count = Math.max(2, Math.floor(totalHeightMeters / spacingMeters));
    for (let i = 0; i <= count; i++) {
      const offsetY = -totalHeightMeters / 2 + (i * totalHeightMeters) / count;
      const start = offsetPointApprox({ lng: bbox.minLng, lat: centerLat }, 0, offsetY);
      const end = offsetPointApprox({ lng: bbox.maxLng, lat: centerLat }, 0, offsetY);
      beams.push([start, end]);
    }
  } else {
    const centerLng = (bbox.minLng + bbox.maxLng) / 2;
    const centerLat = (bbox.minLat + bbox.maxLat) / 2;
    const totalWidthMeters =
      (bbox.maxLng - bbox.minLng) * 111320 * Math.cos((centerLat * Math.PI) / 180);
    const count = Math.max(2, Math.floor(totalWidthMeters / spacingMeters));
    for (let i = 0; i <= count; i++) {
      const offsetX = -totalWidthMeters / 2 + (i * totalWidthMeters) / count;
      const start = offsetPointApprox({ lng: centerLng, lat: bbox.minLat }, offsetX, 0);
      const end = offsetPointApprox({ lng: centerLng, lat: bbox.maxLat }, offsetX, 0);
      beams.push([start, end]);
    }
  }
  return beams;
}

export interface RoofGeometryPackage {
  roofPolygon: LngLat[];
  parapetPolygon?: LngLat[];
  terracePolygon?: LngLat[];
  ridgeLine?: [LngLat, LngLat];
  pergolaBeams?: Array<[LngLat, LngLat]>;
  /** Ev çatısı: mahya boyunca ikiye bölünmüş taban trapezleri */
  slopePolygons?: LngLat[][];
  roofBaseHeight: number;
  roofTopHeight: number;
  ridgeTopHeight?: number;
  template: RoofTemplateKey;
}

export function generateRoofGeometry(
  building: BuildingRoofFootprint,
  template: RoofTemplateKey
): RoofGeometryPackage {
  const coords = ensureClosedPolygon(building.coordinates);
  const config = ROOF_TEMPLATE_CONFIGS[template];
  const roofBaseHeight = (building.baseHeight ?? 0) + building.buildingHeight;
  const roofTopHeight = roofBaseHeight + config.roofThickness;

  if (template === "flat_roof") {
    return {
      roofPolygon: coords,
      parapetPolygon: coords,
      roofBaseHeight,
      roofTopHeight,
      template,
    };
  }

  if (template === "house_gable_roof") {
    const split = buildGableSplitTrapezoids(coords);
    return {
      roofPolygon: coords,
      roofBaseHeight,
      roofTopHeight,
      ridgeLine: [split.ridgeStart, split.ridgeEnd],
      ridgeTopHeight: roofTopHeight + config.ridgeHeight,
      slopePolygons: split.slopePolygons,
      template,
    };
  }

  if (template === "pitched_roof") {
    const fromQuad = ridgeLineFromQuadFootprint(coords);
    let ridgeStart: LngLat;
    let ridgeEnd: LngLat;
    if (fromQuad) {
      [ridgeStart, ridgeEnd] = fromQuad;
    } else {
      const axis = getLongAxisDirection(coords);
      const bbox = getBoundingBox(coords);
      if (axis === "x") {
        const midLat = (bbox.minLat + bbox.maxLat) / 2;
        ridgeStart = { lng: bbox.minLng, lat: midLat };
        ridgeEnd = { lng: bbox.maxLng, lat: midLat };
      } else {
        const midLng = (bbox.minLng + bbox.maxLng) / 2;
        ridgeStart = { lng: midLng, lat: bbox.minLat };
        ridgeEnd = { lng: midLng, lat: bbox.maxLat };
      }
    }
    return {
      roofPolygon: coords,
      roofBaseHeight,
      roofTopHeight,
      ridgeLine: [ridgeStart, ridgeEnd],
      ridgeTopHeight: roofTopHeight + config.ridgeHeight,
      template,
    };
  }

  const terracePolygon = insetPolygonApprox(coords.slice(0, -1), config.terraceInset);
  const terraceClosed = ensureClosedPolygon(terracePolygon);
  const pergolaBeams = generatePergolaBeams(terraceClosed, config.pergolaSpacing);
  return {
    roofPolygon: coords,
    parapetPolygon: coords,
    terracePolygon: terraceClosed,
    pergolaBeams,
    roofBaseHeight,
    roofTopHeight,
    template,
  };
}

type GeoJsonFeat = Feature<Geometry, Record<string, unknown>>;

export function generateRoofGeoJSONForMapbox(
  building: BuildingRoofFootprint,
  template: RoofTemplateKey
): FeatureCollection<Geometry, Record<string, unknown>> {
  const geom = generateRoofGeometry(building, template);
  const config = ROOF_TEMPLATE_CONFIGS[template];
  const features: GeoJsonFeat[] = [];

  const parapetTop = geom.roofTopHeight + config.parapetHeight;
  const ridgeZ = geom.ridgeTopHeight ?? geom.roofTopHeight;
  /** Teras üstünde pergola kiriş yüksekliği (yaklaşık) */
  const pergolaZ = geom.roofTopHeight + config.pergolaHeight * 0.55;

  if (template === "house_gable_roof" && geom.slopePolygons && geom.slopePolygons.length === 2) {
    const ca = config.slopeColorA ?? config.materialColor;
    const cb = config.slopeColorB ?? config.materialColor;
    geom.slopePolygons.forEach((ring, idx) => {
      features.push({
        type: "Feature",
        properties: {
          kind: "house_slope",
          template,
          color: idx === 0 ? ca : cb,
          slopeIndex: idx,
          /** Mapbox FillExtrusion: taban ve tavan kotu (m), zemin = 0 */
          extrusionBase: geom.roofBaseHeight,
          extrusionTop: ridgeZ,
        },
        geometry: {
          type: "Polygon",
          coordinates: [ring.map((p) => [p.lng, p.lat])],
        },
      });
    });
  } else {
    features.push({
      type: "Feature",
      properties: {
        kind: "roof_slab",
        template,
        color: config.materialColor,
        extrusionBase: geom.roofBaseHeight,
        extrusionTop: geom.roofTopHeight,
      },
      geometry: {
        type: "Polygon",
        coordinates: [geom.roofPolygon.map((p) => [p.lng, p.lat])],
      },
    });
  }

  if (geom.parapetPolygon) {
    features.push({
      type: "Feature",
      properties: {
        kind: "parapet",
        template,
        color: config.accentColor,
        extrusionBase: geom.roofTopHeight,
        extrusionTop: parapetTop,
      },
      geometry: {
        type: "Polygon",
        coordinates: [geom.parapetPolygon.map((p) => [p.lng, p.lat])],
      },
    });
  }

  if (geom.terracePolygon) {
    features.push({
      type: "Feature",
      properties: {
        kind: "terrace_floor",
        template,
        color: "#b7b0a5",
        extrusionBase: geom.roofBaseHeight,
        extrusionTop: geom.roofTopHeight,
      },
      geometry: {
        type: "Polygon",
        coordinates: [geom.terracePolygon.map((p) => [p.lng, p.lat])],
      },
    });
  }

  if (geom.ridgeLine) {
    features.push({
      type: "Feature",
      properties: {
        kind: "ridge_line",
        template,
        color: config.accentColor,
        lineZ: ridgeZ,
      },
      geometry: {
        type: "LineString",
        coordinates: geom.ridgeLine.map((p) => [p.lng, p.lat]),
      },
    });
  }

  if (geom.pergolaBeams?.length) {
    geom.pergolaBeams.forEach((beam, index) => {
      features.push({
        type: "Feature",
        properties: {
          kind: "pergola_beam",
          template,
          color: "#3b2f25",
          index,
          lineZ: pergolaZ,
        },
        geometry: {
          type: "LineString",
          coordinates: beam.map((p) => [p.lng, p.lat]),
        },
      });
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

/** Ring [[lng,lat],...] → LngLat */
export function ringToLngLat(ring: [number, number][]): LngLat[] {
  return ring.map(([lng, lat]) => ({ lng, lat }));
}

export function mergeBuildingsRoofGeoJSON(
  items: Array<{
    id: string;
    ring: [number, number][];
    heightM: number;
    roofTemplate: string | undefined;
  }>
): FeatureCollection<Geometry, Record<string, unknown>> | null {
  const features: GeoJsonFeat[] = [];
  for (const it of items) {
    const coords = ringToLngLat(it.ring);
    const tmpl = normalizeRoofTemplate(it.roofTemplate);
    const fc = generateRoofGeoJSONForMapbox(
      {
        id: it.id,
        coordinates: coords,
        buildingHeight: it.heightM,
      },
      tmpl
    );
    for (const f of fc.features) {
      features.push({
        ...f,
        properties: { ...f.properties, buildingId: it.id },
      });
    }
  }
  return features.length ? { type: "FeatureCollection", features } : null;
}
