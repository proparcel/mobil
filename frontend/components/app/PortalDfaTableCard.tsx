/**
 * Portal detay — DFA tablosu (web PortalRecentQueryDetailApp DfaTableSection ile uyumlu).
 * Özet fiyatlar üstte; mahalle ortalaması ile yeniden hesaplama.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
} from 'react-native';
import { useScrollInputIntoView } from '../../src/keyboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PortalDfaStep, PortalQueryDetail } from '../../src/types/portal';
import {
  buildDfaRowsFromSteps,
  computeDfaPriceFromMahalleOrt,
  formatTotalAppliedPercent,
  getPortalDfaPriceFooter,
  parseMahalleOrtInput,
  type PortalDfaRow,
  type PortalDfaSimulatedFooter,
} from '../../src/utils/portalDfaHelpers';

const COLORS = {
  headerBg: '#1e293b',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#2563eb',
  accentGreen: '#16a34a',
  dangerRed: '#dc2626',
  pageBg: '#f8fafc',
};

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function formatRoadFrontageMeters(raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)} m`;
}

type Props = {
  detail: PortalQueryDetail;
  scrollRef?: React.RefObject<ScrollView | null>;
  /** DFA sekmesi kapalıysa overview’a geç (klavye öncesi) */
  onBeforeMahalleInputFocus?: () => void;
  hasElectricOverrideNote?: boolean;
  onOpenRoadModal?: () => void;
  onOpenElectricModal?: () => void;
};

