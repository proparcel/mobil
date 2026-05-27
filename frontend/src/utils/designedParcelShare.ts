/**
 * Tasarımlı parsel paylaşımı (CombinedScreenshotContainer + portal link).
 */

import type { MutableRefObject, RefObject } from 'react';
import RNFS from 'react-native-fs';
import { Share } from 'react-native';
import {
  cleanupTempFiles,
  getCombinedImageDimensions,
  shareImageWithText,
} from './screenshotManager';
import type { MapReadyState } from './mapboxSnapshot';
import { formatParcelShareMessage } from './parcelShareLink';
import {
  captureCombinedScreenshotUri,
  captureParcelShareMapUri,
  staticMapGeometryToFileUri,
} from './shareCaptureFlow';

export type RunDesignedParcelShareParams = {
  parcelData: any;
  shareLink: string;
  combinedContainerRef: RefObject<{ capture?: () => Promise<string> } | null>;
  setCapturedMapUri: (uri: string | null) => void;
  mapRef?: RefObject<any>;
  mapReadyRef?: MutableRefObject<MapReadyState>;
  isSharingRef?: MutableRefObject<boolean>;
  staticMapGeometry?: { type: string; coordinates: unknown } | null;
  isProMode?: boolean;
  priceOverride?: { unitPrice?: number | null; totalPrice?: number | null } | null;
};

/**
 * Harita görüntüsü + CombinedScreenshotContainer yakalayıp paylaşır.
 * `combinedContainerRef` ekranda mount edilmiş olmalı (parcelData + capturedMapUri güncel).
 */
export async function runDesignedParcelShare(params: RunDesignedParcelShareParams): Promise<boolean> {
  const {
    parcelData,
    shareLink,
    combinedContainerRef,
    setCapturedMapUri,
    mapRef,
    mapReadyRef,
    isSharingRef,
    staticMapGeometry,
    isProMode = true,
  } = params;

  if (isSharingRef) isSharingRef.current = true;

  let mapUri: string | null = null;
  let combinedUri: string | null = null;
  let staticMapPath: string | null = null;

  try {
    const dimensions = getCombinedImageDimensions();

    if (staticMapGeometry) {
      mapUri = await staticMapGeometryToFileUri(staticMapGeometry);
      staticMapPath = mapUri?.replace(/^file:\/\//, '') ?? null;
    } else {
      mapUri = await captureParcelShareMapUri({
        parcelData,
        mapRef,
        mapReadyRef,
        dimensions,
      });
    }

    setCapturedMapUri(mapUri || null);
    combinedUri = await captureCombinedScreenshotUri(combinedContainerRef, mapUri);

    const shareText = formatParcelShareMessage(shareLink) ?? shareLink;
    const shareResult = await shareImageWithText(combinedUri, shareText);
    return shareResult.success;
  } catch (error: any) {
    if (error?.message === 'User did not share') return true;
    console.warn('[designedParcelShare] Paylaşım hatası:', error);
    return false;
  } finally {
    setCapturedMapUri(null);
    await cleanupTempFiles([mapUri, combinedUri]);
    if (staticMapPath) {
      await RNFS.unlink(staticMapPath).catch(() => {});
    }
    if (isSharingRef) isSharingRef.current = false;
  }
}

/** Sadece metin (görsel yok). */
export async function shareParcelLinkOnly(shareLink: string): Promise<void> {
  const shareText = formatParcelShareMessage(shareLink) ?? shareLink;
  await Share.share({ message: shareText, title: 'ProParcel' }).catch(() => {});
}
