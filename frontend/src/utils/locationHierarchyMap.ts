/**
 * Parsel sorgu bottom sheet: il / ilçe / mahalle seçiminde harita odak + sınır çizimi (web ile uyumlu).
 */

import citiesCenter from '../data/cities-center.json';
import {
  fetchCityBoundary,
  fetchQuarterBoundary,
  fetchTownBoundary,
  type GeoJsonGeometry,
} from '../../services/locationBoundaryApi';

export type LocationHierarchyLevel = 'city' | 'town' | 'quarter';

export type LocationHierarchySelection = {
  level: LocationHierarchyLevel;
  cityId: number;
  townId?: number;
  proparcelValue?: number;
};

export type AdminBoundaryLevel = LocationHierarchyLevel;

export const ADMIN_BOUNDARY_STYLES: Record<AdminBoundaryLevel, { stroke: string }> = {
  city: { stroke: '#1976D2' },
  town: { stroke: '#0EA5E9' },
  quarter: { stroke: '#4CAF50' },
};

const MAX_ZOOM_BY_LEVEL: Record<AdminBoundaryLevel, number> = {
  city: 11,
  town: 12,
  quarter: 15,
};

type CityCenterRec = { id: number; lat: number; lon: number };

/** GeoJSON [lon,lat] — sunucu bazen [lat,lon] döndürür; TR bbox ile düzeltir. */
export function normalizeGeometryCoordinates(geometry: GeoJsonGeometry | null | undefined): GeoJsonGeometry | null {
  if (!geometry || !geometry.coordinates) return geometry ?? null;
  let first: [number, number] | null = null;
  try {
    if (geometry.type === 'Polygon' && Array.isArray((geometry.coordinates as any)?.[0]?.[0])) {
      first = (geometry.coordinates as any)[0][0];
    } else if (
      geometry.type === 'MultiPolygon' &&
      Array.isArray((geometry.coordinates as any)?.[0]?.[0]?.[0])
    ) {
      first = (geometry.coordinates as any)[0][0][0];
    } else if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
      first = [geometry.coordinates[0] as number, geometry.coordinates[1] as number];
    }
  } catch {
    /* ignore */
  }
  if (!first || typeof first[0] !== 'number' || typeof first[1] !== 'number') return geometry;
  const [x, y] = first;
  const looksLikeLatLonTR =
    Number.isFinite(x) && Number.isFinite(y) && x >= 35 && x <= 43 && y >= 25 && y <= 46;
  if (!looksLikeLatLonTR) return geometry;
  const swap = (coords: unknown): unknown => {
    if (!Array.isArray(coords)) return coords;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return [coords[1], coords[0], ...coords.slice(2)];
    }
    return coords.map(swap);
  };
  return { ...geometry, coordinates: swap(geometry.coordinates) as GeoJsonGeometry['coordinates'] };
}

function collectRingCoords(geometry: GeoJsonGeometry): [number, number][] {
  const out: [number, number][] = [];
  if (geometry.type === 'Polygon') {
    const ring = (geometry.coordinates as [number, number][][])[0];
    if (ring) out.push(...ring);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates as [number, number][][][]) {
      if (poly?.[0]) out.push(...poly[0]);
    }
  }
  return out;
}

export function cameraFromGeometry(
  geometry: GeoJsonGeometry,
  level: AdminBoundaryLevel,
): { center: [number, number]; zoom: number } | null {
  const coords = collectRingCoords(geometry);
  if (!coords.length) return null;
  let minLon = coords[0][0];
  let maxLon = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const center: [number, number] = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
  const span = Math.max(maxLon - minLon, maxLat - minLat);
  const cap = MAX_ZOOM_BY_LEVEL[level];
  let zoom = 14;
  if (span > 2) zoom = 8;
  else if (span > 0.8) zoom = 9.5;
  else if (span > 0.3) zoom = 10.5;
  else if (span > 0.08) zoom = 12;
  else if (span > 0.02) zoom = 13.5;
  else zoom = 14.5;
  if (level === 'quarter' && zoom < 13.5) zoom = 13.5;
  return { center, zoom: Math.min(cap, zoom) };
}

function cityCenterFallback(cityId: number): { center: [number, number]; zoom: number } | null {
  const rec = (citiesCenter as CityCenterRec[]).find((c) => String(c.id) === String(cityId));
  if (!rec) return null;
  return { center: [rec.lon, rec.lat], zoom: 9.5 };
}

export type LocationBoundaryMapResult = {
  geometry: GeoJsonGeometry | null;
  level: AdminBoundaryLevel;
  center: [number, number] | null;
  zoom: number | null;
};

export async function loadLocationBoundaryForSelection(
  sel: LocationHierarchySelection,
): Promise<LocationBoundaryMapResult> {
  const level = sel.level;

  if (level === 'city') {
    const data = await fetchCityBoundary(sel.cityId);
    const raw = data?.city_geometry ?? null;
    const geometry = raw ? normalizeGeometryCoordinates(raw) : null;
    if (geometry) {
      const cam = cameraFromGeometry(geometry, 'city');
      return { geometry, level: 'city', center: cam?.center ?? null, zoom: cam?.zoom ?? null };
    }
    const fb = cityCenterFallback(sel.cityId);
    return { geometry: null, level: 'city', center: fb?.center ?? null, zoom: fb?.zoom ?? 9.5 };
  }

  if (level === 'town' && sel.townId) {
    const data = await fetchTownBoundary(sel.townId);
    const geometry = data?.geometry ? normalizeGeometryCoordinates(data.geometry) : null;
    if (geometry) {
      const cam = cameraFromGeometry(geometry, 'town');
      return { geometry, level: 'town', center: cam?.center ?? null, zoom: cam?.zoom ?? null };
    }
    const fb = cityCenterFallback(sel.cityId);
    return { geometry: null, level: 'town', center: fb?.center ?? null, zoom: fb?.zoom ?? 10 };
  }

  if (level === 'quarter' && sel.proparcelValue) {
    const data = await fetchQuarterBoundary(sel.proparcelValue);
    const geometry = data?.geometry ? normalizeGeometryCoordinates(data.geometry) : null;
    if (geometry) {
      const cam = cameraFromGeometry(geometry, 'quarter');
      return { geometry, level: 'quarter', center: cam?.center ?? null, zoom: cam?.zoom ?? null };
    }
  }

  return { geometry: null, level, center: null, zoom: null };
}
