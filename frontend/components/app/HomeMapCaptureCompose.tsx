/**
 * Ana sayfa paylaşım yakalama — Mapbox snapshot + ekran overlay'leri (çizim, metin kutusu, iğne, ok).
 */

import React, { useCallback, useRef } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import ViewShot from 'react-native-view-shot';
import Svg, { Polyline } from 'react-native-svg';
import { TextBoxMapMarker } from '@/src/maps/drawing/TextBoxMapMarker';
import { MapPinMarker } from '@/src/maps/drawing/MapPinMarker';
import { MapCaptureVectorOverlay } from '@/src/maps/drawing/MapCaptureVectorOverlay';
import type { MapOverlayCapturePayload } from '@/src/utils/mapOverlayCaptureProjection';

export type HomeMapCaptureComposeProps = {
  capturedMapUri: string | null;
  width: number;
  height: number;
  overlay: MapOverlayCapturePayload | null;
};

export const HomeMapCaptureCompose = React.forwardRef<any, HomeMapCaptureComposeProps>(
  ({ capturedMapUri, width, height, overlay }, ref) => {
    if (!width || !height) return null;

    const mapLoadedResolveRef = useRef<(() => void) | null>(null);
    const onMapImageLoadEnd = useCallback(() => {
      mapLoadedResolveRef.current?.();
      mapLoadedResolveRef.current = null;
    }, []);

    const screenShapes = overlay?.screenSpaceShapes ?? [];

    return (
      <ViewShot
        ref={ref}
        options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
        style={[styles.offscreen, { width, height }]}
      >
        <View style={[styles.container, { width, height }]}>
          {capturedMapUri ? (
            <Image
              source={{ uri: capturedMapUri }}
              fadeDuration={0}
              onLoadEnd={onMapImageLoadEnd}
              onError={onMapImageLoadEnd}
              style={[styles.image, { width, height }]}
              resizeMode="cover"
            />
          ) : null}

          {screenShapes.length > 0 ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                style={StyleSheet.absoluteFill}
              >
                {screenShapes.map((shape) => {
                  const coords = (shape.geometry as GeoJSON.LineString).coordinates as [
                    number,
                    number,
                  ][];
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
            </View>
          ) : null}

          {overlay?.vectorItems && overlay.vectorItems.length > 0 ? (
            <MapCaptureVectorOverlay
              width={width}
              height={height}
              items={overlay.vectorItems}
            />
          ) : null}

          {overlay?.textBoxes.map(({ shape, x, y, hitWidth, hitHeight }) => (
            <View
              key={`tb-${shape.id}`}
              pointerEvents="none"
              style={[
                styles.pointItem,
                {
                  left: x - hitWidth / 2,
                  top: y - hitHeight / 2,
                  minWidth: hitWidth,
                  minHeight: hitHeight,
                },
              ]}
            >
              <TextBoxMapMarker shape={shape} selected={false} />
            </View>
          ))}

          {overlay?.pins.map(({ shape, x, y, hitWidth, hitHeight }) => (
            <View
              key={`pin-${shape.id}`}
              pointerEvents="none"
              style={[
                styles.pinItem,
                {
                  left: x - hitWidth / 2,
                  top: y - hitHeight,
                  width: hitWidth,
                  height: hitHeight,
                },
              ]}
            >
              <MapPinMarker shape={shape} selected={false} />
            </View>
          ))}

          <View style={styles.badge}>
            <Text style={styles.badgeText}>PROPARCEL</Text>
          </View>
        </View>
      </ViewShot>
    );
  },
);

HomeMapCaptureCompose.displayName = 'HomeMapCaptureCompose';

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -10000,
    top: -10000,
    opacity: 0,
    pointerEvents: 'none',
  },
  container: {
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pointItem: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinItem: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
