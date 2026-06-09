/**
 * Portal detay — DFA tablosu (web PortalRecentQueryDetailApp OverviewTab ile uyumlu).
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { postMahalleOrtSignal } from '../../services/portalService';
import { useScrollInputIntoView } from '../../src/keyboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PortalQueryDetail } from '../../src/types/portal';
import {
  buildDfaRowsFromSteps,
  computeDfaPriceFromMahalleOrt,
  filterLandDfaStepsForStructureQuery,
  formatTotalAppliedPercent,
  getPortalDfaPriceFooter,
  parseMahalleOrtInput,
  type PortalDfaRow,
  type PortalDfaSimulatedFooter,
} from '../../src/utils/portalDfaHelpers';
import { isStructurePortalQueryType } from '../../src/utils/portalDetailCardContract';
import PortalValuationLayersSummary from './PortalValuationLayersSummary';

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

const DFA_SECTION_SUBTITLE =
  'Piyasa verileri, ilanlar, danışman girdileri ve SPK lisanslı uzmanların katkılarıyla oluşturulan piyasa ortalaması esas alınmıştır. Değerleme sırasında sunduğumuz hesap makinesiyle yeniden hesaplama yapabilirsiniz. «Mahalle Ortalaması Bildir» ile girdiğiniz fiyat sistemimizde kayıt altına alınır ve bölgesel analizlerde değerlendirilir.';

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
  onBeforeMahalleInputFocus?: () => void;
  hasElectricOverrideNote?: boolean;
  onOpenRoadModal?: () => void;
  onOpenElectricModal?: () => void;
  onMahalleOrtSaved?: () => void;
};

type DfaTableOptions = {
  showActionColumn?: boolean;
  expandedDfaRowKey: string | null;
  setExpandedDfaRowKey: React.Dispatch<React.SetStateAction<string | null>>;
};

export default function PortalDfaTableCard({
  detail,
  scrollRef,
  onBeforeMahalleInputFocus,
  hasElectricOverrideNote = false,
  onOpenRoadModal,
  onOpenElectricModal,
  onMahalleOrtSaved,
}: Props) {
  const [mahalleOrtInput, setMahalleOrtInput] = useState('');
  const [simulatedFooter, setSimulatedFooter] = useState<PortalDfaSimulatedFooter | null>(null);
  const [mahalleOrtNotice, setMahalleOrtNotice] = useState<string | null>(null);
  const [mahalleOrtBildirSubmitting, setMahalleOrtBildirSubmitting] = useState(false);
  const [mahalleOrtDbSaved, setMahalleOrtDbSaved] = useState(false);
  const [expandedDfaRowKey, setExpandedDfaRowKey] = useState<string | null>(null);
  const mahalleOrtWrapRef = useRef<View>(null);

  const isStructure = isStructurePortalQueryType(detail.query_type);
  const rawSteps = Array.isArray(detail.dfa_json) ? detail.dfa_json : [];
  const landSteps = useMemo(
    () => filterLandDfaStepsForStructureQuery(rawSteps, isStructure),
    [rawSteps, isStructure],
  );
  const buildingSteps = Array.isArray(detail.building_dfa_json) ? detail.building_dfa_json : [];
  const dfaRows = useMemo(() => buildDfaRowsFromSteps(landSteps), [landSteps]);
  const buildingDfaRows = useMemo(() => buildDfaRowsFromSteps(buildingSteps), [buildingSteps]);
  const dfaFooter = useMemo(() => getPortalDfaPriceFooter(detail), [detail]);
  const hasValuationLayers = Boolean(detail.valuation_layers_summary);

  const areaM2 = useMemo(() => {
    const raw = detail.arazi_m2 ?? detail.area_m2;
    if (raw == null || raw === '' || Number.isNaN(Number(raw))) return null;
    const n = Number(raw);
    return n > 0 ? n : null;
  }, [detail.arazi_m2, detail.area_m2]);

  useEffect(() => {
    setMahalleOrtInput('');
    setSimulatedFooter(null);
    setMahalleOrtNotice(null);
    setMahalleOrtDbSaved(false);
    setExpandedDfaRowKey(null);
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

  const handleMahalleOrtBildir = useCallback(async () => {
    const unit = parseMahalleOrtInput(mahalleOrtInput);
    const snapshotId = Number(detail.snapshot_id);
    if (unit == null || !Number.isFinite(snapshotId) || snapshotId <= 0 || mahalleOrtBildirSubmitting) {
      return;
    }

    const runSignal = async (confirmExtremePrice: boolean) =>
      postMahalleOrtSignal(snapshotId, unit, { confirmExtremePrice });

    setMahalleOrtBildirSubmitting(true);
    try {
      let res = await runSignal(false);

      if (!res.ok && res.status === 409 && res.code === 'confirm_extreme_price') {
        const message =
          res.error ||
          String(res.payload?.message || '') ||
          'Girdiğiniz fiyat mahalle ortalamasından önemli ölçüde farklı. Onaylıyor musunuz?';
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert('Onay', message, [
            { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Evet', onPress: () => resolve(true) },
          ]);
        });
        if (!confirmed) {
          setMahalleOrtNotice('Onay verilmediği için fiyat veritabanına kaydedilmedi.');
          return;
        }
        res = await runSignal(true);
      }

      if (!res.ok) {
        Alert.alert('Uyarı', res.error || 'Mahalle ortalaması kaydedilemedi.');
        return;
      }

      const body = res.data;
      if (body.ui_only) {
        setMahalleOrtNotice(
          body.message ||
            'Yalnızca ekranda hesaplandı; mahalle ortalaması veritabanına kaydedilmedi.',
        );
        setMahalleOrtDbSaved(false);
      } else if (body.db_saved) {
        setMahalleOrtNotice('Mahalle ortalaması bildirildi.');
        setMahalleOrtDbSaved(true);
        onMahalleOrtSaved?.();
      } else if (body.message) {
        setMahalleOrtNotice(body.message);
      }
    } catch {
      Alert.alert('Uyarı', 'Mahalle ortalaması isteği gönderilemedi.');
    } finally {
      setMahalleOrtBildirSubmitting(false);
      Keyboard.dismiss();
    }
  }, [mahalleOrtInput, detail.snapshot_id, mahalleOrtBildirSubmitting, onMahalleOrtSaved]);

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

  const hasLandDfaTable = mergedRows.length > 0;
  const showMahalleOrtControls = isStructure
    ? hasLandDfaTable || hasValuationLayers
    : hasLandDfaTable;

  const showLandSummaryGrid = !isStructure || !hasValuationLayers;

  const hasStructureDfaContent =
    isStructure && (hasValuationLayers || buildingDfaRows.length > 0);

  if (!rawSteps.length && !buildingSteps.length && !hasStructureDfaContent) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gayrimenkul Değerleme Hesap Makinesi</Text>
        <Text style={styles.emptyText}>
          DFA adımları henüz yüklenmedi veya bu kayıt için gösterilemiyor. Sayfayı yenileyin veya birkaç saniye bekleyin.
        </Text>
      </View>
    );
  }

  const renderDfaTable = (
    rows: PortalDfaRow[],
    tableKey: string,
    options: DfaTableOptions,
  ) => {
    const { showActionColumn = false, expandedDfaRowKey: expandedKey, setExpandedDfaRowKey: setExpandedKey } =
      options;

    return (
      <View style={styles.tableWrap} key={tableKey}>
        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.cellDesc, styles.headerText]}>Açıklama</Text>
          <Text style={[styles.cell, styles.cellPctCol, styles.headerText]}>Yüzde</Text>
          {showActionColumn ? (
            <Text style={[styles.cell, styles.cellActionCol, styles.headerText]}>İşlem</Text>
          ) : null}
        </View>
        {rows.map((row, i) => {
          const isPositive = row.tone === 'positive';
          const isNegative = row.tone === 'negative';
          const descLower = String(row.description || '').toLowerCase();
          const isRoadFrontageRow = row.key === 'road-frontage-dfa-row';
          const canReportRoad = row.portalReportRoad === true;
          const canReportElectric = row.portalReportElectric === true;
          const isElectricRelatedRow =
            descLower.includes('yüksek gerilim') || descLower.includes('elektrik hattı');
          const isExpanded = expandedKey === row.key;
          const canExpand = row.hasDetails;

          return (
            <View key={`${tableKey}-${row.key}`}>
              <View
                style={[
                  styles.row,
                  i % 2 === 0 && styles.rowAlt,
                  isPositive && styles.rowPos,
                  isNegative && styles.rowNeg,
                  isExpanded && styles.rowExpanded,
                ]}
              >
                <View style={{ flex: 1 }}>
                  {canExpand ? (
                    <TouchableOpacity
                      onPress={() => setExpandedKey((prev) => (prev === row.key ? null : row.key))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.cell, styles.cellDesc]}>
                        {isRoadFrontageRow && roadFrontageDisplay
                          ? `${row.description}: ${roadFrontageDisplay}`
                          : row.description}
                      </Text>
                      <Text style={styles.expandHint}>
                        {isExpanded ? 'Detayı gizle' : 'Detayı göster'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.cell, styles.cellDesc]}>
                      {isRoadFrontageRow && roadFrontageDisplay
                        ? `${row.description}: ${roadFrontageDisplay}`
                        : row.description}
                    </Text>
                  )}
                  {isElectricRelatedRow && hasElectricOverrideNote ? (
                    <Text style={styles.userNote}>Hat bildirimi kullanıcı tarafından yapılmıştır.</Text>
                  ) : null}
                </View>
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
                {showActionColumn ? (
                  <View style={styles.cellActionCol}>
                    {canReportRoad && onOpenRoadModal ? (
                      <TouchableOpacity onPress={onOpenRoadModal} style={styles.actionBtn} activeOpacity={0.8}>
                        <Text style={styles.actionBtnText}>Yol Bildir</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canReportElectric && onOpenElectricModal ? (
                      <TouchableOpacity onPress={onOpenElectricModal} style={styles.actionBtn} activeOpacity={0.8}>
                        <Text style={styles.actionBtnText}>Hat Bildir</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {isExpanded && row.details.length ? (
                <View style={styles.detailsPanel}>
                  {row.details.map((line, detailIdx) => (
                    <Text key={`${row.key}-detail-${detailIdx}`} style={styles.detailsLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  };

  const tableOptions: DfaTableOptions = {
    expandedDfaRowKey,
    setExpandedDfaRowKey,
  };

  const renderMahalleOrtControls = () => (
    <View ref={mahalleOrtWrapRef} style={styles.mahalleOrtWrap}>
      <Text style={styles.mahalleOrtLabel}>Mahalle Ortalaması</Text>
      <TextInput
        style={styles.mahalleOrtInput}
        placeholder={
          dfaFooter.startUnit != null ? String(Math.round(dfaFooter.startUnit)) : 'TL/m²'
        }
        placeholderTextColor={COLORS.textSecondary}
        keyboardType="decimal-pad"
        value={mahalleOrtInput}
        onChangeText={(t) => {
          setMahalleOrtInput(t);
          setSimulatedFooter(null);
          setMahalleOrtNotice(null);
        }}
        onFocus={handleMahalleInputFocus}
        onBlur={handleMahalleInputBlur}
        onSubmitEditing={handleMahalleOrtHesapla}
        returnKeyType="done"
        autoCorrect={false}
      />
      <View style={styles.mahalleOrtBtnRow}>
        <TouchableOpacity
          style={[styles.mahalleOrtBtn, !mahalleOrtValid && styles.mahalleOrtBtnDisabled]}
          onPress={handleMahalleOrtHesapla}
          disabled={!mahalleOrtValid}
          activeOpacity={0.85}
        >
          <Text style={styles.mahalleOrtBtnText}>Yeniden Hesapla</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mahalleOrtBtnBildir,
            (!mahalleOrtValid || mahalleOrtBildirSubmitting) && styles.mahalleOrtBtnDisabled,
          ]}
          onPress={handleMahalleOrtBildir}
          disabled={!mahalleOrtValid || mahalleOrtBildirSubmitting}
          activeOpacity={0.85}
        >
          {mahalleOrtBildirSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.mahalleOrtBtnText}>Mahalle Ortalaması Bildir</Text>
          )}
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
      {simulatedFooter ? (
        <Text style={styles.simulatedHint}>Mahalle ortalamasına göre simüle edilmiş fiyatlar</Text>
      ) : null}
      {mahalleOrtDbSaved ? (
        <Text style={styles.savedHint}>Mahalle ortalaması veritabanına kaydedildi.</Text>
      ) : null}
      {mahalleOrtNotice ? <Text style={styles.mahalleOrtNotice}>{mahalleOrtNotice}</Text> : null}
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Gayrimenkul Değerleme Hesap Makinesi</Text>
      <Text style={styles.cardSubtitle}>{DFA_SECTION_SUBTITLE}</Text>

      {showMahalleOrtControls ? renderMahalleOrtControls() : null}

      {isStructure && hasValuationLayers ? (
        <PortalValuationLayersSummary detail={detail} simulatedLand={simulatedFooter} />
      ) : null}

      {showLandSummaryGrid ? (
        <View style={styles.summaryWrap}>
          <Text style={styles.summaryTitle}>Değerleme özeti (özet API)</Text>
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
        </View>
      ) : null}

      {buildingDfaRows.length ? (
        <>
          <Text style={styles.sectionSubtitle}>Yapı Metrikleri Açıklaması</Text>
          {renderDfaTable(buildingDfaRows, 'building-dfa', tableOptions)}
        </>
      ) : null}

      {hasLandDfaTable ? (
        <>
          {isStructure ? (
            <Text style={styles.sectionSubtitle}>Arazi Metrikleri Açıklaması</Text>
          ) : null}
          {renderDfaTable(mergedRows, 'land-dfa', { ...tableOptions, showActionColumn: true })}
        </>
      ) : null}
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
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
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
    marginTop: 8,
    fontSize: 11,
    color: '#b45309',
    fontWeight: '600',
  },
  savedHint: {
    marginTop: 8,
    fontSize: 11,
    color: COLORS.accentGreen,
    fontWeight: '600',
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryItem: { width: '50%', paddingVertical: 6, paddingRight: 8 },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  summaryValueHighlight: { color: COLORS.accentBlue },
  mahalleOrtWrap: {
    marginBottom: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    backgroundColor: COLORS.pageBg,
  },
  mahalleOrtLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  mahalleOrtInput: {
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  mahalleOrtBtnRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  mahalleOrtBtn: {
    backgroundColor: COLORS.accentBlue,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
    alignItems: 'center',
  },
  mahalleOrtBtnBildir: {
    backgroundColor: COLORS.accentGreen,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
    alignItems: 'center',
  },
  mahalleOrtBtnDisabled: { opacity: 0.45 },
  mahalleOrtBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
  mahalleOrtNotice: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#b45309',
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 8,
    marginBottom: 8,
  },
  tableWrap: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderSoft,
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', backgroundColor: COLORS.headerBg },
  headerText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderSoft },
  rowAlt: { backgroundColor: '#f8fafc' },
  rowPos: { backgroundColor: '#f0fdf4' },
  rowNeg: { backgroundColor: '#fef2f2' },
  rowExpanded: { backgroundColor: '#eff6ff' },
  cell: { paddingHorizontal: 8, paddingVertical: 8, fontSize: 11, color: COLORS.textPrimary },
  cellDesc: { flex: 1 },
  cellPctCol: { width: 72, textAlign: 'right' },
  cellActionCol: { width: 88, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 4 },
  pctText: { fontWeight: '600' },
  pctPos: { color: COLORS.accentGreen },
  pctNeg: { color: COLORS.dangerRed },
  expandHint: { marginTop: 4, fontSize: 10, fontWeight: '600', color: COLORS.accentBlue },
  detailsPanel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSoft,
  },
  detailsLine: { fontSize: 11, lineHeight: 16, color: COLORS.textSecondary, marginBottom: 4 },
  userNote: { marginTop: 3, fontSize: 10, fontWeight: '700', color: '#b45309' },
  actionBtn: {
    marginTop: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: COLORS.accentBlue,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  actionBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.accentBlue },
});
