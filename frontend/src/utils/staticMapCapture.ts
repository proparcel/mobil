/**
 * Mapbox Static API ile parsel geometrisinden PNG (mobil takeSnapshot yerine).
 * son-30-gun-detay.tsx ile aynı yaklaşım.
 */

import RNFS from 'react-native-fs';
import { getParcelStaticMapFeatureProps } from '../constants/parcelMapStyle';

let MAPBOX_TOKEN = '';
try {
  const { MAPBOX_ACCESS_TOKEN } = require('../../config/mapbox');
  MAPBOX_TOKEN = MAPBOX_ACCESS_TOKEN || '';
} catch {
  console.warn('[staticMapCapture] Mapbox token yüklenemedi');
}

function calcCenterFromCoords(coords: number[][]): [number, number] | null {
  if (!coords?.length) return null;
  let sumLon = 0;
  let sumLat = 0;
  for (const c of coords) {
    sumLon += c[0];
    sumLat += c[1];
  }
  return [sumLon / coords.length, sumLat / coords.length];
}

function simplifyRing(coords: number[][], tolerance: number): number[][] {
  if (coords.length <= 4) return coords;
  const step = Math.max(1, Math.floor(coords.length * tolerance));
  const out: number[][] = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  if (out.length > 0 && out[0] !== out[out.length - 1]) out.push(out[0]);
  return out;
}

function simplifyGeometry(geom: any, tolerance: number): any {
  if (!geom?.coordinates) return geom;
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: [simplifyRing(geom.coordinates[0], tolerance)] };
  }
  if (geom.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]) {
    return {
      type: 'MultiPolygon',
      coordinates: [[simplifyRing(geom.coordinates[0][0], tolerance)]],
    };
  }
  return geom;
}

/** PNG base64 (data: prefix olmadan) */
export async function fetchStaticMapBase64(geom: any): Promise<string> {
  if (!MAPBOX_TOKEN || !geom) return '';
  try {
    let url = '';
    if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      const [lon, lat] = geom.coordinates;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return '';
      url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},16,0/800x600@2x?access_token=${MAPBOX_TOKEN}`;
    } else {
      const featureProps = getParcelStaticMapFeatureProps(true);
      const feature = { type: 'Feature', properties: featureProps, geometry: geom };
      let encoded = encodeURIComponent(JSON.stringify(feature));
      if (encoded.length > 6000) {
        let resolved = false;
        for (const tol of [0.0003, 0.0006, 0.001, 0.002]) {
          const sg = simplifyGeometry(geom, tol);
          const se = encodeURIComponent(
            JSON.stringify({ type: 'Feature', properties: featureProps, geometry: sg }),
          );
          if (se.length <= 6000) {
            url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${se})/auto/800x600@2x?access_token=${MAPBOX_TOKEN}&padding=60`;
            resolved = true;
            break;
          }
        }
        if (!resolved) {
          const flat =
            geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates?.[0]?.[0];
          const center = calcCenterFromCoords(flat);
          if (!center) return '';
          url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${center[0]},${center[1]},16,0/800x600@2x?access_token=${MAPBOX_TOKEN}`;
        }
      } else {
        url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encoded})/auto/800x600@2x?access_token=${MAPBOX_TOKEN}&padding=60`;
      }
    }
    if (!url) return '';
    const tempPath = `${RNFS.CachesDirectoryPath}/static_map_${Date.now()}.png`;
    const result = await RNFS.downloadFile({ fromUrl: url, toFile: tempPath }).promise;
    if (result.statusCode !== 200) {
      await RNFS.unlink(tempPath).catch(() => {});
      return '';
    }
    const b64 = await RNFS.readFile(tempPath, 'base64');
    await RNFS.unlink(tempPath).catch(() => {});
    return b64;
  } catch (err) {
    console.warn('[staticMapCapture] Hata:', err);
    return '';
  }
}

export function staticMapBase64ToDataUrl(b64: string): string {
  if (!b64) return '';
  return `data:image/png;base64,${b64}`;
}
