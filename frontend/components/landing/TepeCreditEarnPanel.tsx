import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GiftRewardItem } from '../../services/creditService';
import { useAuth } from '../../screens/contexts/AuthContext';
import { fetchCreditBalance } from '../../src/services/modelPurchaseService';
import { TepeCreditBalanceCard } from './TepeCreditBalanceCard';
import { TepeCreditEarnListSection } from './TepeCreditEarnListSection';
import { LandingNewPlatformBadge } from './LandingNewPlatformBadge';
import { TepeCreditTopBar } from './TepeCreditTopBar';
import { tepeCreditColors } from './tepeCreditTheme';
import { LANDING_BOTTOM_CHROME } from './landingTheme';

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_MIN_H = Math.round(SCREEN_H * 0.28);
const BOTTOM_NAV_SPACE = LANDING_BOTTOM_CHROME;

type Props = {
  reveal: boolean;
  onBack: () => void;
  onHelp: () => void;
  onBuyCredit: () => void;
  onSeeAllMissions: () => void;
  onEarnItemPress: (item: GiftRewardItem) => void;
};

export function TepeCreditEarnPanel({
  reveal,
  onBack,
  onHelp,
  onBuyCredit,
  onSeeAllMissions,
  onEarnItemPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  const loadBalance = useCallback(async () => {
    if (!isAuthenticated) {
      setBalance(null);
      return;
    }
    try {
      const res = await fetchCreditBalance();
      setBalance(res.balance ?? 0);
    } catch {
      setBalance(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useEffect(() => {
    if (!reveal) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [reveal, fade, slide]);

  return (
    <View style={styles.page}>
      <TepeCreditTopBar onBack={onBack} onHelp={onHelp} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: reveal ? fade : 0,
            transform: [{ translateY: reveal ? slide : 20 }],
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: BOTTOM_NAV_SPACE + insets.bottom + 24,
          }}
        >
          <View style={[styles.hero, { minHeight: HERO_MIN_H }]}>
            <LandingNewPlatformBadge />
            <Text style={styles.heroTitle}>Tepe Kredi</Text>
            <Text style={styles.heroAccent}>Kazanım Şansları</Text>
            <Text style={styles.heroSub}>Öner, paylaş, değerlendir — Tepe Kredi kazan.</Text>
          </View>

          <TepeCreditBalanceCard balance={balance} onBuyCredit={onBuyCredit} />

          <TepeCreditEarnListSection
            onEarnPress={onEarnItemPress}
            onSeeAllEarn={onSeeAllMissions}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    justifyContent: 'flex-start',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: tepeCreditColors.text,
    lineHeight: 38,
  },
  heroAccent: {
    fontSize: 32,
    fontWeight: '800',
    color: tepeCreditColors.cyanBright,
    lineHeight: 38,
    marginBottom: 10,
    textShadowColor: 'rgba(57, 223, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    color: tepeCreditColors.textMuted,
  },
});
