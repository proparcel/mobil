/**
 * Harita görüntüsü üzerine capture anı overlay'leri (çizim, metin kutusu, iğne, ok).
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { TextBoxMapMarker } from '@/src/maps/drawing/TextBoxMapMarker';
import { MapPinMarker } from '@/src/maps/drawing/MapPinMarker';
import { MapCaptureVectorOverlay } from '@/src/maps/drawing/MapCaptureVectorOverlay';
import type { MapOverlayCapturePayload } from '@/src/utils/mapOverlayCaptureProjection';
import type { MapCropNorm } from '@/src/utils/mapViewShotCapture';
import {
  computeCaptureOverlayTransform,
  transformCapturePoint,
} from '@/src/utils/mapCaptureOverlayTransform';

type Props = {
  overlay: MapOverlayCapturePayload | null | undefined;
  width: number;
  height: number;
  /** Projeksiyon viewport'u (snap / ekran harita alanı) */
  sourceViewport?: { width: number; height: number } | null;
  /** Önizleme çerçevesi kırpması — MapCaptureClippedImage ile aynı dönüşüm */
  mapCropNorm?: MapCropNorm | null;
};

export function MapCaptureOverlayOnMap({
  overlay,
  width,
  height,
  sourceViewport,
  mapCropNorm,
}: Props) {
  const cover = useMemo(() => {
    const srcW = sourceViewport?.width && sourceViewport.width > 1 ? sourceViewport.width : width;
    const srcH = sourceViewport?.height && sourceViewport.height > 1 ? sourceViewport.height : height;
    return computeCaptureOverlayTransform(srcW, srcH, width, height, mapCropNorm);
  }, [sourceViewport?.width, sourceViewport?.height, width, height, mapCropNorm]);

  if (!overlay || !width || !height) return null;

  const screenShapes = overlay.screenSpaceShapes ?? [];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {screenShapes.length > 0 ? (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          {screenShapes.map((shape) => {
            const coords = (shape.geometry as GeoJSON.LineString).coordinates as [number, number][];
            if (!coords?.length) return null;
            const stroke = shape.outlineColor || '#2563eb';
            const sw = shape.outlineWidth || 3;
            const normStroke = Math.max(0.0025, Math.min(0.04, 0.0035 * sw));
            return (
              <Polyline
                key={shape.id}
                points={coords.map(([nx, ny]) => `${nx},${ny}`).join(' ')}
                fill="none"
                stroke={stroke}
                strokeWidth={normStroke}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </Svg>
      ) : null}

      {overlay.vectorItems.length > 0 ? (
        <MapCaptureVectorOverlay
          width={width}
          height={height}
          items={overlay.vectorItems}
          viewBoxWidth={sourceViewport?.width}
          viewBoxHeight={sourceViewport?.height}
        />
      ) : null}

      {overlay.textBoxes.map(({ shape, x, y, hitWidth, hitHeight }) => {
        const p = transformCapturePoint(x, y, cover);
        const w = hitWidth * cover.scale;
        const h = hitHeight * cover.scale;
        return (
          <View
            key={`tb-${shape.id}`}
            style={[
              styles.pointItemCenter,
              {
                left: p.x - w / 2,
                top: p.y - h / 2,
                minWidth: w,
                minHeight: h,
              },
            ]}
          >
            <TextBoxMapMarker shape={shape} selected={false} />
          </View>
        );
      })}

      {overlay.pins.map(({ shape, x, y, hitWidth, hitHeight }) => {
        const p = transformCapturePoint(x, y, cover);
        const w = hitWidth * cover.scale;
        const h = hitHeight * cover.scale;
        return (
          <View
            key={`pin-${shape.id}`}
            style={[
              styles.pinItem,
              {
                left: p.x - w / 2,
                top: p.y - h,
                width: w,
                height: h,
              },
            ]}
          >
            <MapPinMarker shape={shape} selected={false} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pointItemCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** PinMapOverlay ile aynı: uç nokta (lng/lat) iğnenin alt ucunda */
  pinItem: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
