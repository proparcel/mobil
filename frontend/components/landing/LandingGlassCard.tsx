import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { landingColors, landingRadii } from './landingTheme';

let BlurView: React.ComponentType<{ style?: ViewStyle; blurType?: string; blurAmount?: number; reducedTransparencyFallbackColor?: string }> | null = null;
try {
  BlurView = require('@react-native-community/blur').BlurView;
} catch {
  BlurView = null;
}

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  glow?: boolean;
};

export function LandingGlassCard({ children, style, glow }: Props) {
  const inner = (
    <View style={[styles.inner, glow && styles.glow]}>
      {children}
    </View>
  );

  if (BlurView && Platform.OS === 'ios') {
    return (
      <View style={[styles.wrap, style]}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="dark"
          blurAmount={14}
          reducedTransparencyFallbackColor={landingColors.glassBg}
        />
        <View style={styles.tint} />
        {inner}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.androidGlass, style]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: landingRadii.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: landingColors.borderGlass,
  },
  androidGlass: {
    backgroundColor: landingColors.glassBgLight,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 26, 55, 0.35)',
  },
  inner: {
    padding: 18,
  },
  glow: {
    shadowColor: landingColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
});
