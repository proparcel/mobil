import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PortalQueryDetail } from '../../src/types/portal';
import { resolvePortalPriceStatus } from '../../src/utils/portalPriceStatus';

type Props = {
  summary: PortalQueryDetail | null | undefined;
  onOpenKmTab?: () => void;
  style?: StyleProp<ViewStyle>;
};

function formatCurrency(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(n));
}

export default function PortalInsightPriceCard({ summary, onOpenKmTab, style }: Props) {
  const priceInfo = useMemo(() => resolvePortalPriceStatus(summary), [summary]);
  const totalText = priceInfo.totalPrice != null ? formatCurrency(priceInfo.totalPrice) : '—';

  const content = (
    <>
      <View style={[styles.iconWrap, priceInfo.isWarning && styles.iconWrapWarning]}>
        <Ionicons
          name={priceInfo.isWarning ? 'warning-outline' : 'pricetag-outline'}
          size={15}
          color={priceInfo.isWarning ? '#c2410c' : '#2563eb'}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          Fiyat
        </Text>
        <Text style={styles.value} numberOfLines={1}>
          {totalText}
        </Text>
        <Text style={[styles.status, priceInfo.isWarning && styles.statusWarning]} numberOfLines={2}>
          {priceInfo.label}
        </Text>
      </View>
    </>
  );

  const cardStyle = [
    styles.card,
    priceInfo.isWarning && styles.cardWarning,
    style,
  ];

  if (priceInfo.clickable && onOpenKmTab) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyle, pressed && styles.cardPressed]}
        onPress={onOpenKmTab}
        accessibilityRole="button"
        accessibilityLabel={`Fiyat: ${priceInfo.label}. KM Analizi sekmesini aç.`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} accessibilityLabel={`Fiyat: ${priceInfo.label}`}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f5f9ff',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  cardWarning: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  cardPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    flexShrink: 0,
  },
  iconWrapWarning: {
    backgroundColor: '#ffedd5',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
    marginBottom: 3,
    lineHeight: 12,
  },
  value: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 15,
  },
  status: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    color: '#15803d',
    lineHeight: 12,
  },
  statusWarning: {
    color: '#c2410c',
  },
});
