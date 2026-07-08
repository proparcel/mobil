import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PortalQueryDetail } from '../../src/types/portal';
import { getPortalValuationDisplay } from '../../src/utils/portalDetailCardContract';
import { INSIGHT_GRID_CARD_HEIGHT } from './portalInsightMetricLayout';

type Props = {
  detail: PortalQueryDetail;
  style?: StyleProp<ViewStyle>;
};

function formatAreaM2(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) return '—';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(value))} m²`;
}

function formatAdaParsel(ada: string | null | undefined, parsel: string | null | undefined): string {
  const a = ada != null && String(ada).trim() !== '' ? String(ada).trim() : '—';
  const p = parsel != null && String(parsel).trim() !== '' ? String(parsel).trim() : '—';
  return `${a} / ${p}`;
}

export default function PortalInsightParcelMetricCard({ detail, style }: Props) {
  const valuation = useMemo(() => getPortalValuationDisplay(detail), [detail]);
  const areaM2 = valuation.area ?? detail.arazi_m2 ?? detail.area_m2;
  const adaParsel = formatAdaParsel(detail.ada, detail.parsel);
  const areaLabel = formatAreaM2(areaM2);

  return (
    <View style={[styles.card, style]} accessibilityLabel={`Ada parsel ${adaParsel}, alan ${areaLabel}.`}>
      <View style={styles.iconWrap}>
        <Ionicons name="map-outline" size={15} color="#2563eb" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          Ada / Parsel
        </Text>
        <Text style={styles.value} numberOfLines={1}>
          {adaParsel}
        </Text>
        <Text style={styles.subValue} numberOfLines={1}>
          {areaLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignSelf: 'stretch',
    height: INSIGHT_GRID_CARD_HEIGHT,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f5f9ff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
    marginBottom: 4,
    lineHeight: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
  },
  subValue: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 16,
  },
});
