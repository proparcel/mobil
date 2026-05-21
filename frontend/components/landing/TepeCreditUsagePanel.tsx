import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { creditService, type GiftRewardItem } from '../../services/creditService';
import { LandingNewPlatformBadge } from './LandingNewPlatformBadge';
import { TepeCreditTopBar } from './TepeCreditTopBar';
import { TepeCreditUsageCard } from './TepeCreditUsageCard';
import { tepeCreditColors } from './tepeCreditTheme';

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_MIN_H = Math.round(SCREEN_H * 0.24);
const BOTTOM_NAV_SPACE = 100;

type Props = {
  reveal: boolean;
  onBack: () => void;
  onHelp: () => void;
  onBuyPackages: () => void;
};

export function TepeCreditUsagePanel({ reveal, onBack, onHelp, onBuyPackages }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<GiftRewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const costs = await creditService.getCreditCostsForPricing();
      setItems(costs);
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!reveal) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [reveal, fade, slide]);

  return (
    <View style={styles.page}>
      <TepeCreditTopBar title="Kredi Kullanım" onBack={onBack} onHelp={onHelp} />

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
            <Text style={styles.heroTitle}>Kredi Kullanım</Text>
            <Text style={styles.heroAccent}>Alanları</Text>
            <Text style={styles.heroSub}>
              Her özellik için harcanan Tepe Kredi miktarı — güncel maliyetler.
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kredi Kullanım Alanları</Text>
            <TouchableOpacity onPress={onBuyPackages} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.link}>Kredi Satın Al</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={tepeCreditColors.cyan} style={styles.loader} />
          ) : null}

          {!loading && error ? (
            <Text style={styles.status}>Kullanım alanları yüklenemedi.</Text>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <Text style={styles.status}>Henüz kullanım maliyeti tanımlanmamış.</Text>
          ) : null}

          {!loading && items.length > 0 ? (
            <View style={styles.grid}>
              {items.map((item) => (
                <TepeCreditUsageCard
                  key={item.event_type || item.display_name}
                  item={item}
                />
              ))}
            </View>
          ) : null}
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
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    color: tepeCreditColors.textMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: tepeCreditColors.text,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: tepeCreditColors.electricBlue,
  },
  loader: {
    marginVertical: 24,
  },
  status: {
    fontSize: 13,
    color: tepeCreditColors.textMuted,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },
});
