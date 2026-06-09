import type { VrLatLon } from "../types/vrParcelPayload";

const EARTH_RADIUS_M = 6378137;

/** WGS84 lat/lon farkını origin etrafında east/north metre cinsine çevirir. */
export function latLonToLocalMetres(
  point: VrLatLon,
  origin: VrLatLon,
): { east: number; north: number } {
  const latRad = (origin.lat * Math.PI) / 180;
  const dLat = point.lat - origin.lat;
  const dLon = point.lon - origin.lon;
  const north = dLat * ((Math.PI / 180) * EARTH_RADIUS_M);
  const east = dLon * ((Math.PI / 180) * EARTH_RADIUS_M * Math.cos(latRad));
  return { east, north };
}

/** Unity X=east, Z=north, Y=0 */
export function localMetresToUnityXZ(east: number, north: number): { x: number; y: number; z: number } {
  return { x: east, y: 0, z: north };
}
