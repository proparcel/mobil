/**
 * Portal detay — KM Analizi sekmesi (web DetailKmTab parity).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getPortalKmPriceMap } from '../../services/portalService';
import type { PortalKmPriceMapItem, PortalKmSectionData, PortalQueryDetail } from '../../src/types/portal';
import {
  isDbDrivenPriceSelection,
  resolveKmTabDisplayMode,
  resolvePortalPriceStatus,
} from '../../src/utils/portalPriceStatus';
import PortalKmUnverifiedWarning from './PortalKmUnverifiedWarning';

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#2563eb',
};

type NeighborRow = {
  Mahalle?: string;
  quarter_name?: string;
  M2Price?: number | null;
  m2_price?: number | null;
  DistanceMeters?: number | null;
  distance_m?: number | null;
  Verified?: boolean;
  GeneratedPrice?: boolean;
  is_target?: boolean;
  Proparcel?: string | number;
};

type Props = {
  detail: PortalQueryDetail;
  kmSectionData: PortalKmSectionData | null;
  loading: boolean;
  error: string | null;
  onExpertRequest: () => void;
  sectionRef?: React.RefObject<View>;
};

function formatCurrency(value: unknown): string {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(value));
}

function formatNumber(value: unknown, maximumFractionDigits = 0): string {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? Math.min(2, maximumFractionDigits) : 0,
  }).format(Number(value));
}

function formatPercent(value: unknown): string {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  return `%${formatNumber(value, 0)}`;
}

function formatDistance(value: unknown): string {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  return `${formatNumber(value, 0)} m`;
}

function formatBooleanLabel(value: boolean | null | undefined): string {
  return value ? 'Evet' : 'Hayır';
}

function buildNeighborRowsFromPriceMap(items: PortalKmPriceMapItem[]): NeighborRow[] {
  return (items || [])
    .filter((item) => !item.is_target)
    .map((item) => ({
      Mahalle: item.quarter_name,
      quarter_name: item.quarter_name,
      M2Price: item.m2_price,
      m2_price: item.m2_price,
      DistanceMeters: item.distance_m,
      distance_m: item.distance_m,
      Verified: item.verified,
      GeneratedPrice: item.generated,
      is_target: item.is_target,
    }));
}

function fallbackCommentary(selection: Record<string, unknown>): string {
  if (!selection || typeof selection !== 'object') return '';
  const reason = String(selection.reason || '').trim().toUpperCase();
  const model = String(selection.model || '').trim().toUpperCase();
  const details = (selection.details || {}) as Record<string, unknown>;
  const dbSource = (details.db_source || {}) as Record<string, unknown>;
  const dbVerified = Boolean(dbSource.verified);

  if (dbVerified && (reason.startsWith('DB_') || reason.startsWith('VILLAGE_DB_') || model === 'DB')) {
    return 'Uzun süredir bölgede takip ettiğimiz doğrulanmış veriler üzerinden birim fiyat kullanımı için piyasa verileri tercih edilmiştir. Doğrulanmış veri olmayan bölgelerde ProParcel kendi analiz yöntemiyle bölgeye birim fiyat tahmini yapabilir.';
  }

  if (reason || model || Object.keys(details).length) {
    return 'Bölgede doğrulanmış piyasa verisi bulunmadığı için birim fiyat olarak ProParcel analizi kullanılmıştır.';
  }

  return '';
}

function InfoRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  const filtered = rows.filter((row) => row.value !== '—' && row.value !== '');
  if (!filtered.length) {
    return <Text style={styles.emptyText}>Gösterilecek veri yok.</Text>;
  }
  return (
    <View style={styles.infoCard}>
      {filtered.map((row) => (
        <View style={styles.infoRow} key={row.label}>
          <Text style={styles.infoLabel}>{row.label}</Text>
          <Text style={styles.infoValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function MetricCards({
  items,
}: {
  items: Array<{ key: string; label: string; value: string; note?: string; selected?: boolean }>;
}) {
  const filtered = items.filter((item) => item.value !== '—' && item.value !== '');
  if (!filtered.length) return null;
  return (
    <View style={styles.metricsGrid}>
      {filtered.map((item) => (
        <View
          key={item.key}
          style={[styles.metricCard, item.selected ? styles.metricCardSelected : null]}
        >
          <Text style={styles.metricLabel}>{item.label}</Text>
          <Text style={styles.metricValue}>{item.value}</Text>
          {item.note ? <Text style={styles.metricNote}>{item.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function KmCommentaryCallout({
  payload,
  fallbackText,
}: {
  payload: Record<string, unknown> | null | undefined;
  fallbackText: string;
}) {
  const body = payload?.body_tr ? String(payload.body_tr) : fallbackText || '';
  const similarityValue =
    payload?.similarity_pct != null && payload?.similarity_pct !== ''
      ? `%${payload.similarity_pct}`
      : null;
  const prefixSegments = [
    body,
    payload?.db_price_text ? `Veritabanı Fiyatı: ${payload.db_price_text}.` : '',
    payload?.km_price_text ? `KM Analizi Fiyatı: ${payload.km_price_text}.` : '',
  ].filter(Boolean);
  const highlightedText = [
    similarityValue ? `Benzerlik Oranı: ${similarityValue}.` : '',
    payload?.similarity_text_tr ? String(payload.similarity_text_tr) : '',
  ]
    .filter(Boolean)
    .join(' ');
  const suffixText = payload?.footer_tr ? String(payload.footer_tr) : '';

  if (!body && !payload?.db_price_text && !payload?.km_price_text && payload?.similarity_pct == null) {
    return null;
  }

  return (
    <View style={styles.callout}>
      <Text style={styles.calloutText}>
        {prefixSegments.length ? `${prefixSegments.join(' ')} ` : null}
        {highlightedText ? <Text style={styles.calloutHighlight}>{highlightedText}</Text> : null}
        {suffixText ? `${highlightedText ? ' ' : ''}${suffixText}` : null}
      </Text>
    </View>
  );
}

function NeighborMahalleTable({
  rows,
  filter,
  onFilterChange,
  emptyMessage = 'Komşu mahalle verisi bulunamadı.',
}: {
  rows: NeighborRow[];
  filter: string;
  onFilterChange: (value: string) => void;
  emptyMessage?: string;
}) {
  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const blob = [
        row.Mahalle,
        row.quarter_name,
        row.Proparcel,
        row.DistanceMeters,
        row.distance_m,
        row.M2Price,
        row.m2_price,
        row.GeneratedPrice,
        row.Verified,
        row.is_target,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [filter, rows]);

  if (!rows.length) {
    return <Text style={styles.emptyText}>{emptyMessage}</Text>;
  }

  return (
    <>
      <Text style={styles.filterLabel}>Hızlı ara</Text>
      <TextInput
        style={styles.filterInput}
        placeholder="Mahalle, mesafe m, fiyat…"
        placeholderTextColor="#94a3b8"
        value={filter}
        onChangeText={onFilterChange}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {filteredRows.length ? (
        <View style={styles.tableWrap}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colName]}>Mahalle</Text>
            <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colDistance]}>Mesafe</Text>
            <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colPrice]}>Birim Fiyat</Text>
            <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colStatus]}>Durum</Text>
          </View>
          {filteredRows.map((neighbor, index) => {
            const name = neighbor.Mahalle || neighbor.quarter_name || '—';
            const distance = neighbor.DistanceMeters ?? neighbor.distance_m;
            const price = neighbor.M2Price ?? neighbor.m2_price;
            const isTarget = neighbor.is_target;
            let status = 'Ham veri';
            if (neighbor.GeneratedPrice) status = 'Tahmini';
            else if (neighbor.Verified) status = 'Doğrulandı';
            else if (isTarget) status = 'Hedef';
            return (
              <View style={styles.tableRow} key={`${neighbor.Proparcel || name}-${index}`}>
                <Text style={[styles.tableCell, styles.colName]} numberOfLines={2}>{name}</Text>
                <Text style={[styles.tableCell, styles.colDistance]}>{formatDistance(distance)}</Text>
                <Text style={[styles.tableCell, styles.colPrice]}>{formatCurrency(price)}</Text>
                <Text style={[styles.tableCell, styles.colStatus]}>{status}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>Aramanızla eşleşen mahalle yok.</Text>
      )}
    </>
  );
}

export default function PortalKmTab({
  detail,
  kmSectionData,
  loading,
  error,
  onExpertRequest,
  sectionRef,
}: Props) {
  const [neighborTableFilter, setNeighborTableFilter] = useState('');
  const [priceMapLoading, setPriceMapLoading] = useState(false);
  const [priceMapItems, setPriceMapItems] = useState<PortalKmPriceMapItem[]>([]);

  const loadPriceMap = useCallback(async () => {
    const proparcelValue = detail.proparcel_value;
    if (!proparcelValue) {
      setPriceMapItems([]);
      return;
    }
    setPriceMapLoading(true);
    try {
      const res = await getPortalKmPriceMap(proparcelValue, detail.query_type);
      if (res.ok && res.data?.price_map?.data) {
        setPriceMapItems(Array.isArray(res.data.price_map.data) ? res.data.price_map.data : []);
      } else {
        setPriceMapItems([]);
      }
    } finally {
      setPriceMapLoading(false);
    }
  }, [detail.proparcel_value, detail.query_type]);

  useEffect(() => {
    void loadPriceMap();
  }, [loadPriceMap]);

  const kmPayload = kmSectionData;
  const kmNotPerformedMsg = String(kmPayload?.km_not_performed_message || '').trim();
  const kmStaleNotice = String(kmPayload?.km_stale_notice || '').trim();
  const kmSnapshotStale = kmPayload?.km_snapshot_stale === true;

  const kmAnalysis = (kmPayload?.km_analysis || detail.km_analysis || {}) as Record<string, any>;
  const targetInfo = (kmAnalysis.target_info || {}) as Record<string, any>;
  const kmNeighbors = Array.isArray(kmAnalysis.neighbors) ? kmAnalysis.neighbors : [];
  const priceMapNeighbors = useMemo(() => buildNeighborRowsFromPriceMap(priceMapItems), [priceMapItems]);
  const neighborQuarters = Array.isArray(kmPayload?.neighbor_quarters) ? kmPayload.neighbor_quarters as NeighborRow[] : [];
  const avgPrices = (kmAnalysis.avg_prices || {}) as Record<string, unknown>;
  const analysisMeta = (kmAnalysis.analysis_meta || {}) as Record<string, unknown>;
  const quality = (kmAnalysis.quality || {}) as Record<string, any>;
  const selection = (kmPayload?.price_selection_json || detail.price_selection_json || {}) as Record<string, unknown>;
  const isDbSelection = isDbDrivenPriceSelection(selection);
  const commentaryPayload =
    (kmPayload?.price_selection_commentary_payload as Record<string, unknown> | null | undefined)
    || (selection.commentary_payload as Record<string, unknown> | null | undefined)
    || null;
  const kmSubtitle =
    String(kmPayload?.price_selection_commentary_tr || selection.commentary_tr || fallbackCommentary(selection) || 'KM analizi sonucu oluşan fiyat seçimi özeti');

  const displayMode = resolveKmTabDisplayMode({
    kmData: kmPayload,
    summary: detail,
    selection,
  });

  const neighborListRows = useMemo(() => {
    if (priceMapNeighbors.length) return priceMapNeighbors;
    if (neighborQuarters.length) return neighborQuarters;
    return kmNeighbors as NeighborRow[];
  }, [priceMapNeighbors, neighborQuarters, kmNeighbors]);

  const qualityComponents = (quality.components || {}) as Record<string, unknown>;
  const qualityRows = [
    { label: 'Kalite Skoru', value: quality.score != null ? `${formatNumber(quality.score)} / 100` : '—' },
    { label: 'Kalite Seviyesi', value: quality.label ? String(quality.label) : '—' },
    { label: 'Doğrulanmış Fiyat Oranı', value: formatPercent(qualityComponents.verified_ratio) },
    { label: 'Tahmini Fiyat Oranı', value: formatPercent(qualityComponents.generated_ratio) },
    { label: 'Medyan / Ortalama Farkı', value: formatPercent(qualityComponents.median_avg_diff_pct) },
    {
      label: 'Fiyatlar Homojen mi?',
      value:
        qualityComponents.is_homogeneous == null
          ? '—'
          : formatBooleanLabel(Boolean(qualityComponents.is_homogeneous)),
    },
  ];

  const analysisMetaRows = [
    {
      label: 'İncelenen Toplam Mahalle',
      value: analysisMeta.total_examined_count != null ? formatNumber(analysisMeta.total_examined_count) : '—',
    },
    {
      label: 'Birincil Komşu Sayısı',
      value: analysisMeta.primary_neighbors_count != null ? formatNumber(analysisMeta.primary_neighbors_count) : '—',
    },
    {
      label: 'Fiyatlanan Kayıt Sayısı',
      value: analysisMeta.priced_records_count != null ? formatNumber(analysisMeta.priced_records_count) : '—',
    },
    {
      label: 'Yeniden Analiz Sayısı',
      value: analysisMeta.reanalysis_call_count != null ? formatNumber(analysisMeta.reanalysis_call_count) : '—',
    },
  ];

  const heroMetrics = [
    {
      key: 'km-recommended',
      label: isDbSelection ? 'Önerilen m² fiyatı' : 'Önerilen m² fiyatı · ProParcel analizi',
      value: formatCurrency(kmPayload?.km_recommended_price ?? kmAnalysis.recommended_price),
      selected: !isDbSelection,
    },
    {
      key: 'km-target-quarter',
      label: isDbSelection ? 'Hedef mahalle fiyatı · Piyasa verisi' : 'Hedef mahalle fiyatı',
      value: formatCurrency(targetInfo.M2Price),
      note: targetInfo.Proparcel_text ? String(targetInfo.Proparcel_text) : '—',
      selected: isDbSelection,
    },
    ...(!isDbSelection
      ? [
          {
            key: 'km-quality',
            label: 'Kalite Skoru',
            value: quality.score != null ? `${formatNumber(quality.score)} / 100` : '—',
            note: quality.label ? String(quality.label) : '—',
          },
          {
            key: 'km-neighbor-count',
            label: 'Fiyatlanan Komşu',
            value: avgPrices.GroupCount != null ? formatNumber(avgPrices.GroupCount) : '—',
            note: 'Analize giren mahalle',
          },
          {
            key: 'km-verified-ratio',
            label: 'Doğrulanmış Oran',
            value: formatPercent(qualityComponents.verified_ratio),
            note: 'Verified fiyat payı',
          },
        ]
      : []),
  ];

  const priceStatus = resolvePortalPriceStatus(detail);
  const notPerformedMessage = kmNotPerformedMsg;

  if (loading && !kmSectionData) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={COLORS.accentBlue} />
        <Text style={styles.emptyText}>KM analizi yükleniyor…</Text>
      </View>
    );
  }

  if (error && !kmSectionData) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  const neighborTableBlock = (
    <View style={styles.blockCard}>
      <Text style={styles.blockTitle}>Komşu Mahalleler</Text>
      {priceMapLoading ? (
        <ActivityIndicator size="small" color={COLORS.accentBlue} style={styles.inlineLoader} />
      ) : null}
      <NeighborMahalleTable
        rows={neighborListRows}
        filter={neighborTableFilter}
        onFilterChange={setNeighborTableFilter}
      />
    </View>
  );

  return (
    <View ref={sectionRef} style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="analytics" size={16} color={COLORS.accentBlue} />
        <Text style={styles.title}>KM Analizi</Text>
      </View>

      {displayMode === 'km_analysis_full' ? (
        <KmCommentaryCallout payload={commentaryPayload} fallbackText={kmSubtitle} />
      ) : null}

      {kmSnapshotStale && kmStaleNotice ? (
        <View style={styles.staleBox}>
          <Text style={styles.staleText}>{kmStaleNotice}</Text>
        </View>
      ) : null}

      {displayMode === 'neighbors_only_warning' ? (
        <>
          <PortalKmUnverifiedWarning onExpertRequest={onExpertRequest} />
          {neighborTableBlock}
        </>
      ) : null}

      {displayMode === 'neighbors_only' ? (
        <>
          {notPerformedMessage && priceStatus.status === 'verified' ? (
            <Text style={styles.notPerformedText}>{notPerformedMessage}</Text>
          ) : null}
          {neighborTableBlock}
        </>
      ) : null}

      {displayMode === 'km_analysis_full' ? (
        <>
          <PortalKmUnverifiedWarning onExpertRequest={onExpertRequest} />
          <MetricCards items={heroMetrics} />
          <View style={styles.analysisGrid}>
            <View style={styles.blockCard}>
              <Text style={styles.blockTitle}>Kalite Değerlendirmesi</Text>
              <InfoRows rows={qualityRows} />
              {quality.summary_text_tr ? (
                <Text style={styles.sectionNote}>{String(quality.summary_text_tr)}</Text>
              ) : null}
            </View>
            <View style={styles.blockCard}>
              <Text style={styles.blockTitle}>Analiz Özeti</Text>
              <InfoRows rows={analysisMetaRows} />
            </View>
            {neighborTableBlock}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 14,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  noticeBox: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  noticeText: {
    fontSize: 13,
    color: '#9a3412',
    lineHeight: 20,
  },
  staleBox: {
    backgroundColor: '#fefce8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  staleText: {
    fontSize: 13,
    color: '#854d0e',
    lineHeight: 20,
  },
  notPerformedText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  callout: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  calloutText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  calloutHighlight: {
    color: COLORS.accentBlue,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '47%',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  metricCardSelected: {
    borderColor: COLORS.accentBlue,
    backgroundColor: '#eff6ff',
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  metricNote: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  analysisGrid: {
    gap: 12,
  },
  blockCard: {
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  infoCard: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  sectionNote: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  tableHeaderRow: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  tableHeaderCell: {
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  colName: { flex: 2.2 },
  colDistance: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1.4, textAlign: 'right' },
  colStatus: { flex: 1, textAlign: 'right' },
  inlineLoader: { marginBottom: 8 },
});
