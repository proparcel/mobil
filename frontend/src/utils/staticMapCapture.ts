/**
 * Mapbox Static API ile parsel geometrisinden PNG (mobil takeSnapshot yerine).
 * son-30-gun-detay.tsx ile aynı yaklaşım.
 */

import RNFS from 'react-native-fs';
import { getParcelStaticMapFeatureProps, type StaticMapRenderPurpose } from '../constants/parcelMapStyle';
import type { ParcelPolygonDesignConfig } from '../constants/parcelPolygonDesign';
import { calculateBoundsAndCamera } from './parcelUtils';

let MAPBOX_TOKEN = '';
try {
  const { MAPBOX_ACCESS_TOKEN } = require('../../config/mapbox');
  MAPBOX_TOKEN = MAPBOX_ACCESS_TOKEN || '';
} catch {
  console.warn('[staticMapCapture] Mapbox token yüklenemedi');
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

function buildStaticMapCenterZoomUrl(
  geom: any,
  size = '800x600@2x',
  paddingPx = 80,
): string {
  const cam = calculateBoundsAndCamera(geom, {
    viewport: { width: 1600, height: 1200 },
    paddingPx,
    minZoom: 2,
    maxZoom: 18,
    bboxMargin: 1.2,
  });
  if (!cam) return '';
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${cam.center[0]},${cam.center[1]},${cam.zoom},0/${size}?access_token=${MAPBOX_TOKEN}`;
}

function buildStaticMapFetchUrl(
  geom: any,
  parcelDesign?: ParcelPolygonDesignConfig | null,
  size = '800x600@2x',
  purpose: StaticMapRenderPurpose = 'thumbnail',
): string {
  if (!MAPBOX_TOKEN || !geom) return '';
  if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
    const [lon, lat] = geom.coordinates;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return '';
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},16,0/${size}?access_token=${MAPBOX_TOKEN}`;
  }
  const featureProps = getParcelStaticMapFeatureProps(true, parcelDesign, purpose);
  const feature = { type: 'Feature', properties: featureProps, geometry: geom };
  let encoded = encodeURIComponent(JSON.stringify(feature));
  if (encoded.length > 6000) {
    for (const tol of [0.0003, 0.0006, 0.001, 0.002, 0.004, 0.008, 0.015]) {
      const sg = simplifyGeometry(geom, tol);
      const se = encodeURIComponent(
        JSON.stringify({ type: 'Feature', properties: featureProps, geometry: sg }),
      );
      if (se.length <= 6000) {
        return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${se})/auto/${size}?access_token=${MAPBOX_TOKEN}&padding=80`;
      }
    }
    const bboxUrl = buildStaticMapCenterZoomUrl(geom, size);
    if (bboxUrl) return bboxUrl;
  }
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encoded})/auto/${size}?access_token=${MAPBOX_TOKEN}&padding=80`;
}

/** Mapbox Static API URL (indirme / önizleme). */
export function buildStaticMapImageUrl(
  geom: any,
  parcelDesign?: ParcelPolygonDesignConfig | null,
  size = '800x600@2x',
  purpose: StaticMapRenderPurpose = 'thumbnail',
): string {
  return buildStaticMapFetchUrl(geom, parcelDesign, size, purpose);
}

/** PNG base64 (data: prefix olmadan) */
export async function fetchStaticMapBase64(
  geom: any,
  parcelDesign?: ParcelPolygonDesignConfig | null,
  purpose: StaticMapRenderPurpose = 'thumbnail',
): Promise<string> {
  if (!MAPBOX_TOKEN || !geom) return '';
  try {
    const url = buildStaticMapFetchUrl(geom, parcelDesign, '800x600@2x', purpose);
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