export default function PortalDfaTableCard({
  detail,
  scrollRef,
  onBeforeMahalleInputFocus,
  hasElectricOverrideNote = false,
  onOpenRoadModal,
  onOpenElectricModal,
}: Props) {
  const [mahalleOrtInput, setMahalleOrtInput] = useState('');
  const [simulatedFooter, setSimulatedFooter] = useState<PortalDfaSimulatedFooter | null>(null);
  const mahalleOrtWrapRef = useRef<View>(null);

  const steps = Array.isArray(detail.dfa_json) ? detail.dfa_json : [];
  const dfaRows = useMemo(() => buildDfaRowsFromSteps(steps), [steps]);
  const dfaFooter = useMemo(() => getPortalDfaPriceFooter(detail), [detail]);

  const areaM2 = useMemo(() => {
    const raw = detail.arazi_m2 ?? detail.area_m2;
    if (raw == null || raw === '' || Number.isNaN(Number(raw))) return null;
    const n = Number(raw);
    return n > 0 ? n : null;
  }, [detail.arazi_m2, detail.area_m2]);

  useEffect(() => {
    setMahalleOrtInput('');
    setSimulatedFooter(null);
  }, [detail.snapshot_id]);

  const displayFooter = simulatedFooter ?? dfaFooter;
  const appliedPercentLabel =
    simulatedFooter?.appliedPercent ?? formatTotalAppliedPercent(detail, dfaRows);

  const applyMahalleOrtUnit = useCallback(
    (unit: number) => {
      const computed = computeDfaPriceFromMahalleOrt(unit, dfaRows, areaM2);
      setMahalleOrtInput(String(Math.round(unit)));
      setSimulatedFooter(computed);
    },
    [dfaRows, areaM2],
  );

  const handleMahalleOrtHesapla = useCallback(() => {
    const unit = parseMahalleOrtInput(mahalleOrtInput);
    if (unit == null) {
      setSimulatedFooter(null);
      return;
    }
    applyMahalleOrtUnit(unit);
    Keyboard.dismiss();
  }, [mahalleOrtInput, applyMahalleOrtUnit]);

  /** Orijinal (API başlangıç) mahalle birim fiyatı ile yeniden hesapla */
  const handleMahalleOrtReset = useCallback(() => {
    const originalUnit = dfaFooter.startUnit;
    if (originalUnit == null || !Number.isFinite(originalUnit) || originalUnit <= 0) {
      setMahalleOrtInput('');
      setSimulatedFooter(null);
      return;
    }
    applyMahalleOrtUnit(originalUnit);
    Keyboard.dismiss();
  }, [dfaFooter.startUnit, applyMahalleOrtUnit]);

  const canResetMahalleOrt =
    dfaFooter.startUnit != null &&
    Number.isFinite(Number(dfaFooter.startUnit)) &&
    Number(dfaFooter.startUnit) > 0;

  const { handleFocus: handleMahalleInputFocus, handleBlur: handleMahalleInputBlur } =
    useScrollInputIntoView({
      scrollRef: scrollRef ?? { current: null },
      inputWrapRef: mahalleOrtWrapRef,
      onBeforeFocus: onBeforeMahalleInputFocus,
    });

  const mahalleOrtValid = parseMahalleOrtInput(mahalleOrtInput) != null;

  const roadExtra: PortalDfaRow | null = useMemo(() => {
    const raw = detail.road_frontage_values?.total_road_frontage_edge_length_m;
    if (raw == null || raw === '' || Number.isNaN(Number(raw))) {
      return null;
    }
    return {
      key: 'road-frontage-dfa-row',
      stepKey: null,
      stepTitle: 'Toplam yola cephe',
      note: '',
      description: 'Toplam yola cephe',
      details: [],
      hasDetails: false,
      percent: '—',
      tone: 'neutral',
      factor: null,
    };
  }, [detail.road_frontage_values?.total_road_frontage_edge_length_m]);

  const mergedRows = useMemo(() => {
    return roadExtra ? [roadExtra, ...dfaRows] : dfaRows;
  }, [dfaRows, roadExtra]);

  const roadFrontageDisplay = useMemo(() => {
    const raw = detail.road_frontage_values?.total_road_frontage_edge_length_m;
    return raw != null ? formatRoadFrontageMeters(raw) : null;
  }, [detail.road_frontage_values?.total_road_frontage_edge_length_m]);

  if (!steps.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Detaylı Fiyat Analizi Tablosu</Text>
        <Text style={styles.emptyText}>
          DFA adımları henüz yüklenmedi veya bu kayıt için gösterilemiyor. Sayfayı yenileyin veya birkaç saniye bekleyin.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Detaylı Fiyat Analizi Tablosu</Text>

      {/* Web: özet fiyatlar tablonun üstünde */}
      <View style={styles.summaryWrap}>
        <Text style={styles.summaryTitle}>Değerleme özeti (özet API)</Text>
        {simulatedFooter ? (
          <Text style={styles.simulatedHint}>Mahalle ortalamasına göre simüle edilmiş fiyatlar</Text>
        ) : null}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Başlangıç (TL/m²)</Text>
            <Text style={styles.summaryValue}>
              {displayFooter.startUnit != null ? formatPrice(displayFooter.startUnit) : '—'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Bitiş (TL/m²)</Text>
            <Text style={[styles.summaryValue, simulatedFooter && styles.summaryValueHighlight]}>
              {displayFooter.endUnit != null ? formatPrice(displayFooter.endUnit) : '—'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Uygulanan %</Text>
            <Text style={styles.summaryValue}>{appliedPercentLabel}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Toplam (TL)</Text>
            <Text style={[styles.summaryValue, simulatedFooter && styles.summaryValueHighlight]}>
              {displayFooter.total != null ? formatPrice(displayFooter.total) : '—'}
            </Text>
          </View>
        </View>

        <View ref={mahalleOrtWrapRef} style={styles.mahalleOrtWrap}>
          <Text style={styles.mahalleOrtLabel}>Mahalle Ortalaması</Text>
          <View style={styles.mahalleOrtRow}>
            <TextInput
              style={styles.mahalleOrtInput}
              placeholder={
                dfaFooter.startUnit != null
                  ? String(Math.round(dfaFooter.startUnit))
                  : 'TL/m²'
              }
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
              value={mahalleOrtInput}
              onChangeText={(t) => {
                setMahalleOrtInput(t);
                setSimulatedFooter(null);
              }}
              onFocus={handleMahalleInputFocus}
              onBlur={handleMahalleInputBlur}
              onSubmitEditing={handleMahalleOrtHesapla}
              returnKeyType="done"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.mahalleOrtBtn, !mahalleOrtValid && styles.mahalleOrtBtnDisabled]}
              onPress={handleMahalleOrtHesapla}
              disabled={!mahalleOrtValid}
              activeOpacity={0.85}
            >
              <Text style={styles.mahalleOrtBtnText}>Hesapla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mahalleOrtRefreshBtn, !canResetMahalleOrt && styles.mahalleOrtBtnDisabled]}
              onPress={handleMahalleOrtReset}
              disabled={!canResetMahalleOrt}
              activeOpacity={0.85}
              accessibilityLabel="Orijinal mahalle ortalaması ile yeniden hesapla"
            >
              <Ionicons name="refresh" size={22} color={COLORS.accentBlue} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.tableWrap}>
        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.cellDesc, styles.headerText]}>Açıklama</Text>
          <Text style={[styles.cell, styles.cellPctCol, styles.headerText]}>Yüzde</Text>
        </View>
        {mergedRows.map((row, i) => {
          const isPositive = row.tone === 'positive';
          const isNegative = row.tone === 'negative';
          const descLower = String(row.description || '').toLowerCase();
          const isRoadFrontageRow = row.key === 'road-frontage-dfa-row';
          const canReportRoad = descLower.includes('yola bağlantısı yok');
          const canReportElectric =
            descLower.includes('yüksek gerilim hattı') || descLower.includes('elektrik hattı');
          const isElectricRelatedRow =
            descLower.includes('yüksek gerilim') || descLower.includes('elektrik hattı');

          return (
            <View
              key={row.key}
              style={[
                styles.row,
                i % 2 === 0 && styles.rowAlt,
                isPositive && styles.rowPos,
                isNegative && styles.rowNeg,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.cell, styles.cellDesc]}>
                  {isRoadFrontageRow && roadFrontageDisplay
                    ? `${row.description}: ${roadFrontageDisplay}`
                    : row.description}
                </Text>
                {isElectricRelatedRow && hasElectricOverrideNote ? (
                  <Text style={styles.userNote}>Hat bildirimi kullanıcı tarafından yapılmıştır.</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[
                    styles.cell,
                    styles.cellPctCol,
                    styles.pctText,
                    isPositive && styles.pctPos,
                    isNegative && styles.pctNeg,
                  ]}
                >
                  {row.percent}
                </Text>
                {canReportRoad && onOpenRoadModal ? (
                  <TouchableOpacity
                    onPress={onOpenRoadModal}
                    style={styles.actionBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>Yol Bildir</Text>
                  </TouchableOpacity>
                ) : null}
                {canReportElectric && onOpenElectricModal ? (
                  <TouchableOpacity
                    onPress={onOpenElectricModal}
                    style={styles.actionBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>Hat Bildir</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderSoft,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  summaryWrap: {
    marginBottom: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  simulatedHint: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryItem: { width: '50%', paddingVertical: 6, paddingRight: 8 },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  summaryValueHighlight: { color: COLORS.accentBlue },
  mahalleOrtWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderSoft },
  mahalleOrtLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  mahalleOrtRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mahalleOrtInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.pageBg,
  },
  mahalleOrtBtn: {
    backgroundColor: COLORS.accentBlue,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  mahalleOrtBtnDisabled: { opacity: 0.45 },
  mahalleOrtBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  mahalleOrtRefreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accentBlue,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableWrap: { borderRadius: 6, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderSoft },
  headerRow: { flexDirection: 'row', backgroundColor: COLORS.headerBg },
  headerText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderSoft },
  rowAlt: { backgroundColor: '#f8fafc' },
  rowPos: { backgroundColor: '#f0fdf4' },
  rowNeg: { backgroundColor: '#fef2f2' },
  cell: { paddingHorizontal: 8, paddingVertical: 8, fontSize: 11, color: COLORS.textPrimary },
  cellDesc: { flex: 1 },
  cellPctCol: { width: 88, textAlign: 'right' },
  pctText: { fontWeight: '600' },
  pctPos: { color: COLORS.accentGreen },
  pctNeg: { color: COLORS.dangerRed },
  userNote: { marginTop: 3, fontSize: 10, fontWeight: '700', color: '#b45309' },
  actionBtn: {
    marginTop: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: COLORS.accentBlue,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.accentBlue },
});
