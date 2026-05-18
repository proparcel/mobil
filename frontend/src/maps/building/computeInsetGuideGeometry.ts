/**
 * Web building-manager.js drawInsetGuides / drawInsetGuidesBBox ile aynı kılavuz geometrisi.
 * Parsel poligonu varsa: min(çekme) m iç buffer + dış sınır çizgisi; yoksa bbox kenar çizgileri.
 */

import area from "@turf/area";
import buffer from "@turf/buffer";
import { polygon } from "@turf/helpers";
import polygonToLine from "@turf/polygon-to-line";
import rewind from "@turf/rewind";
import type { Feature, LineString, MultiLineString, MultiPolygon, Polygon } from "geojson";

import type { EdgeMeasureData, BBoxInfo } from "../../utils/edgeMeasurementsManager";
import type { BuildingSettings } from "./computeBuildingFootprint";

import type { GeoJSONGeometry } from "../../types/parcelResponse";

const getVal = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

function offsetMetersFromLonLat(lon: number, lat: number, dxEastM: number, dyNorthM: number): [number, number] {
  const lonOut = lon + dxEastM / (111320 * Math.cos((lat * Math.PI) / 180));
  const latOut = lat + dyNorthM / 110540;
  return [lonOut, latOut];
}

/** En büyük alanlı poligonu seç (MultiPolygon parsel). */
function polygonFeatureFromParcelGeometry(geom: GeoJSONGeometry | null | undefined): Feature<Polygon> | null {
  if (!geom) return null;
  if (geom.type === "Polygon" && geom.coordinates?.length) {
    try {
      return polygon(geom.coordinates);
    } catch {
      return null;
    }
  }
  if (geom.type === "MultiPolygon" && geom.coordinates?.length) {
    let best: Feature<Polygon> | null = null;
    let bestA = -1;
    for (const coords of geom.coordinates) {
      try {
        const feat = polygon(coords);
        const a = area(feat);
        if (a > bestA) {
          bestA = a;
          best = feat;
        }
      } catch {
        /* continue */
      }
    }
    return best;
  }
  return null;
}

function lineCoordsFromPolygonBoundary(boundary: Feature<LineString | MultiLineString> | null): [number, number][] | null {
  if (!boundary?.geometry) return null;
  const g = boundary.geometry;
  if (g.type === "LineString" && g.coordinates?.length >= 2) {
    return g.coordinates.map((c) => [c[0], c[1]] as [number, number]);
  }
  if (g.type === "MultiLineString" && g.coordinates?.length) {
    const lines = g.coordinates;
    const longest = lines.reduce((max, line) => (line.length > max.length ? line : max), lines[0]);
    if (longest.length >= 2) {
      return longest.map((c) => [c[0], c[1]] as [number, number]);
    }
  }
  return null;
}

/**
 * BBox tabanlı çekme çizgileri (web drawInsetGuidesBBox).
 */
function insetGuidesFromBbox(edgeData: EdgeMeasureData, settings: BuildingSettings): Feature<MultiLineString> | null {
  const bbox = edgeData.bbox as BBoxInfo | undefined;
  if (!bbox?.center || bbox.center.length < 2) return null;

  const centerLon = bbox.center[0];
  const centerLat = bbox.center[1];
  const widthM = Number(bbox.width_m);
  const heightM = Number(bbox.height_m);
  if (!Number.isFinite(widthM) || !Number.isFinite(heightM) || widthM <= 0 || heightM <= 0) return null;

  const rotationRad = ((bbox.rotation_deg ?? 0) * Math.PI) / 180;
  const cos_r = Math.cos(rotationRad);
  const sin_r = Math.sin(rotationRad);

  const insetTop = getVal(settings.ust);
  const insetBottom = getVal(settings.alt);
  const insetRight = getVal(settings.sag);
  const insetLeft = getVal(settings.sol);

  const halfW = widthM / 2;
  const halfH = heightM / 2;

  const sides: Array<{
    inset: number;
    isVertical: boolean;
    sign: number;
  }> = [
    { inset: insetLeft, isVertical: true, sign: -1 },
    { inset: insetRight, isVertical: true, sign: 1 },
    { inset: insetTop, isVertical: false, sign: 1 },
    { inset: insetBottom, isVertical: false, sign: -1 },
  ];

  const segments: [number, number][][] = [];

  for (const side of sides) {
    if (side.inset <= 0) continue;

    let p1_uv: [number, number];
    let p2_uv: [number, number];

    if (side.isVertical) {
      const u = side.sign * (halfW - side.inset);
      p1_uv = [u, -halfH];
      p2_uv = [u, halfH];
    } else {
      const v = side.sign * (halfH - side.inset);
      p1_uv = [-halfW, v];
      p2_uv = [halfW, v];
    }

    const seg: [number, number][] = [p1_uv, p2_uv].map(([u, v]) => {
      const dx = u * cos_r - v * sin_r;
      const dy = u * sin_r + v * cos_r;
      return offsetMetersFromLonLat(centerLon, centerLat, dx, dy);
    });
    segments.push(seg);
  }

  if (segments.length === 0) return null;

  return {
    type: "Feature",
    properties: { kind: "inset-guide-bbox" },
    geometry: {
      type: "MultiLineString",
      coordinates: segments,
    },
  };
}

