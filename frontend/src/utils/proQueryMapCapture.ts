/**
 * Pro sorgu sonrası harita görüntüsü — önce Mapbox Static API (parsel çizgili), gerekirse MapView snapshot.
 */

import type { MutableRefObject, RefObject } from 'react';
import RNFS from 'react-native-fs';
import { getCombinedImageDimensions } from './screenshotManager';
import { waitForMapIdle, tryMapboxSnap, type MapReadyState } from './mapboxSnapshot';
import { uploadQueryMapImage } from '../../services/queryMapImageService';
import {
  fetchStaticMapBase64,
  staticMapBase64ToDataUrl,
} from './staticMapCapture';
import {
  extractProQueryIdentifiers,
  resolveDfaSnapshotId,
  type ProQueryIdentifiers,
} from './proQueryApi';

export function extractDfaSnapshotId(data: any): number | null {
  const pd = data?.parameters_data || {};
  const raw = pd.dfa_snapshot_id ?? data?.dfa_snapshot_id ?? data?.snapshot_id ?? null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type CaptureProQueryMapParams = {
  mapRef: RefObject<any>;
  mapReadyRef: MutableRefObject<MapReadyState>;
  combinedContainerRef: RefObject<any>;
  setCapturedMapUri: (uri: string | null) => void;
  data: any;
  normalizedGeometry: any | null;
  snapshotId?: number | null;
  identifiers?: ProQueryIdentifiers;
};

async function uriToDataUrl(uri: string): Promise<string> {
  const path = uri.replace(/^file:\/\//, '');
  const b64 = await RNFS.readFile(path, 'base64');
  return `data:image/png;base64,${b64}`;
}

async function uploadMapImageDataUrl(
  imageDataUrl: string,
  snapshotId: number | null,
  identifiers: ProQueryIdentifiers,
): Promise<boolean> {
  const uploadRes = await uploadQueryMapImage({
    image: imageDataUrl,
    ...(snapshotId != null
      ? { snapshot_id: snapshotId }
      : {
          proparcel_value: identifiers.proparcel_value ?? null,
          ada: identifiers.ada,
          parsel: identifiers.parsel,
        }),
  });
  if (!uploadRes.ok) {
    console.warn('[proQueryMapCapture] Upload hatası:', uploadRes.error);
    return false;
  }
  console.log('[proQueryMapCapture] Harita görüntüsü yüklendi');
  return true;
}

/**
 * Static harita (tercih) + isteğe bağlı Mapbox snapshot yedek.
 */
export async function captureAndUploadProQueryMapImage(
  params: CaptureProQueryMapParams,
): Promise<boolean> {
  let snapshotId = params.snapshotId ?? extractDfaSnapshotId(params.data);
  const identifiers = params.identifiers || extractProQueryIdentifiers(params.data);

  if (!snapshotId && (!identifiers.proparcel_value || !identifiers.parsel)) {
    console.warn('[proQueryMapCapture] snapshot_id veya (proparcel_value, parsel) eksik');
    return false;
  }

  if (!snapshotId) {
    snapshotId = await resolveDfaSnapshotId(params.data, identifiers);
  }

  if (params.normalizedGeometry) {
    const b64 = await fetchStaticMapBase64(params.normalizedGeometry);
    if (b64) {
      const ok = await uploadMapImageDataUrl(
        staticMapBase64ToDataUrl(b64),
        snapshotId,
        identifiers,
      );
      if (ok) return true;
      console.warn('[proQueryMapCapture] Static map upload başarısız, MapView snapshot deneniyor');
    } else {
      console.warn('[proQueryMapCapture] Static map PNG alınamadı, MapView snapshot deneniyor');
    }
  }

  try {
    const dimensions = getCombinedImageDimensions();
    if (!params.mapRef.current) {
      let retries = 0;
      while (!params.mapRef.current && retries < 25) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
      }
    }

    params.mapReadyRef.current.isIdle = false;
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await waitForMapIdle(params.mapReadyRef, 8000);
    await new Promise((r) => setTimeout(r, 400));

    const mapUri = await tryMapboxSnap(params.mapRef, dimensions);
    params.setCapturedMapUri(mapUri || null);

    let uploadUri = mapUri;
    if (mapUri && params.combinedContainerRef.current?.capture) {
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      await new Promise((r) => setTimeout(r, mapUri ? 350 : 150));
      try {
        const combinedUri = await params.combinedContainerRef.current.capture();
        if (combinedUri) uploadUri = combinedUri;
      } catch (e) {
        console.warn('[proQueryMapCapture] Combined capture başarısız:', e);
      }
    }

    if (!uploadUri) {
      console.warn('[proQueryMapCapture] MapView snapshot yok');
      return false;
    }

    const imageDataUrl = await uriToDataUrl(uploadUri);
    return uploadMapImageDataUrl(imageDataUrl, snapshotId, identifiers);
  } catch (e) {
    console.warn('[proQueryMapCapture] MapView yakalama/yükleme exception:', e);
    return false;
  } finally {
    params.setCapturedMapUri(null);
  }
}
