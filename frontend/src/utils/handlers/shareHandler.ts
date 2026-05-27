/**
 * Share Handler — tasarımlı ekran görüntüsü + portal paylaşım linki.
 */

import React from 'react';
import { Alert, Platform } from 'react-native';
import { getCombinedImageDimensions, shareImage, shareImageWithText, cleanupTempFiles } from '../screenshotManager';
import {
  formatParcelShareMessage,
  resolveParcelShareMessageUrlForShare,
} from '../parcelShareLink';
import {
  captureCombinedScreenshotUri,
  captureParcelShareMapUri,
} from '../shareCaptureFlow';
import { screenshotShareCompleted } from '../../../services/coinEventService';
import type { ParcelPolygonDesignConfig } from '../../constants/parcelPolygonDesign';

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export interface ShareHandlerParams {
  parcelData: any;
  mapRef: React.RefObject<any>;
  combinedContainerRef: React.RefObject<{ capture?: () => Promise<string> } | null>;
  mapReadyRef: React.MutableRefObject<import('../mapboxSnapshot').MapReadyState>;
  isSharingRef: React.MutableRefObject<boolean>;
  setIsProcessingShare: (processing: boolean) => void;
  setCapturedMapUri: (uri: string | null) => void;
  setCapturedModalUri: (uri: string | null) => void;
  setShareModalVisible: (visible: boolean) => void;
  parcelDesign?: ParcelPolygonDesignConfig | null;
}

export const createShareHandler = (params: ShareHandlerParams) => {
  return async () => {
    const {
      parcelData,
      mapRef,
      combinedContainerRef,
      mapReadyRef,
      isSharingRef,
      setIsProcessingShare,
      setCapturedMapUri,
      setCapturedModalUri,
      setShareModalVisible,
      parcelDesign,
    } = params;

    setIsProcessingShare(true);
    isSharingRef.current = true;
    let mapUri: string | null = null;
    let combinedUri: string | null = null;

    try {
      const dimensions = getCombinedImageDimensions();

      const shareLinkPromise = parcelData
        ? resolveParcelShareMessageUrlForShare(parcelData)
        : Promise.resolve(null);

      mapUri = await captureParcelShareMapUri({
        parcelData,
        mapRef,
        mapReadyRef,
        dimensions,
        parcelDesign,
      });

      setCapturedMapUri(mapUri || null);

      const [combinedUriResult, queryLink] = await Promise.all([
        captureCombinedScreenshotUri(combinedContainerRef, mapUri),
        shareLinkPromise,
      ]);
      combinedUri = combinedUriResult;

      const shareText = formatParcelShareMessage(queryLink);

      if (!combinedUri) {
        throw new Error('Paylaşılacak görüntü bulunamadı');
      }

      const shareResult = shareText
        ? await shareImageWithText(combinedUri, shareText)
        : await shareImage(combinedUri).then((success) => ({ success, linkText: null }));

      if (!shareResult.success) {
        setShareModalVisible(false);
        return;
      }

      setShareModalVisible(false);

      try {
        const parcelId = parcelData?.id != null ? String(parcelData.id) : undefined;
        const share_hash = hashString(`${combinedUri}|${shareText || ''}|${parcelId || ''}`);
        await screenshotShareCompleted({
          share_hash,
          parcel_id: parcelId,
          price_text: shareText || undefined,
        });
      } catch {
        /* coin event — paylaşımı bloklama */
      }
    } catch (error: any) {
      if (error?.message === 'User did not share' || error?.message?.includes('iptal')) {
        setShareModalVisible(false);
        return;
      }
      console.error('[shareHandler] Paylaşma hatası:', error);
      Alert.alert('Hata', error.message || 'Görüntü paylaşılırken bir hata oluştu.');
    } finally {
      setCapturedMapUri(null);
      setCapturedModalUri(null);
      await cleanupTempFiles([mapUri, combinedUri]);
      isSharingRef.current = false;
      setIsProcessingShare(false);
    }
  };
};
