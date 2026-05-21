import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { GiftRewardItem } from '../../services/creditService';
import { LandingGlassCard } from './LandingGlassCard';
import { ionIconForReward } from './tepeCreditIcons';
import { tepeCreditColors } from './tepeCreditTheme';

const CARD_W = (Dimensions.get('window').width - 20 * 2 - 12) / 2;

type Props = {
  item: GiftRewardItem;
};

export function TepeCreditUsageCard({ item }: Props) {
  const iconName = ionIconForReward(item);

  return (
    <LandingGlassCard style={styles.card}>
      <Ionicons name={iconName as any} size={22} color={tepeCreditColors.cyan} style={styles.icon} />
      <Text style={styles.credits}>{item.credits}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {item.display_name}
      </Text>
      {item.description ? (
        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <Text style={styles.unit}>Tepe Kredi</Text>
    </LandingGlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    minHeight: 140,
    alignItems: 'center',
    paddingVertical: 16,
  },
  icon: {
    marginBottom: 8,
  },
  credits: {
    fontSize: 26,
    fontWeight: '800',
    color: tepeCreditColors.cyanBright,
    marginBottom: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: tepeCreditColors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  desc: {
    fontSize: 11,
    color: tepeCreditColors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  unit: {
    fontSize: 10,
    color: tepeCreditColors.textSoft,
    fontWeight: '600',
  },
});
