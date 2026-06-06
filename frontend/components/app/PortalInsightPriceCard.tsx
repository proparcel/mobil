import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PortalQueryDetail } from '../../src/types/portal';
import { resolvePortalPriceStatus } from '../../src/utils/portalPriceStatus';

type Props = {
  summary: PortalQueryDetail | null | undefined;
  onOpenKmTab?: () => void;
};

function formatCurrency(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(n));
}

export default function PortalInsightPriceCard({ summary, onOpenKmTab }: Props) {
  const priceInfo = useMemo(() => resolvePortalPriceStatus(summary), [summary]);
  const totalText = priceInfo.totalPrice != null ? formatCurrency(priceInfo.totalPrice) : '—';

  const content = (
    <>
      <View style={[styles.iconWrap, priceInfo.isWarning && styles.iconWrapWarning]}>
        <Ionicons
          name={priceInfo.isWarning ? 'warning-outline' : 'pricetag-outline'}
          size={18}
          color={priceInfo.isWarning ? '#c2410c' : '#2563eb'}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Fiyat</Text>
        <Text style={styles.value}>{totalText}</Text>
        <Text style={[styles.status, priceInfo.isWarning && styles.statusWarning]}>{priceInfo.label}</Text>
      </View>
    </>
  );

  if (priceInfo.clickable && onOpenKmTab) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          styles.cardWarning,
          pressed && styles.cardPressed,
        ]}
        onPress={onOpenKmTab}
        accessibilityRole="button"
        accessibilityLabel={`Fiyat: ${priceInfo.label}. KM Analizi sekmesini aç.`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.card} accessibilityLabel={`Fiyat: ${priceInfo.label}`}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 132,
    maxWidth: 168,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardWarning: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  cardPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  iconWrapWarning: {
    backgroundColor: '#ffedd5',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  status: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#15803d',
  },
  statusWarning: {
    color: '#c2410c',
  },
});
