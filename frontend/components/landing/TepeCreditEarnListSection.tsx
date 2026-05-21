import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { creditService, type GiftRewardItem } from '../../services/creditService';
import { TepeCreditEarnOpportunityCard } from './TepeCreditEarnOpportunityCard';
import { FALLBACK_GIFT_REWARDS } from './tepeCreditIcons';
import { tepeCreditColors } from './tepeCreditTheme';

type Props = {
  onEarnPress: (item: GiftRewardItem) => void;
  onSeeAllEarn: () => void;
};

export function TepeCreditEarnListSection({ onEarnPress, onSeeAllEarn }: Props) {
  const [earnItems, setEarnItems] = useState<GiftRewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const rewards = await creditService.getGiftRewards();
      setEarnItems(rewards.length > 0 ? rewards : FALLBACK_GIFT_REWARDS);
    } catch {
      setError(true);
      setEarnItems(FALLBACK_GIFT_REWARDS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Kazanım Şansları</Text>
        <TouchableOpacity onPress={onSeeAllEarn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.link}>Tümünü Gör</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={tepeCreditColors.cyan} style={styles.loader} />
      ) : null}

      {!loading && error ? (
        <Text style={styles.status}>Kazanım fırsatları yüklenemedi. Örnek liste gösteriliyor.</Text>
      ) : null}

      {!loading
        ? earnItems.map((item) => (
            <TepeCreditEarnOpportunityCard
              key={item.event_type || item.display_name}
              item={item}
              onPress={item.is_coming_soon ? undefined : () => onEarnPress(item)}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginVertical: 20,
  },
  status: {
    fontSize: 13,
    color: tepeCreditColors.textMuted,
    marginBottom: 12,
  },
});
