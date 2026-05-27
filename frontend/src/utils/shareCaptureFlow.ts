/**
 * Paylaşım görseli yakalama — hızlı yol: Mapbox Static, yedek: canlı harita snapshot.
 */

import type { MutableRefObject, RefObject } from 'react';
import RNFS from 'react-native-fs';
import { waitForMapIdle, tryMapboxSnap, type MapReadyState } from './mapboxSnapshot';
import { fetchStaticMapBase64 } from './staticMapCapture';
import type { ParcelPolygonDesignConfig } from '../constants/parcelPolygonDesign';

export async function staticMapGeometryToFileUri(
  geometry: { type: string; coordinates: unknown },
  parcelDesign?: ParcelPolygonDesignConfig | null,
): Promise<string | null> {
  const b64 = await fetchStaticMapBase64(geometry, parcelDesign);
  if (!b64) return null;
  const path = `${RNFS.CachesDirectoryPath}/share-map-${Date.now()}.png`;
  await RNFS.writeFile(path, b64, 'base64');
  return `file://${path}`;
}

function parcelDataToGeometry(parcelData: any): { type: string; coordinates: unknown } | null {
  const g = parcelData?.geometry;
  if (!g?.type || !g?.coordinates) return null;
  if (g.type === 'Polygon' || g.type === 'MultiPolygon' || g.type === 'Point') {
    return g;
  }
  return null;
}

/** Harita PNG — önce static API (~1 sn), olmazsa kısa idle + takeSnapshot. */
export async function captureParcelShareMapUri(options: {
  parcelData: any;
  mapRef?: RefObject<any>;
  mapReadyRef?: MutableRefObject<MapReadyState>;
  dimensions: { mapWidth: number; mapHeight: number };
  parcelDesign?: ParcelPolygonDesignConfig | null;
}): Promise<string | null> {
  const { parcelData, mapRef, mapReadyRef, dimensions, parcelDesign } = options;

  const geom = parcelDataToGeometry(parcelData);
  if (geom) {
    const staticUri = await staticMapGeometryToFileUri(geom, parcelDesign);
    if (staticUri) return staticUri;
  }

  if (!mapRef?.current || !mapReadyRef) return null;

  let retries = 0;
  while (!mapRef.current && retries < 8) {
    await new Promise((r) => setTimeout(r, 50));
    retries += 1;
  }
  if (!mapRef.current) return null;

  await waitForMapIdle(mapReadyRef, 1800, { resetIfAlreadyIdle: false });
  return tryMapboxSnap(mapRef, dimensions);
}

/** ViewShot hazır olana kadar kısa bekleme. */
export async function waitForCombinedCaptureRef(
  combinedContainerRef: RefObject<{ capture?: () => Promise<string> } | null>,
  maxMs = 1200,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (combinedContainerRef.current?.capture) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return Boolean(combinedContainerRef.current?.capture);
}

export async function captureCombinedScreenshotUri(
  combinedContainerRef: RefObject<{ capture?: () => Promise<string> } | null>,
  mapUri: string | null,
): Promise<string> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise((r) => setTimeout(r, mapUri ? 80 : 40));

  const ready = await waitForCombinedCaptureRef(combinedContainerRef);
  if (!ready || !combinedContainerRef.current?.capture) {
    throw new Error('Paylaşım şablonu hazır değil');
  }

  const uri = await combinedContainerRef.current.capture();
  if (!uri) throw new Error('Görüntü oluşturulamadı');
  return uri;
}
