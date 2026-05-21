import React, { useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { LANDING_HERO_BG_URI, landingColors } from './landingTheme';

type Props = {
  children: React.ReactNode;
  dimmed?: boolean;
};

export function LandingHeroBackground({ children, dimmed }: Props) {
  const [bgFailed, setBgFailed] = useState(false);

  return (
    <View style={styles.root}>
      {!bgFailed ? (
        <ImageBackground
          source={{ uri: LANDING_HERO_BG_URI }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setBgFailed(true)}
        >
          <View style={[styles.overlay, dimmed && styles.overlayDimmed]} />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback, dimmed && styles.overlayDimmed]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: landingColors.bgDeep,
  },
  fallback: {
    backgroundColor: landingColors.bgDeep,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 12, 28, 0.42)',
  },
  overlayDimmed: {
    backgroundColor: 'rgba(4, 12, 28, 0.58)',
  },
});
