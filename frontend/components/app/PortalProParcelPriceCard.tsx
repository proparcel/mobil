/**
 * ProParcel fiyatı kartı — web ParcelSummaryPriceHeader + ParcelSummaryInfoRows + CurrencyStrip ile uyumlu.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PortalQueryDetail } from '../../src/types/portal';
import {
  buildFxPortalTotalsLine,
  buildPriceInfoRows,
} from '../../src/utils/portalDetailCardContract';

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#2563eb',
  cardBg: '#fff',
  stripBg: '#eff6ff',
};

function resolveRowIcon(label: string): React.ComponentProps<typeof Ionicons>['name'] {
  const key = String(label || '').trim().toLocaleLowerCase('tr-TR');
  if (key.includes('toplam fiyat')) return 'cash-outline';
  if (key.includes('uygulanan') && key.includes('%')) return 'stats-chart-outline';
  if (key.includes('villa maliyeti') || key.includes('fabrika maliyeti') || key.includes('yapı maliyeti')) {
    return 'business-outline';
  }
  if (key.includes('arazi maliyeti')) return 'resize-outline';
  return 'pricetag-outline';
}

type Props = {
  detail: PortalQueryDetail;
  topMargin?: number;
};

export default function PortalProParcelPriceCard({ detail, topMargin = 12 }: Props) {
  const rows = useMemo(() => buildPriceInfoRows(detail), [detail]);
  const fxLine = useMemo(() => buildFxPortalTotalsLine(detail.fx_portal), [detail.fx_portal]);

  if (!rows.length) return null;

  return (
    <View style={[styles.card, topMargin > 0 ? { marginTop: topMargin } : null]}>
      <View style={styles.headerRow}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="pricetag" size={16} color={COLORS.accentBlue} />
        </View>
        <Text style={styles.headerTitle}>ProParcel fiyatı</Text>
      </View>

      <View style={styles.body}>
        {rows.map(([label, value, prominent, sublineLabel, sublineValue], index) => {
          const icon = resolveRowIcon(label);
          const isLast = index === rows.length - 1 && !fxLine;
          return (
            <View
              key={`price-row-${label}`}
              style={[
                styles.row,
                prominent ? styles.rowProminent : null,
                isLast ? styles.rowLast : null,
              ]}
            >
              <View style={styles.rowIconWrap}>
                <Ionicons name={icon} size={16} color={COLORS.accentBlue} />
              </View>
              {prominent && sublineLabel && sublineValue ? (
                <>
                  <View style={styles.labelStack}>
                    <Text style={[styles.label, styles.labelProminent]} numberOfLines={2}>
                      {label}
                    </Text>
                    <Text style={styles.sublineLabel} numberOfLines={1}>
                      {sublineLabel}
                    </Text>
                  </View>
                  <View style={styles.valueStack}>
                    <Text
                      style={styles.valueProminent}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {value}
                    </Text>
                    <Text style={styles.sublineValue} numberOfLines={1}>
                      {sublineValue}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.label, styles.labelRegular, prominent ? styles.labelProminent : null]}>{label}</Text>
                  <Text style={[styles.value, prominent ? styles.valueProminent : null]} numberOfLines={3}>
                    {value}
                  </Text>
                </>
              )}
            </View>
          );
        })}
      </View>

      {fxLine ? (
        <View style={styles.fxStrip}>
          <Ionicons name="globe-outline" size={14} color={COLORS.accentBlue} />
          <Text style={styles.fxText}>{fxLine.replace(/ · /g, '  ·  ')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderSoft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  headerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  body: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: '#fff',
  },
  rowProminent: {
    backgroundColor: '#f8fafc',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIconWrap: {
    width: 22,
    alignItems: 'center',
    paddingTop: 2,
  },
  labelStack: {
    flexShrink: 1,
    flexGrow: 0,
    maxWidth: '38%',
    paddingRight: 6,
  },
  valueStack: {
    flex: 1,
    flexShrink: 0,
    minWidth: '58%',
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  labelProminent: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  labelRegular: {
    flex: 1,
    paddingRight: 8,
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'right',
    maxWidth: '46%',
  },
  valueProminent: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.accentBlue,
    textAlign: 'right',
    width: '100%',
  },
  sublineLabel: {
    marginTop: 4,
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  sublineValue: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  fxStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.stripBg,
  },
  fxText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.accentBlue,
    lineHeight: 16,
  },
});
