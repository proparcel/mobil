/**
 * Web: building-window-frames.js ile aynı şablon anahtarları ve parametreler.
 */

import type { Feature, FeatureCollection, Point, Polygon } from "geojson";

export type BuildingFrameTemplateKey = "none" | "minimal_frame" | "grid_panel" | "soft_luxury";

export type FrameTemplateConfig = {
  frameThickness: number;
  verticalSpacing: number;
  horizontalSpacing: number;
  glassInset: number;
  cornerRadius: number;
  darkTint: boolean;
  luxuryOffset: number;
};

export const FRAME_TEMPLATE_CONFIGS: Record<Exclude<BuildingFrameTemplateKey, "none">, FrameTemplateConfig> = {
  minimal_frame: {
    frameThickness: 0.18,
    verticalSpacing: 4,
    horizontalSpacing: 3,
    glassInset: 0.25,
    cornerRadius: 0,
    darkTint: true,
    luxuryOffset: 0,
  },
  grid_panel: {
    frameThickness: 0.28,
    verticalSpacing: 2.8,
    horizontalSpacing: 2.5,
    glassInset: 0.15,
    cornerRadius: 0,
    darkTint: false,
    luxuryOffset: 0,
  },
  soft_luxury: {
    frameThickness: 0.22,
    verticalSpacing: 5.5,
    horizontalSpacing: 4.5,
    glassInset: 0.35,
    cornerRadius: 0.4,
    darkTint: true,
    luxuryOffset: 0.5,
  },
};

export const BUILDING_TEMPLATE_OPTIONS: Array<{ label: string; value: BuildingFrameTemplateKey }> = [
  { label: "Yok", value: "none" },
  { label: "Modern Minimal", value: "minimal_frame" },
  { label: "Grid Panel", value: "grid_panel" },
  { label: "Soft Luxury", value: "soft_luxury" },
];

function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR;
  const dLon = (lon2 - lon1) * toR;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const toR = Math.PI / 180;
  const φ1 = lat1 * toR;
  const φ2 = lat2 * toR;
  const Δλ = (lon2 - lon1) * toR;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function destinationLonLat(lon: number, lat: number, distM: number, bearing: number): [number, number] {
  const R = 6371000;
  const br = (bearing * Math.PI) / 180;
  const δ = distM / R;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(br);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(br) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  return [(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI];
}

function alongEdge(lon1: number, lat1: number, lon2: number, lat2: number, distM: number): [number, number] {
  const len = haversineMeters(lon1, lat1, lon2, lat2);
  if (len < 0.01) return [lon1, lat1];
  const t = Math.max(0, Math.min(1, distM / len));
  return [lon1 + t * (lon2 - lon1), lat1 + t * (lat2 - lat1)];
}

const MAX_POINTS = 400;

function eastNorthMetersToLonLat(lon: number, lat: number, dEast: number, dNorth: number): [number, number] {
  const latOut = lat + dNorth / 110540;
  const lonOut = lon + dEast / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lonOut, latOut];
}

/**
 * Üstten görünüm: cephe boyunca genişlik × derinlik dikdörtgen (web’deki kutu izdüşümü).
 */
function windowFootprintRing(lon: number, lat: number, bearDeg: number, winW: number, depthM: number): [number, number][] {
  const B = (bearDeg * Math.PI) / 180;
  const O = ((bearDeg + 90) * Math.PI) / 180;
  const ae = Math.sin(B);
  const an = Math.cos(B);
  const oe = Math.sin(O);
  const on = Math.cos(O);
  const hw = winW / 2;
  const hd = depthM / 2;
  const signs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const corners: [number, number][] = [];
  for (const [sa, so] of signs) {
    const dEast = sa * hw * ae + so * hd * oe;
    const dNorth = sa * hw * an + so * hd * on;
    corners.push(eastNorthMetersToLonLat(lon, lat, dEast, dNorth));
  }
  corners.push(corners[0]);
  return corners;
}

export type WindowFrameMapStyle = {
  glassColor?: string;
  borderColor?: string;
};

/**
 * Haritada FillLayer + LineLayer ile gösterilecek pencere dikdörtgenleri (üstten görünüm).
 */
