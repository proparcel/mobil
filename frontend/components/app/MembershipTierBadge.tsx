import React from 'react';
import { Platform, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import type { User } from '../../src/types/auth';
import { getMembershipTierBadgeLabel } from '../../src/utils/membership';

const EXPERT_HEADER_LABEL_COLOR = 'rgba(147, 223, 255, 0.85)';

const PREMIUM_HANDWRITING_FONT = Platform.select({
  ios: 'Snell Roundhand',
  android: 'cursive',
  default: 'cursive',
});

type Props = {
  user?: User | null;
  size?: 'xs' | 'sm' | 'md';
  style?: StyleProp<TextStyle>;
};

export function MembershipTierBadge({ user, size = 'sm', style }: Props) {
  const label = getMembershipTierBadgeLabel(user);
  if (!label) return null;

  const isPremium = label === 'Premium';
  const tierStyle = isPremium ? styles.premiumBadge : styles.vipBadge;
  const sizeStyle = isPremium
    ? size === 'md'
      ? styles.premiumMd
      : size === 'xs'
        ? styles.premiumXs
        : styles.premiumSm
    : size === 'md'
      ? styles.vipMd
      : size === 'xs'
        ? styles.vipXs
        : styles.vipSm;

  return (
    <Text style={[tierStyle, sizeStyle, style]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  premiumBadge: {
    color: EXPERT_HEADER_LABEL_COLOR,
    fontFamily: PREMIUM_HANDWRITING_FONT,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  vipBadge: {
    color: EXPERT_HEADER_LABEL_COLOR,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  vipXs: {
    fontSize: 9,
  },
  vipSm: {
    fontSize: 10,
  },
  vipMd: {
    fontSize: 12,
  },
  premiumXs: {
    fontSize: 12,
  },
  premiumSm: {
    fontSize: 14,
  },
  premiumMd: {
    fontSize: 16,
  },
});
