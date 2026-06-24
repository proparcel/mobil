/**
 * Share Handler — tasarımlı ekran görüntüsü + portal paylaşım linki.
 */

import React from 'react';
import { Alert } from 'react-native';
import {
  getCombinedImageDimensions,
  shareImage,
  shareImageWithText,
  cleanupTempFiles,
} from '../screenshotManager';
import type { CombinedScreenshotCaptureRef } from '../../../components/app/CombinedScreenshotContainer';
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
import type { MapOverlayViewport } from '../../maps/drawing/mapOverlayViewport';
import type { ShapeProperties } from '../../maps/drawing/types';
import type { PreviewSnapCacheEntry } from '../captureSnapCache';
import { capturePerfMark, capturePerfSince, capturePerfStart } from '../capturePerf';

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
  cameraRef?: React.RefObject<any>;
  camRef?: React.RefObject<{ pitch?: number; zoom?: number; heading?: number }>;
  combinedContainerRef: React.RefObject<CombinedScreenshotCaptureRef | null>;
  mapReadyRef: React.MutableRefObject<import('../mapboxSnapshot').MapReadyState>;
  isSharingRef: React.MutableRefObject<boolean>;
  isProgrammaticMoveRef?: React.MutableRefObject<boolean>;
  programmaticTimerRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setIsProcessingShare: (processing: boolean) => void;
  setCapturedMapUri: (uri: string | null) => void;
  setCapturedModalUri: (uri: string | null) => void;
  setShareModalVisible: (visible: boolean) => void;
  parcelDesign?: ParcelPolygonDesignConfig | null;
  mapViewport?: MapOverlayViewport;
  shapes?: ShapeProperties[];
  bumpOverlayLayout?: () => void;
  prefetchedShareLinkRef?: React.MutableRefObject<Promise<string | null> | null>;
  previewSnapCacheRef?: React.MutableRefObject<PreviewSnapCacheEntry | null>;
  getCameraFingerprint?: () => string;
  hasActiveParcel?: boolean;
  /** Ana sayfa ekran görüntüsü önizlemesinden paylaşım */
  fromScreenshotPreview?: boolean;
  mapContainerRef?: React.RefObject<import('react-native').View | null>;
  getPreviewMapFrameInWindow?: () => import('../screenshotPreviewLayout').ScreenshotPreviewMapFrame | null;
}

export const createShareHandler = (params: ShareHandlerParams) => {
  return async () => {
    const {
      parcelData,
      mapRef,
      cameraRef,
      camRef,
      combinedContainerRef,
      mapReadyRef,
      isSharingRef,
      isProgrammaticMoveRef,
      programmaticTimerRef,
      setIsProcessingShare,
      setCapturedMapUri,
      setCapturedModalUri,
      setShareModalVisible,
      parcelDesign,
      mapViewport,
      shapes,
      bumpOverlayLayout,
      prefetchedShareLinkRef,
      previewSnapCacheRef,
      getCameraFingerprint,
      hasActiveParcel = Boolean(parcelData),
      fromScreenshotPreview = false,
      mapContainerRef,
      getPreviewMapFrameInWindow,
    } = params;

    setIsProcessingShare(true);
    isSharingRef.current = true;
    let mapUri: string | null = null;
    let combinedUri: string | null = null;

    capturePerfStart();

    try {
      const dimensions = getCombinedImageDimensions();

      const prefetched = prefetchedShareLinkRef?.current;
      if (prefetchedShareLinkRef) {
        prefetchedShareLinkRef.current = null;
      }
      const shareLinkPromise = parcelData
        ? prefetched ?? resolveParcelShareMessageUrlForShare(parcelData)
        : Promise.resolve(null);

      capturePerfMark('capture:map');
      const captureResult = await captureParcelShareMapUri({
        parcelData,
        mapRef,
        cameraRef,
        camRef,
        mapReadyRef,
        dimensions,
        parcelDesign,
        mapViewport,
        shapes,
        bumpOverlayLayout,
        getCameraFingerprint,
        previewSnapCacheRef,
        isProgrammaticMoveRef,
        programmaticTimerRef,
        fromScreenshotPreview,
        mapContainerRef,
        getPreviewMapFrameInWindow,
      });
      capturePerfSince('capture:map:done', 'capture:map');

      if (!captureResult?.mapUri) {
        throw new Error('Harita görüntüsü alınamadı');
      }

      mapUri = captureResult.mapUri;
      const { overlay, sourceViewport, mapCropNorm } = captureResult;
      const mapOnly = !hasActiveParcel;
      const skipCombinedViewShot = mapOnly && !overlay;

      setCapturedMapUri(mapUri);

      capturePerfMark('capture:combined');
      const [combinedUriResult, queryLink] = await Promise.all([
        skipCombinedViewShot
          ? Promise.resolve(mapUri)
          : captureCombinedScreenshotUri(combinedContainerRef, mapUri, {
              overlay,
              sourceViewport,
              mapCropNorm,
              mapOnly,
              skipViewShot: false,
            }),
        shareLinkPromise,
      ]);
      combinedUri = combinedUriResult;
      capturePerfSince('capture:combined:done', 'capture:combined');

      const shareText = formatParcelShareMessage(queryLink);

      if (!shareText && parcelData && hasActiveParcel) {
        Alert.alert(
          'Paylaşım linki hazır değil',
          'Ada/parsel bilgisi bulunamadı. Lütfen önce parsel sorgulayıp tekrar deneyin.',
        );
        setShareModalVisible(false);
        return;
      }

      if (!combinedUri) {
        throw new Error('Paylaşılacak görüntü bulunamadı');
      }

      capturePerfMark('capture:share');
      const shareResult = shareText
        ? await shareImageWithText(combinedUri, shareText)
        : await shareImage(combinedUri).then((success) => ({ success, linkText: null }));
      capturePerfSince('capture:share:done', 'capture:share');
      capturePerfSince('capture:total:done', 'capture:map');

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

      if (previewSnapCacheRef?.current?.mapUri === mapUri) {
        previewSnapCacheRef.current = null;
      }

      await cleanupTempFiles([mapUri, combinedUri]);
      isSharingRef.current = false;
      setIsProcessingShare(false);
    }
  };
};
