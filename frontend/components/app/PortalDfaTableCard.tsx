/**
 * Portal detay — DFA tablosu (web PortalRecentQueryDetailApp OverviewTab ile uyumlu).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useScrollInputIntoView } from '../../src/keyboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PortalQueryDetail } from '../../src/types/portal';
import {
  buildDfaRowsFromSteps,
  filterLandDfaStepsForStructureQuery,
  formatTotalAppliedPercent,
  getPortalDfaPriceFooter,
  type PortalDfaRow,
} from '../../src/utils/portalDfaHelpers';
import { parseMahalleOrtInput } from '../../src/utils/dfaPortalSteps';
import { isStructurePortalQueryType } from '../../src/utils/portalDetailCardContract';
import {
  usePortalMahalleOrtSession,
  type PortalMahalleOrtSession,
} from '../../src/hooks/usePortalMahalleOrtSession';
import CreditCelebrationModal from './CreditCelebrationModal';
import PortalStructureValuationStory from './PortalStructureValuationStory';

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
  viewerIsExpert?: boolean;
  /** DFA sekmesinde hesap makinesi ile değerleme tablosu arasına kart yerleştirir. */
  middleSlot?: React.ReactNode;
  /** `calculator` — yalnız hesap alanı; `valuation` — tablo/özet (+ middleSlot); `full` — hepsi */
  section?: 'full' | 'calculator' | 'valuation';
  /** Hesapla + DFA sekmeleri arasında mahalle ort. simülasyonu paylaşır. */
  mahalleOrtSession?: PortalMahalleOrtSession;
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
  viewerIsExpert = false,
  middleSlot,
  section = 'full',
  mahalleOrtSession: externalMahalleOrtSession,
}: Props) {
  const internalMahalleOrtSession = usePortalMahalleOrtSession(detail, {
    onMahalleOrtSaved,
    viewerIsExpert,
  });
  const mahalleOrtSession = externalMahalleOrtSession ?? internalMahalleOrtSession;
  const {
    mahalleOrtInput,
    setMahalleOrtInput,
    simulatedFooter,
    mahalleOrtNotice,
    mahalleOrtHesaplaSubmitting,
    mahalleOrtBildirSubmitting,
    mahalleOrtDbSaved,
    creditCelebration,
    setCreditCelebration,
    handleMahalleOrtHesapla,
    handleMahalleOrtBildir,
    handleMahalleOrtReset,
    canResetMahalleOrt,
    mahalleOrtValid,
    mahalleOrtBusy,
  } = mahalleOrtSession;
  const [expandedDfaRowKey, setExpandedDfaRowKey] = useState<string | null>(null);
  const mahalleOrtWrapRef = useRef<View>(null);

  const isStructure = isStructurePortalQueryType(detail.query_type);
  const rawSteps = Array.isArray(detail.dfa_json) ? detail.dfa_json : [];
  const landSteps = useMemo(
    () => filterLandDfaStepsForStructureQuery(rawSteps, isStructure),
    [rawSteps, isStructure],
  );
  const dfaRows = useMemo(() => buildDfaRowsFromSteps(landSteps), [landSteps]);
  const dfaFooter = useMemo(() => getPortalDfaPriceFooter(detail), [detail]);
  const hasValuationLayers = Boolean(detail.valuation_layers_summary);

  useEffect(() => {
    setExpandedDfaRowKey(null);
  }, [detail.snapshot_id]);

  const displayFooter = simulatedFooter ?? dfaFooter;
  const appliedPercentLabel =
    simulatedFooter?.appliedPercent ?? formatTotalAppliedPercent(detail, dfaRows);

  const { handleFocus: handleMahalleInputFocus, handleBlur: handleMahalleInputBlur } =
    useScrollInputIntoView({
      scrollRef: scrollRef ?? { current: null },
      inputWrapRef: mahalleOrtWrapRef,
      onBeforeFocus: onBeforeMahalleInputFocus,
    });

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

  const buildingSteps = Array.isArray(detail.building_dfa_json) ? detail.building_dfa_json : [];
  const hasStructureDfaContent =
    isStructure && (hasValuationLayers || buildingSteps.length > 0);
  const hasAnyDfaContent = rawSteps.length > 0 || buildingSteps.length > 0 || hasStructureDfaContent;

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
        onSubmitEditing={() => {
          void handleMahalleOrtHesapla();
        }}
        returnKeyType="done"
        autoCorrect={false}
        editable={!mahalleOrtBusy}
      />
      <View style={styles.mahalleOrtBtnRow}>
        <TouchableOpacity
          style={[
            styles.mahalleOrtBtn,
            (!mahalleOrtValid || mahalleOrtBusy) && styles.mahalleOrtBtnDisabled,
          ]}
          onPress={() => {
            void handleMahalleOrtHesapla();
          }}
          disabled={!mahalleOrtValid || mahalleOrtBusy}
          activeOpacity={0.85}
        >
          {mahalleOrtHesaplaSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.mahalleOrtBtnText}>Yeniden Hesapla</Text>
          )}
        </TouchableOpacity>
        {viewerIsExpert ? (
          <TouchableOpacity
            style={[
              styles.mahalleOrtBtnBildir,
              (!mahalleOrtValid || mahalleOrtBusy) && styles.mahalleOrtBtnDisabled,
            ]}
            onPress={() => {
              void handleMahalleOrtBildir();
            }}
            disabled={!mahalleOrtValid || mahalleOrtBusy}
            activeOpacity={0.85}
          >
            {mahalleOrtBildirSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.mahalleOrtBtnText}>Mahalle Ortalaması Bildir</Text>
            )}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.mahalleOrtRefreshBtn, !canResetMahalleOrt && styles.mahalleOrtBtnDisabled]}
          onPress={handleMahalleOrtReset}
          disabled={!canResetMahalleOrt || mahalleOrtBusy}
          activeOpacity={0.85}
          accessibilityLabel="Simülasyonu sıfırla"
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
      <CreditCelebrationModal
        visible={Boolean(creditCelebration)}
        credits={creditCelebration?.credits ?? 1}
        message={creditCelebration?.message ?? ''}
        onClose={() => setCreditCelebration(null)}
      />
    </View>
  );

  const renderValuationSummaryGrid = () => {
    if (!showLandSummaryGrid) return null;
    return (
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
    );
  };

  const renderValuationAndLandSections = () => (
    <>
      {isStructure && hasValuationLayers ? (
        <PortalStructureValuationStory detail={detail} simulatedLand={simulatedFooter} />
      ) : null}

      {renderValuationSummaryGrid()}

      {hasLandDfaTable ? (
        <>
          {isStructure ? (
            <Text style={styles.sectionSubtitle}>Arazi Metrikleri Açıklaması</Text>
          ) : null}
          {renderDfaTable(mergedRows, 'land-dfa', { ...tableOptions, showActionColumn: true })}
        </>
      ) : null}
    </>
  );

  const hasBottomSection =
    (isStructure && hasValuationLayers) || showLandSummaryGrid || hasLandDfaTable;

  const renderCalculatorCard = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Gayrimenkul Değerleme Hesap Makinesi</Text>
      <Text style={styles.cardSubtitle}>{DFA_SECTION_SUBTITLE}</Text>
      {showMahalleOrtControls ? renderMahalleOrtControls() : null}
    </View>
  );

  const renderEmptyCalculator = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Gayrimenkul Değerleme Hesap Makinesi</Text>
      <Text style={styles.emptyText}>
        DFA adımları henüz yüklenmedi veya bu kayıt için gösterilemiyor. Sayfayı yenileyin veya birkaç saniye bekleyin.
      </Text>
    </View>
  );

  const renderEmptyValuation = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Değerleme Faktörleri Analizi</Text>
      <Text style={styles.emptyText}>
        DFA adımları henüz yüklenmedi veya bu kayıt için gösterilemiyor. Sayfayı yenileyin veya birkaç saniye bekleyin.
      </Text>
    </View>
  );

  if (section === 'calculator') {
    if (!hasAnyDfaContent && !showMahalleOrtControls) {
      return renderEmptyCalculator();
    }
    const summaryGrid = renderValuationSummaryGrid();
    return (
      <>
        {renderCalculatorCard()}
        {summaryGrid ? (
          <View style={[styles.card, styles.cardBottom]}>{summaryGrid}</View>
        ) : null}
      </>
    );
  }

  if (section === 'valuation') {
    if (!hasAnyDfaContent) {
      return renderEmptyValuation();
    }
    return (
      <>
        {middleSlot}
        {hasBottomSection ? (
          <View style={[styles.card, styles.cardBottom]}>{renderValuationAndLandSections()}</View>
        ) : null}
      </>
    );
  }

  if (!hasAnyDfaContent) {
    return renderEmptyCalculator();
  }

  if (middleSlot) {
    return (
      <>
        {renderCalculatorCard()}
        {middleSlot}
        {hasBottomSection ? (
          <View style={[styles.card, styles.cardBottom]}>{renderValuationAndLandSections()}</View>
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Gayrimenkul Değerleme Hesap Makinesi</Text>
      <Text style={styles.cardSubtitle}>{DFA_SECTION_SUBTITLE}</Text>

      {showMahalleOrtControls ? renderMahalleOrtControls() : null}

      {renderValuationAndLandSections()}
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
  cardBottom: {
    marginTop: 0,
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
