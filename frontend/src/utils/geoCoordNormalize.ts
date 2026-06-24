/**
 * TR parsel koordinatları için [lat, lon] → [lon, lat] swap gerekir mi?
 * Mapbox GeoJSON [lon, lat] bekler. TKGM bazen [lat, lon] döner; pro sorgu backend'i swap_latlon ile düzeltir.
 */
export function shouldSwapLatLonForTurkey(x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const inLatBand = (v: number) => v >= 35 && v <= 43;
  const inLonBand = (v: number) => v >= 25 && v <= 46;

  const xLat = inLatBand(x);
  const xLon = inLonBand(x);
  const yLat = inLatBand(y);
  const yLon = inLonBand(y);

  if (xLon && !xLat && yLat) return false;
  if (xLat && yLon && !yLat) return true;

  if (xLat && yLon && yLat) {
    if (x > y && y < 42) return true;
    if (y > x && x < 42) return false;
    if (x >= 42 && x > y && yLat) return false;
    if (y >= 42 && y > x && xLat) return true;
  }

  return false;
}

function swapCoords(coords: any): any {
  if (!Array.isArray(coords)) return coords;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return [coords[1], coords[0], ...coords.slice(2)];
  }
  return coords.map(swapCoords);
}

function getFirstCoordinatePair(geometry: any): [number, number] | null {
  if (!geometry?.coordinates) return null;
  try {
    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0]?.[0])) {
      return geometry.coordinates[0][0];
    }
    if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates?.[0]?.[0]?.[0])) {
      return geometry.coordinates[0][0][0];
    }
    if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
      return [geometry.coordinates[0], geometry.coordinates[1]];
    }
    if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates?.[0])) {
      return geometry.coordinates[0];
    }
  } catch {
    return null;
  }
  return null;
}

/** GeoJSON koordinatlarını normalize et: [lat, lon] -> [lon, lat] */
export function normalizeGeometryCoordinates(geometry: any): any {
  if (!geometry || !geometry.coordinates) return geometry;

  const first = getFirstCoordinatePair(geometry);
  if (!first || typeof first[0] !== 'number' || typeof first[1] !== 'number') return geometry;

  const [x, y] = first;
  if (!shouldSwapLatLonForTurkey(x, y)) return geometry;

  return { ...geometry, coordinates: swapCoords(geometry.coordinates) };
}
