import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { GiftRewardItem } from '../../services/creditService';
import { LandingGlassCard } from './LandingGlassCard';
import { ionIconForReward } from './tepeCreditIcons';
import { tepeCreditColors } from './tepeCreditTheme';

type Props = {
  item: GiftRewardItem;
  onPress?: () => void;
};

export function TepeCreditEarnOpportunityCard({ item, onPress }: Props) {
  const soon = !!item.is_coming_soon;
  const iconName = ionIconForReward(item);
  const inner = (
    <LandingGlassCard style={[styles.card, soon && styles.cardSoon]}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name={iconName as any} size={24} color={tepeCreditColors.cyan} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.display_name}</Text>
            {soon ? <Text style={styles.soonBadge}>Yakında</Text> : null}
          </View>
          {item.description ? (
            <Text style={styles.desc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.reward}>
          <Text style={styles.rewardAmount}>{item.credits}</Text>
          <Text style={styles.rewardUnit}>Tepe Kredi</Text>
        </View>
      </View>
      {!soon ? (
        <View style={styles.arrow}>
          <Ionicons name="chevron-forward" size={18} color={tepeCreditColors.textSoft} />
        </View>
      ) : null}
    </LandingGlassCard>
  );

  if (soon || !onPress) {
    return <View style={styles.wrap}>{inner}</View>;
  }

  return (
    <TouchableOpacity style={styles.wrap} onPress={onPress} activeOpacity={0.88}>
      {inner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  card: {
    minHeight: 120,
    position: 'relative',
  },
  cardSoon: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 24,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(57, 223, 255, 0.12)',
    borderWidth: 1,
    borderColor: tepeCreditColors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: tepeCreditColors.text,
  },
  soonBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: tepeCreditColors.textSoft,
    textTransform: 'uppercase',
  },
  desc: {
    fontSize: 12,
    lineHeight: 17,
    color: tepeCreditColors.textMuted,
  },
  reward: {
    alignItems: 'flex-end',
    minWidth: 72,
  },
  rewardAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: tepeCreditColors.rewardGreen,
  },
  rewardUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: tepeCreditColors.textSoft,
    textAlign: 'right',
  },
  arrow: {
    position: 'absolute',
    right: 14,
    bottom: 16,
  },
});
