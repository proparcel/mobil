/**
 * Harita snapshot — mapCropNorm ile overflow clip (native kırpma yok).
 */

import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { MapCropNorm } from '../../src/utils/mapViewShotCapture';

type Props = {
  uri: string;
  width: number;
  height: number;
  sourceViewport?: { width: number; height: number } | null;
  mapCropNorm?: MapCropNorm | null;
  onLoadEnd?: () => void;
  onError?: () => void;
};

export function MapCaptureClippedImage({
  uri,
  width,
  height,
  sourceViewport,
  mapCropNorm,
  onLoadEnd,
  onError,
}: Props) {
  const clipStyle = useMemo(() => {
    const srcW = sourceViewport?.width && sourceViewport.width > 1 ? sourceViewport.width : width;
    const srcH = sourceViewport?.height && sourceViewport.height > 1 ? sourceViewport.height : height;

    if (!mapCropNorm || mapCropNorm.width <= 0 || mapCropNorm.height <= 0) {
      return null;
    }

    const cropW = mapCropNorm.width * srcW;
    const cropH = mapCropNorm.height * srcH;
    if (cropW <= 0 || cropH <= 0) return null;

    const scale = Math.max(width / cropW, height / cropH);
    const displayW = srcW * scale;
    const displayH = srcH * scale;
    const left = -mapCropNorm.x * srcW * scale;
    const top = -mapCropNorm.y * srcH * scale;

    return { displayW, displayH, left, top };
  }, [sourceViewport?.width, sourceViewport?.height, width, height, mapCropNorm]);

  if (clipStyle) {
    return (
      <View style={[styles.clipHost, { width, height }]}>
        <Image
          source={{ uri }}
          fadeDuration={0}
          onLoadEnd={onLoadEnd}
          onError={onError}
          style={{
            position: 'absolute',
            width: clipStyle.displayW,
            height: clipStyle.displayH,
            left: clipStyle.left,
            top: clipStyle.top,
          }}
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      fadeDuration={0}
      onLoadEnd={onLoadEnd}
      onError={onError}
      style={{ width, height, resizeMode: 'cover' }}
    />
  );
}

const styles = StyleSheet.create({
  clipHost: {
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
});