export function generateWindowFramePolygonsFeatureCollection(
  ringLonLat: [number, number][],
  buildingHeightM: number,
  floorHeightM: number,
  floors: number,
  templateKey: BuildingFrameTemplateKey,
  style?: WindowFrameMapStyle
): FeatureCollection<Polygon> | null {
  if (!templateKey || templateKey === "none" || ringLonLat.length < 3) return null;
  const cfg = FRAME_TEMPLATE_CONFIGS[templateKey as Exclude<BuildingFrameTemplateKey, "none">];
  if (!cfg) return null;

  const hSp = Math.max(0.5, cfg.horizontalSpacing);
  const ft = Math.max(0.05, cfg.frameThickness);
  const lux = cfg.luxuryOffset || 0;
  const depth = Math.max(0.05, cfg.glassInset);
  const winW = Math.max(0.2, hSp - ft);

  const glassColor = style?.glassColor?.trim() || "#475569";
  const borderColor = style?.borderColor?.trim() || "#0f172a";

  const closed: [number, number][] = [...ringLonLat];
  const a0 = closed[0];
  const al = closed[closed.length - 1];
  if (a0[0] !== al[0] || a0[1] !== al[1]) closed.push([a0[0], a0[1]]);

  const features: Feature<Polygon>[] = [];
  let n = 0;

  for (let e = 0; e < closed.length - 1 && n < MAX_POINTS; e++) {
    const a = closed[e];
    const b = closed[e + 1];
    const edgeLen = haversineMeters(a[0], a[1], b[0], b[1]);
    const bear = bearingDeg(a[0], a[1], b[0], b[1]);
    const outwardBear = bear + 90;
    const panelCount = Math.max(1, Math.floor(edgeLen / hSp));
    const margin = Math.max(0, (edgeLen - panelCount * hSp) / 2);

    for (let p = 0; p < panelCount && n < MAX_POINTS; p++) {
      const along = margin + hSp * p + hSp / 2;
      const [lon0, lat0] = alongEdge(a[0], a[1], b[0], b[1], along);
      const [lonC, latC] = destinationLonLat(lon0, lat0, depth / 2 + lux, outwardBear);
      /** Haritada FillExtrusion ile üst üste binmeyi azaltmak için merkezi cephe dışına kaydır */
      const mapPullM = Math.min(0.4, Math.max(0.06, depth * 0.5));
      const [lonMap, latMap] = destinationLonLat(lonC, latC, mapPullM, outwardBear);

      for (let f = 0; f < floors && n < MAX_POINTS; f++) {
        const zMid = f * floorHeightM + floorHeightM / 2;
        if (zMid > buildingHeightM - 0.2) continue;
        const ring = windowFootprintRing(lonMap, latMap, bear, winW, depth);
        features.push({
          type: "Feature",
          properties: {
            kind: "window-frame-polygon",
            z: zMid,
            glassColor,
            borderColor,
          },
          geometry: {
            type: "Polygon",
            coordinates: [ring],
          },
        });
        n++;
      }
    }
  }

  if (!features.length) return null;
  return { type: "FeatureCollection", features };
}

/**
 * @deprecated Haritada poligon kullanın: {@link generateWindowFramePolygonsFeatureCollection}
 */
export function generateWindowFramePointsFeatureCollection(
  ringLonLat: [number, number][],
  buildingHeightM: number,
  floorHeightM: number,
  floors: number,
  templateKey: BuildingFrameTemplateKey
): FeatureCollection<Point> | null {
  if (!templateKey || templateKey === "none" || ringLonLat.length < 3) return null;
  const cfg = FRAME_TEMPLATE_CONFIGS[templateKey as Exclude<BuildingFrameTemplateKey, "none">];
  if (!cfg) return null;

  const hSp = Math.max(0.5, cfg.horizontalSpacing);
  const lux = cfg.luxuryOffset || 0;
  const depth = Math.max(0.05, cfg.glassInset);

  const closed: [number, number][] = [...ringLonLat];
  const a0 = closed[0];
  const al = closed[closed.length - 1];
  if (a0[0] !== al[0] || a0[1] !== al[1]) closed.push([a0[0], a0[1]]);

  const features: Feature<Point>[] = [];
  let n = 0;

  for (let e = 0; e < closed.length - 1 && n < MAX_POINTS; e++) {
    const a = closed[e];
    const b = closed[e + 1];
    const edgeLen = haversineMeters(a[0], a[1], b[0], b[1]);
    const bear = bearingDeg(a[0], a[1], b[0], b[1]);
    const outwardBear = bear + 90;
    const panelCount = Math.max(1, Math.floor(edgeLen / hSp));
    const margin = Math.max(0, (edgeLen - panelCount * hSp) / 2);

    for (let p = 0; p < panelCount && n < MAX_POINTS; p++) {
      const along = margin + hSp * p + hSp / 2;
      const [lon0, lat0] = alongEdge(a[0], a[1], b[0], b[1], along);
      const [lonC, latC] = destinationLonLat(lon0, lat0, depth / 2 + lux, outwardBear);

      for (let f = 0; f < floors && n < MAX_POINTS; f++) {
        const zMid = f * floorHeightM + floorHeightM / 2;
        if (zMid > buildingHeightM - 0.2) continue;
        features.push({
          type: "Feature",
          properties: { kind: "window-frame", z: zMid, dark: cfg.darkTint },
          geometry: { type: "Point", coordinates: [lonC, latC] },
        });
        n++;
      }
    }
  }

  if (!features.length) return null;
  return { type: "FeatureCollection", features };
}
