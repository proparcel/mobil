import area from '@turf/area';
import bbox from '@turf/bbox';
import { feature } from '@turf/helpers';
import type { FeatureCollection, Geometry, Point, Polygon, Position } from 'geojson';
import type { ParcelFillPatternId } from '../constants/parcelPolygonDesign';
import {
  getPatternGlyph,
  getPatternGridSpacingDeg,
  getPatternMapTextSize,
} from '../constants/parcelPolygonDesign';

function ringContainsPoint(ring: Position[], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const denom = yj - yi;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (Math.abs(denom) < 1e-12 ? 1e-12 : denom) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lng: number, lat: number, geometry: Geometry): boolean {
  if (geometry.type === 'Polygon') {
    const poly = geometry as Polygon;
    if (!poly.coordinates[0]?.length) return false;
    if (!ringContainsPoint(poly.coordinates[0], lng, lat)) return false;
    for (let h = 1; h < poly.coordinates.length; h++) {
      if (ringContainsPoint(poly.coordinates[h], lng, lat)) return false;
    }
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polyCoords) => {
      const poly: Polygon = { type: 'Polygon', coordinates: polyCoords };
      return pointInGeometry(lng, lat, poly);
    });
  }
  return false;
}

/** Çarpık parsellerde bbox ızgarasını sıklaştır */
function spacingForGeometry(geometry: Geometry, patternSizeScale: number): number {
  let spacingDeg = getPatternGridSpacingDeg(patternSizeScale);
  try {
    const f = feature(geometry);
    const polyArea = Math.max(area(f), 1);
    const b = bbox(f);
    const latMid = (b[1] + b[3]) / 2;
    const cosLat = Math.max(0.25, Math.cos((latMid * Math.PI) / 180));
    const widthM = (b[2] - b[0]) * 111320 * cosLat;
    const heightM = (b[3] - b[1]) * 110540;
    const bboxAreaM2 = Math.max(widthM * heightM, 1);
    const coverage = polyArea / bboxAreaM2;
    if (coverage < 0.62) spacingDeg *= 0.82;
    if (coverage < 0.42) spacingDeg *= 0.72;
  } catch {
    /* varsayılan aralık */
  }
  return spacingDeg;
}

/**
 * Parsel içi desen ızgarası.
 * Merkez noktası parsel içindeyse glif eklenir; taşan kısımlar üstteki kenar çizgisiyle maskelenir.
 */
export function buildParcelPatternPointCollection(
  geometry: Geometry | null | undefined,
  patternId: ParcelFillPatternId,
  patternSizeScale = 1
): FeatureCollection<Point> {
  const glyph = getPatternGlyph(patternId);
  if (!geometry || patternId === 'none' || !glyph) {
    return { type: 'FeatureCollection', features: [] };
  }

  let minLng: number;
  let minLat: number;
  let maxLng: number;
  let maxLat: number;
  try {
    const b = bbox(feature(geometry));
    [minLng, minLat, maxLng, maxLat] = b;
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }

  const latMid = (minLat + maxLat) / 2;
  const spacingDeg = spacingForGeometry(geometry, patternSizeScale);
  const textSize = getPatternMapTextSize(patternSizeScale);
  const cosLat = Math.max(0.25, Math.cos((latMid * Math.PI) / 180));
  const stepLng = spacingDeg / cosLat;

  const features: FeatureCollection<Point>['features'] = [];
  let row = 0;

  for (let lat = minLat; lat <= maxLat + spacingDeg * 0.25; lat += spacingDeg) {
    const lngShift = (row % 2) * (stepLng * 0.5);
    for (let lng = minLng - lngShift; lng <= maxLng + stepLng; lng += stepLng) {
      if (!pointInGeometry(lng, lat, geometry)) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { glyph, textSize },
      });
    }
    row += 1;
  }

  return { type: 'FeatureCollection', features };
}
