import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { PortalQueryDetail } from '../../src/types/portal';
import {
  applySimulatedLandToValuationLayers,
  unitDeltaToAppliedPct,
  type SimulatedLandFooter,
} from '../../src/utils/portalDfaHelpers';

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#2563eb',
  mergeBg: '#fffbeb',
  totalBg: '#f0fdf4',
};

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

type Props = {
  detail: PortalQueryDetail;
  simulatedLand?: SimulatedLandFooter | null;
};

export default function PortalValuationLayersSummary({ detail, simulatedLand = null }: Props) {
  const baseLayers = detail.valuation_layers_summary;
  const canSeeCost = detail.viewer_can_see_structure_cost_breakdown === true;

  const layers = useMemo(() => {
    if (!baseLayers || typeof baseLayers !== 'object') return null;
    const structureCost =
      canSeeCost && baseLayers.structure?.cost_tl != null ? baseLayers.structure.cost_tl : null;
    return applySimulatedLandToValuationLayers(baseLayers, simulatedLand, {
      structureCost,
      deliveryTotal: baseLayers.delivery?.total_tl ?? detail.total_price ?? null,
    });
  }, [baseLayers, simulatedLand, canSeeCost, detail.total_price]);

  if (!layers) return null;

  const land = layers.land || {};
  const structure = layers.structure || {};
  const delivery = layers.delivery || {};
  const merge = layers.merge_adjustment || null;
  const adjustments = Array.isArray(layers.adjustments) ? layers.adjustments : [];

  const structureTotal =
    canSeeCost && structure.cost_tl != null
      ? structure.cost_tl
      : structure.structure_share_tl != null
        ? structure.structure_share_tl
        : structure.cost_tl ?? null;

  const rows: Array<{
    key: string;
    label: string;
    startUnit: number | null | undefined;
    endUnit: number | null | undefined;
    effect: string | null;
    total: number | null | undefined;
    rowStyle?: object;
  }> = [
    {
      key: 'land',
      label: land.label || 'Arazi',
      startUnit: land.start_unit_m2,
      endUnit: land.end_unit_m2,
      effect: unitDeltaToAppliedPct(land.start_unit_m2, land.end_unit_m2) !== '—'
        ? unitDeltaToAppliedPct(land.start_unit_m2, land.end_unit_m2)
        : land.applied_pct || '—',
      total: land.total_tl,
    },
    {
      key: 'structure',
      label: structure.label || 'Yapı',
      startUnit: structure.start_unit_m2,
      endUnit: structure.end_unit_m2,
      effect: unitDeltaToAppliedPct(structure.start_unit_m2, structure.end_unit_m2) !== '—'
        ? unitDeltaToAppliedPct(structure.start_unit_m2, structure.end_unit_m2)
        : structure.applied_pct || '—',
      total: structureTotal,
    },
  ];

  if (merge && merge.total_tl != null && Number(merge.total_tl) > 0) {
    rows.push({
      key: 'merge',
      label: merge.label || 'Bina yaşı etkisi (toplam)',
      startUnit: null,
      endUnit: null,
      effect: merge.applied_pct || '—',
      total: merge.total_tl,
      rowStyle: styles.rowMerge,
    });
  }

  rows.push({
    key: 'delivery',
    label: delivery.label || 'Toplam değer',
    startUnit: null,
    endUnit: null,
    effect: null,
    total: delivery.total_tl,
    rowStyle: styles.rowTotal,
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Değerleme özeti</Text>
      {layers.structure_age_note ? (
        <Text style={styles.ageNote}>{layers.structure_age_note}</Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.headerRow}>
            <Text style={[styles.cell, styles.cellLayer, styles.headerText]}>Katman</Text>
            <Text style={[styles.cell, styles.cellUnit, styles.headerText]}>Başlangıç</Text>
            <Text style={[styles.cell, styles.cellUnit, styles.headerText]}>Son</Text>
            <Text style={[styles.cell, styles.cellEffect, styles.headerText]}>Etki</Text>
            <Text style={[styles.cell, styles.cellTotal, styles.headerText]}>Toplam</Text>
          </View>
          {rows.map((row) => (
            <View key={row.key} style={[styles.dataRow, row.rowStyle]}>
              <Text style={[styles.cell, styles.cellLayer, styles.rowLabel]}>{row.label}</Text>
              <Text style={[styles.cell, styles.cellUnit]}>{row.startUnit != null ? formatPrice(row.startUnit) : '—'}</Text>
              <Text style={[styles.cell, styles.cellUnit]}>{row.endUnit != null ? formatPrice(row.endUnit) : '—'}</Text>
              <Text style={[styles.cell, styles.cellEffect]}>{row.effect || '—'}</Text>
              <Text style={[styles.cell, styles.cellTotal, styles.totalStrong]}>{formatPrice(row.total)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {adjustments.length ? (
        <View style={styles.adjList}>
          {adjustments.map((item, idx) => (
            <Text key={`adj-${idx}-${item?.label || ''}`} style={styles.adjItem}>
              {item?.label ? `${item.label} ` : ''}
              <Text style={styles.adjStrong}>{item?.applied_pct || '—'}</Text>
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSoft,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  ageNote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    paddingBottom: 6,
    marginBottom: 4,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSoft,
  },
  rowMerge: { backgroundColor: COLORS.mergeBg },
  rowTotal: { backgroundColor: COLORS.totalBg },
  headerText: { fontWeight: '700', color: COLORS.textSecondary, fontSize: 10 },
  rowLabel: { fontWeight: '600', color: COLORS.textPrimary },
  cell: { fontSize: 11, color: COLORS.textPrimary, paddingRight: 8 },
  cellLayer: { width: 120 },
  cellUnit: { width: 88 },
  cellEffect: { width: 52 },
  cellTotal: { width: 96 },
  totalStrong: { fontWeight: '700' },
  adjList: { marginTop: 8, gap: 4 },
  adjItem: { fontSize: 11, color: COLORS.textSecondary },
  adjStrong: { fontWeight: '700', color: COLORS.textPrimary },
});