/** Çekme yokken kılavuz: parsel dış sınırı (mümkünse gerçek poligon). */
function parcelBoundaryGuideLine(parcelGeometry: GeoJSONGeometry | null | undefined): Feature<LineString> | null {
  const polyFeat = polygonFeatureFromParcelGeometry(parcelGeometry ?? null);
  if (!polyFeat) return null;

  let polygonFeature: Feature<Polygon> = polyFeat;
  try {
    polygonFeature = rewind(polygonFeature, { reverse: true }) as Feature<Polygon>;
  } catch {
    /* */
  }

  let boundary: Feature<LineString | MultiLineString> | null = null;
  try {
    boundary = polygonToLine(polygonFeature) as Feature<LineString | MultiLineString>;
  } catch {
    return null;
  }

  const coords = lineCoordsFromPolygonBoundary(boundary);
  if (!coords || coords.length < 2) return null;

  return {
    type: "Feature",
    properties: { kind: "parcel-guide-outline" },
    geometry: { type: "LineString", coordinates: coords },
  };
}

/** BBox tam dış çerçeve (çekme yok, parsel geometrisi yok veya hatalı). */
function bboxFullOutlineLine(edgeData: EdgeMeasureData): Feature<LineString> | null {
  const bbox = edgeData.bbox as BBoxInfo | undefined;
  if (!bbox?.center || bbox.center.length < 2) return null;

  const widthM = Number(bbox.width_m);
  const heightM = Number(bbox.height_m);
  if (!Number.isFinite(widthM) || !Number.isFinite(heightM) || widthM <= 0 || heightM <= 0) return null;

  const centerLon = bbox.center[0];
  const centerLat = bbox.center[1];
  const rotationRad = ((bbox.rotation_deg ?? 0) * Math.PI) / 180;
  const cos_r = Math.cos(rotationRad);
  const sin_r = Math.sin(rotationRad);
  const halfW = widthM / 2;
  const halfH = heightM / 2;

  const corners: [number, number][] = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
    [-halfW, -halfH],
  ];

  const coordinates = corners.map(([u, v]) => {
    const dx = u * cos_r - v * sin_r;
    const dy = u * sin_r + v * cos_r;
    return offsetMetersFromLonLat(centerLon, centerLat, dx, dy);
  });

  return {
    type: "Feature",
    properties: { kind: "bbox-guide-full" },
    geometry: { type: "LineString", coordinates },
  };
}

/**
 * Parsel geometrisi + çekme ayarlarından web ile aynı kılavuz çizgisi (LineString veya MultiLineString).
 */
export function computeInsetGuideGeometry(
  edgeData: EdgeMeasureData,
  settings: BuildingSettings,
  parcelGeometry: GeoJSONGeometry | null | undefined
): Feature<LineString | MultiLineString> | null {
  const insetTop = getVal(settings.ust);
  const insetBottom = getVal(settings.alt);
  const insetRight = getVal(settings.sag);
  const insetLeft = getVal(settings.sol);

  if (insetTop <= 0 && insetBottom <= 0 && insetRight <= 0 && insetLeft <= 0) {
    return parcelBoundaryGuideLine(parcelGeometry) ?? bboxFullOutlineLine(edgeData);
  }

  const minInset = Math.min(
    insetLeft > 0 ? insetLeft : Infinity,
    insetRight > 0 ? insetRight : Infinity,
    insetTop > 0 ? insetTop : Infinity,
    insetBottom > 0 ? insetBottom : Infinity
  );

  const tryParcelBuffer = (): Feature<LineString> | null => {
    if (!(minInset > 0 && minInset !== Infinity)) return null;

    const polyFeat = polygonFeatureFromParcelGeometry(parcelGeometry ?? null);
    if (!polyFeat) return null;

    let polygonFeature: Feature<Polygon> = polyFeat;
    try {
      polygonFeature = rewind(polygonFeature, { reverse: true }) as Feature<Polygon>;
    } catch {
      /* web: rewind yoksa devam */
    }

    let buffered: Feature<Polygon | MultiPolygon> | null = null;
    try {
      buffered = buffer(polygonFeature, -minInset, { units: "meters" }) as Feature<Polygon | MultiPolygon>;
      if (buffered?.geometry && polygonFeature.geometry) {
        try {
          const a0 = area(polygonFeature);
          const a1 = area(buffered);
          if (Number.isFinite(a0) && Number.isFinite(a1) && a1 > a0 + 1e-6) {
            buffered = buffer(polygonFeature, minInset, { units: "meters" }) as Feature<Polygon | MultiPolygon>;
          }
        } catch {
          /* */
        }
      }
    } catch {
      return null;
    }

    if (!buffered?.geometry) return null;

    let targetPolygon: Feature<Polygon> | null = null;
    if (buffered.geometry.type === "Polygon") {
      targetPolygon = buffered as Feature<Polygon>;
    } else if (buffered.geometry.type === "MultiPolygon") {
      const polys = buffered.geometry.coordinates.map((coords) => polygon(coords));
      targetPolygon = polys.reduce((max, p) => {
        try {
          return area(p) > area(max) ? p : max;
        } catch {
          return max;
        }
      }, polys[0]);
    }

    if (!targetPolygon) return null;

    let insetBoundary: Feature<LineString | MultiLineString> | null = null;
    try {
      insetBoundary = polygonToLine(targetPolygon) as Feature<LineString | MultiLineString>;
    } catch {
      return null;
    }

    const coords = lineCoordsFromPolygonBoundary(insetBoundary);
    if (!coords || coords.length < 2) return null;

    return {
      type: "Feature",
      properties: { kind: "inset-guide-buffer" },
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
    };
  };

  const fromBuffer = tryParcelBuffer();
  if (fromBuffer) return fromBuffer;

  return insetGuidesFromBbox(edgeData, settings);
}
