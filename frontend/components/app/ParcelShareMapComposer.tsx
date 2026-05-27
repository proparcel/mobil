/**
 * Paylaşım görseli — uydu harita + poligon ortasında ada/parsel, alan, fiyat.
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';

export const PARCEL_SHARE_MAP_WIDTH = 800;
export const PARCEL_SHARE_MAP_HEIGHT = 600;

type Props = {
  mapUri: string;
  lines: string[];
};

function ParcelShareMapFrame({ mapUri, lines }: Props) {
  const visibleLines = lines.filter((l) => String(l ?? '').trim().length > 0);
  return (
    <View style={styles.frame}>
      <Image source={{ uri: mapUri }} style={styles.map} resizeMode="cover" />
      {visibleLines.length > 0 ? (
        <View style={styles.labelWrap} pointerEvents="none">
          <View style={styles.labelBox}>
            {visibleLines.map((line, index) => (
              <Text key={`${index}-${line}`} style={styles.labelLine} numberOfLines={2}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export const ParcelShareMapComposer = React.forwardRef<ViewShot, Props>(function ParcelShareMapComposer(
  { mapUri, lines },
  ref,
) {
  return (
    <ViewShot
      ref={ref}
      options={{ format: 'png', quality: 1, result: 'tmpfile' }}
      style={styles.shot}
      collapsable={false}
    >
      <ParcelShareMapFrame mapUri={mapUri} lines={lines} />
    </ViewShot>
  );
});

const styles = StyleSheet.create({
  shot: {
    width: PARCEL_SHARE_MAP_WIDTH,
    height: PARCEL_SHARE_MAP_HEIGHT,
    backgroundColor: '#0f172a',
  },
  frame: {
    width: PARCEL_SHARE_MAP_WIDTH,
    height: PARCEL_SHARE_MAP_HEIGHT,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBox: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(8, 17, 32, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(54, 170, 255, 0.45)',
    alignItems: 'center',
  },
  labelLine: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
