import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { PortalQueryDetail } from '../../src/types/portal';
import { getPortalValuationDisplay } from '../../src/utils/portalDetailCardContract';
import { resolvePortalQueryTypeLabel } from '../../src/utils/portalInsightHelpers';
import { resolvePortalPriceStatus, resolvePortalTotalPrice } from '../../src/utils/portalPriceStatus';

type Props = {
  detail: PortalQueryDetail;
  onOpenKmTab?: () => void;
  style?: StyleProp<ViewStyle>;
};

function formatCurrency(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(n));
}

export default function PortalInsightGeneralHeroCard({ detail, onOpenKmTab, style }: Props) {
  const priceInfo = useMemo(() => resolvePortalPriceStatus(detail), [detail]);
  const valuation = useMemo(() => getPortalValuationDisplay(detail), [detail]);
  const totalPrice = useMemo(() => resolvePortalTotalPrice(detail) ?? valuation.total, [detail, valuation.total]);
  const unitPrice = valuation.unit;
  const typeLabel = useMemo(() => resolvePortalQueryTypeLabel(detail.query_type), [detail.query_type]);

  const totalText = totalPrice != null ? formatCurrency(totalPrice) : '—';
  const unitText = unitPrice != null ? `${formatCurrency(unitPrice)}/m²` : '—';

  const content = (
    <>
      <View style={styles.priceRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Toplam fiyat</Text>
          <Text style={[styles.priceValue, priceInfo.isWarning && styles.priceValueWarning]} numberOfLines={1}>
            {totalText}
          </Text>
        </View>
        <View style={styles.priceDivider} />
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Birim fiyat</Text>
          <Text style={styles.priceValue} numberOfLines={1}>
            {unitText}
          </Text>
        </View>
      </View>
      <Text style={styles.typeLabel} numberOfLines={1}>
        {typeLabel}
      </Text>
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
        accessibilityLabel={`Toplam fiyat ${totalText}, birim fiyat ${unitText}, tip ${typeLabel}. KM Analizi sekmesini aç.`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} accessibilityLabel={`Toplam fiyat ${totalText}, birim fiyat ${unitText}, tip ${typeLabel}.`}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f5f9ff',
    marginBottom: 8,
  },
  cardWarning: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  cardPressed: {
    opacity: 0.88,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  priceCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  priceDivider: {
    width: 1,
    marginHorizontal: 12,
    backgroundColor: '#cbd5e1',
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  priceValueWarning: {
    color: '#9a3412',
  },
  typeLabel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
    textAlign: 'center',
  },
});
