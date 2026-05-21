import React, { useRef } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { landingColors, landingRadii } from './landingTheme';

type Props = {
  visibleStep: number;
  contentExiting: boolean;
  overlayExiting: boolean;
  onSkip: () => void;
};

function lineStyle(step: number, visibleStep: number, contentExiting: boolean) {
  const visible = visibleStep >= step && !contentExiting;
  const exiting = contentExiting && visibleStep >= step;
  return {
    opacity: visible ? 1 : exiting ? 0 : 0,
    transform: [{ translateY: visible ? 0 : exiting ? -16 : 32 }],
  };
}

export function LandingIntroCinematic({
  visibleStep,
  contentExiting,
  overlayExiting,
  onSkip,
}: Props) {
  const insets = useSafeAreaInsets();
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const lastTapRef = useRef(0);

  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [visibleStep, contentExiting]);

  React.useEffect(() => {
    if (overlayExiting) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 1100,
        useNativeDriver: true,
      }).start();
    }
  }, [overlayExiting, overlayOpacity]);

  const onPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      onSkip();
    }
    lastTapRef.current = now;
  };

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayOpacity }]}
      pointerEvents={overlayExiting ? 'none' : 'auto'}
    >
      <Pressable style={styles.pressArea} onPress={onPress}>
        <View style={styles.box}>
          <View style={styles.boxGlass} />
          <Text style={[styles.brand, lineStyle(1, visibleStep, contentExiting)]}>PROPARCEL</Text>
          <Text style={[styles.eyebrow, lineStyle(2, visibleStep, contentExiting)]}>
            Yeni üyelere başlangıç hediyesi
          </Text>
          <View style={[styles.creditRow, lineStyle(3, visibleStep, contentExiting)]}>
            <Text style={styles.creditAmount}>100</Text>
            <Text style={styles.creditUnit}>Kredi</Text>
          </View>
          <View style={[styles.rule, lineStyle(3, visibleStep, contentExiting)]} />
          <View style={[styles.badge, lineStyle(4, visibleStep, contentExiting)]}>
            <Text style={styles.badgeText}>BEDAVA</Text>
          </View>
          <Text style={[styles.foot, lineStyle(5, visibleStep, contentExiting)]}>
            Arazi analizlerini ücretsiz deneyin.
          </Text>
        </View>
        <Text style={[styles.skipHint, { bottom: Math.max(20, insets.bottom + 12) }]}>
          Çift dokun — geç
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    backgroundColor: 'rgba(4, 10, 24, 0.55)',
  },
  pressArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: '92%',
    maxWidth: 400,
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 28,
    borderRadius: landingRadii.card,
    overflow: 'hidden',
  },
  boxGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: landingColors.glassBg,
    borderWidth: 1,
    borderColor: landingColors.borderGlass,
    borderRadius: landingRadii.card,
  },
  brand: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
    color: landingColors.text,
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: 'rgba(230, 245, 255, 0.76)',
    marginBottom: 12,
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  creditAmount: {
    fontSize: 52,
    fontWeight: '900',
    color: landingColors.cyanBright,
  },
  creditUnit: {
    fontSize: 26,
    fontWeight: '800',
    color: landingColors.text,
  },
  rule: {
    width: 180,
    height: 2,
    marginVertical: 14,
    borderRadius: 999,
    backgroundColor: landingColors.cyan,
    opacity: 0.85,
  },
  badge: {
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: landingRadii.pill,
    backgroundColor: landingColors.teal,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#031426',
  },
  foot: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '500',
    color: landingColors.textMuted,
    textAlign: 'center',
  },
  skipHint: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(231, 241, 255, 0.45)',
  },
});
