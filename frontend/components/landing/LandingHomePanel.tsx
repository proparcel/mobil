import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LandingFeatureGrid } from './LandingFeatureGrid';
import type { LandingCapabilityId } from './landingCapabilities';
import { LandingGiftCard } from './LandingGiftCard';
import { LandingPartnerBanner } from './LandingPartnerBanner';
import { LandingNewPlatformBadge } from './LandingNewPlatformBadge';
import { LandingTopBar } from './LandingTopBar';
import { landingColors, LANDING_BOTTOM_CHROME } from './landingTheme';

const BOTTOM_NAV_SPACE = LANDING_BOTTOM_CHROME;

type Props = {
  reveal: boolean;
  onMenuPress: () => void;
  onNotificationsPress: () => void;
  onSignUp: () => void;
  onPartnerDetails: () => void;
  onFeaturePress: (id: LandingCapabilityId) => void;
};

export function LandingHomePanel({
  reveal,
  onMenuPress,
  onNotificationsPress,
  onSignUp,
  onPartnerDetails,
  onFeaturePress,
}: Props) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!reveal) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, [reveal, fade, slide]);

  return (
    <View style={styles.page}>
      <LandingTopBar onMenuPress={onMenuPress} onNotificationsPress={onNotificationsPress} />

      <Animated.View
        style={{
          flex: 1,
          opacity: reveal ? fade : 0,
          transform: [{ translateY: reveal ? slide : 24 }],
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: BOTTOM_NAV_SPACE + insets.bottom + 24,
          }}
        >
          <View style={styles.hero}>
            <LandingNewPlatformBadge />
            <Text style={styles.heroTitle}>Arazi Yatırımının</Text>
            <Text style={styles.heroTitleGradient}>Yeni Platformu</Text>
            <Text style={styles.heroSub}>
              Araziyi keşfet, analiz et, böl ve yatırım kararını tek platformda ver.
            </Text>
          </View>

          <LandingGiftCard onSignUp={onSignUp} />
          <LandingFeatureGrid onFeaturePress={onFeaturePress} />
          <LandingPartnerBanner onDetails={onPartnerDetails} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    justifyContent: 'flex-start',
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: landingColors.text,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heroTitleGradient: {
    fontSize: 34,
    fontWeight: '800',
    color: landingColors.cyanBright,
    lineHeight: 40,
    marginBottom: 12,
    textShadowColor: 'rgba(57, 223, 255, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    color: landingColors.textMuted,
    maxWidth: 340,
  },
});
