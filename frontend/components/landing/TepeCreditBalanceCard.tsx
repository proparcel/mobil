import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LandingGlassCard } from './LandingGlassCard';
import { tepeCreditColors, tepeCreditRadii } from './tepeCreditTheme';

const TepeCoinIcon = require('../../assets/images/TepeCoin.png');

type Props = {
  balance: number | null;
  onBuyCredit: () => void;
};

export function TepeCreditBalanceCard({ balance, onBuyCredit }: Props) {
  const display = balance !== null ? balance.toLocaleString('tr-TR') : '—';

  return (
    <LandingGlassCard glow style={styles.card}>
      <Text style={styles.label}>Mevcut Kredi Bakiyen</Text>
      <View style={styles.balanceRow}>
        <Text style={styles.balance}>{display}</Text>
        <Image source={TepeCoinIcon} style={styles.coinIcon} resizeMode="contain" />
      </View>

      <TouchableOpacity style={styles.cta} onPress={onBuyCredit} activeOpacity={0.88}>
        <Ionicons name="cart" size={20} color="#031426" />
        <Text style={styles.ctaText}>Kredi Satın Al</Text>
      </TouchableOpacity>
    </LandingGlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 4,
  },
  label: {
    fontSize: 13,
    color: tepeCreditColors.textMuted,
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  balance: {
    fontSize: 44,
    fontWeight: '800',
    color: tepeCreditColors.text,
    letterSpacing: -1,
  },
  coinIcon: {
    width: 36,
    height: 36,
  },
  cta: {
    height: 56,
    borderRadius: tepeCreditRadii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tepeCreditColors.cyan,
    shadowColor: tepeCreditColors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#031426',
  },
});
