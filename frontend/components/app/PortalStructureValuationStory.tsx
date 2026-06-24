import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PortalQueryDetail } from '../../src/types/portal';
import {
  buildStructureValuationStoryRows,
  type StructureValuationStoryRow,
} from '../../src/utils/dfaPortalSteps';
import type { PortalDfaSimulatedFooter } from '../../src/utils/portalDfaHelpers';

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  headerBg: '#1e293b',
  accentGreen: '#16a34a',
  dangerRed: '#dc2626',
  totalBg: '#f0fdf4',
  detailBg: '#f8fafc',
};

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function formatTotalCell(row: StructureValuationStoryRow): string {
  if (row.total == null || !Number.isFinite(Number(row.total))) return '—';
  return formatPrice(row.total);
}

function rowBackground(row: StructureValuationStoryRow): object | undefined {
  if (row.kind === 'delivery-total') return styles.rowTotal;
  if (row.kind === 'building-detail') return styles.rowDetail;
  return undefined;
}

function effectStyle(row: StructureValuationStoryRow): object | undefined {
  if (row.kind !== 'building-detail') return undefined;
  if (row.tone === 'positive') return styles.effectPos;
  if (row.tone === 'negative') return styles.effectNeg;
  return undefined;
}

type Props = {
  detail: PortalQueryDetail;
  simulatedLand?: PortalDfaSimulatedFooter | null;
};

/** Arazi özeti + yapı adımları + toplam — tek değerleme tablosu (yapı sorguları). */
export default function PortalStructureValuationStory({ detail, simulatedLand = null }: Props) {
  const rows = useMemo(
    () => buildStructureValuationStoryRows(detail, simulatedLand),
    [detail, simulatedLand],
  );

  if (!rows?.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Değerleme özeti</Text>
      <View style={styles.tableWrap}>
        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.cellLayer, styles.headerText]}>Katman</Text>
          <Text style={[styles.cell, styles.cellEffect, styles.headerText]}>Etki</Text>
          <Text style={[styles.cell, styles.cellTotal, styles.headerText]}>Toplam (TL)</Text>
        </View>
        {rows.map((row) => (
          <View key={row.key} style={[styles.dataRow, rowBackground(row)]}>
            <View style={[styles.cell, styles.cellLayer]}>
              <Text
                style={[
                  styles.rowLabel,
                  row.kind === 'building-detail' && styles.detailLabel,
                  row.kind === 'delivery-total' && styles.deliveryLabel,
                ]}
              >
                {row.label}
              </Text>
              {row.kind === 'land-summary' &&
              row.startUnit != null &&
              row.endUnit != null ? (
                <Text style={styles.unitSubline}>
                  {formatPrice(row.startUnit)} → {formatPrice(row.endUnit)} /m²
                </Text>
              ) : null}
            </View>
            <Text style={[styles.cell, styles.cellEffect, effectStyle(row)]}>{row.effect || '—'}</Text>
            <Text
              style={[
                styles.cell,
                styles.cellTotal,
                row.total != null && styles.totalStrong,
                row.kind === 'delivery-total' && styles.deliveryTotal,
              ]}
            >
              {formatTotalCell(row)}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.footnote}>
        Nihai fiyat arazi ve bina yaşı formülüyle birleştirilmiş değerdir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  tableWrap: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderSoft,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.headerBg,
    paddingVertical: 8,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSoft,
    minHeight: 40,
  },
  rowDetail: { backgroundColor: COLORS.detailBg },
  rowTotal: { backgroundColor: COLORS.totalBg },
  headerText: { color: '#fff', fontWeight: '700', fontSize: 10 },
  rowLabel: { fontWeight: '600', color: COLORS.textPrimary, fontSize: 11 },
  detailLabel: { paddingLeft: 8, fontWeight: '500' },
  deliveryLabel: { fontWeight: '700', color: COLORS.accentGreen },
  unitSubline: {
    marginTop: 3,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  cell: { paddingHorizontal: 8, paddingVertical: 8, fontSize: 11, color: COLORS.textPrimary },
  cellLayer: { flex: 1.5 },
  cellEffect: { width: 58, textAlign: 'right', fontWeight: '600' },
  cellTotal: { flex: 1, textAlign: 'right', minWidth: 96 },
  totalStrong: { fontWeight: '700' },
  deliveryTotal: { color: COLORS.accentGreen, fontWeight: '700' },
  effectPos: { color: COLORS.accentGreen },
  effectNeg: { color: COLORS.dangerRed },
  footnote: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
});
