/**
 * Offscreen tasarımlı paylaşım şablonu — mount/unmount stabil kalmalı (ViewShot).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CombinedScreenshotContainer } from './CombinedScreenshotContainer';

type Props = {
  visible: boolean;
  capturedMapUri: string | null;
  parcelData: any;
  isProMode?: boolean;
  priceOverride?: { unitPrice?: number | null; totalPrice?: number | null } | null;
  containerRef: React.RefObject<{ capture?: () => Promise<string> } | null>;
};

export default function DesignedParcelShareHost({
  visible,
  capturedMapUri,
  parcelData,
  isProMode = true,
  priceOverride = null,
  containerRef,
}: Props) {
  if (!visible || !parcelData) return null;

  return (
    <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
      <CombinedScreenshotContainer
        ref={containerRef}
        capturedMapUri={capturedMapUri}
        parcelData={parcelData}
        isProMode={isProMode}
        priceOverride={priceOverride}
        mapOnly={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -10000,
    top: 0,
    opacity: 1,
  },
});
