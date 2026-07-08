import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PortalInvestmentScorePayload, PortalQueryDetail } from '../../src/types/portal';
import {
  buildInsightRiskChips,
  resolvePortalInsightStarScorePct,
  resolveSlopePercentForInsight,
} from '../../src/utils/portalInsightHelpers';
import PortalInsightGeneralHeroCard from './PortalInsightGeneralHeroCard';
import PortalInsightMetricChip from './PortalInsightMetricChip';
import PortalInsightParcelMetricCard from './PortalInsightParcelMetricCard';
import PortalInsightSlopeMetricCard from './PortalInsightSlopeMetricCard';
import PortalInsightMorphologyMetricCard from './PortalInsightMorphologyMetricCard';

export type PortalInsightScoresBundle = {
  loading: boolean;
  err: string | null;
  invPayload: PortalInvestmentScorePayload | null;
  slopeSection: Record<string, unknown> | null;
};

type Props = {
  detail: PortalQueryDetail;
  data: PortalInsightScoresBundle;
  listingProLocked?: boolean;
  listingOnly?: boolean;
  onOpenMulkScoreTab?: () => void;
  onOpenKmTab?: () => void;
  onOpenSlopeTab?: () => void;
  onQuarterCenterChipPress?: () => void;
  quarterCenterMapActive?: boolean;
  quarterCenterMapLoading?: boolean;
  quarterCenterMapError?: string | null;
};

function InsightStarRow({
  scorePct,
  onPress,
}: {
  scorePct: number | null;
  onPress?: () => void;
}) {
  if (scorePct == null) return null;
  const outOfFive = (scorePct / 100) * 5;
  const fullStars = Math.min(5, Math.max(0, Math.floor(outOfFive)));
  const hasHalf = outOfFive - fullStars >= 0.25 && fullStars < 5;

  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < fullStars) return 'star';
    if (i === fullStars && hasHalf) return 'star-half';
    return 'star-outline';
  });

  const row = (
    <View style={styles.starRow}>
      {stars.map((name, idx) => (
        <Ionicons key={`star-${idx}`} name={name} size={18} color="#f59e0b" />
      ))}
      <Text style={styles.starScoreText}>{outOfFive.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.starPressable, pressed && styles.starPressablePressed]}
        accessibilityRole="button"
        accessibilityLabel="Genel puan. Mülk Skoru sekmesini aç."
      >
        {row}
      </Pressable>
    );
  }
  return row;
}

function MetricGridRows({ children }: { children: React.ReactNode[] }) {
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < children.length; i += 2) {
    rows.push(children.slice(i, i + 2));
  }

  return (
    <View style={styles.metricsGrid}>
      {rows.map((row, rowIndex) => (
        <View key={`metric-row-${rowIndex}`} style={styles.gridRow}>
          {row.map((child, cellIndex) => (
            <View key={`metric-cell-${rowIndex}-${cellIndex}`} style={styles.gridCell}>
              <View style={styles.gridCellInner}>{child}</View>
            </View>
          ))}
          {row.length === 1 ? <View style={styles.gridCell} /> : null}
        </View>
      ))}
    </View>
  );
}

export default function PortalInsightSummaryCard({
  detail,
  data,
  listingProLocked = false,
  listingOnly = false,
  onOpenMulkScoreTab,
  onOpenKmTab,
  onOpenSlopeTab,
  onQuarterCenterChipPress,
  quarterCenterMapActive = false,
  quarterCenterMapLoading = false,
  quarterCenterMapError = null,
}: Props) {
  const analysis = data.invPayload?.analysis ?? null;
  const emptyReason = data.invPayload?.empty_reason;

  const attrs =
    detail.listing_attributes && typeof detail.listing_attributes === 'object'
      ? detail.listing_attributes
      : {};

  const slopePct = useMemo(() => {
    if (listingProLocked || listingOnly) {
      return resolveSlopePercentForInsight(null, attrs, detail);
    }
    return resolveSlopePercentForInsight(data.slopeSection, attrs, detail);
  }, [listingProLocked, listingOnly, data.slopeSection, attrs, detail]);

  const riskChips = useMemo(() => {
    if (listingProLocked || listingOnly) return [];
    return buildInsightRiskChips({
      summary: detail,
      analysis,
      slopePct,
    });
  }, [listingProLocked, listingOnly, detail, analysis, slopePct]);

  const starScorePct = useMemo(
    () => resolvePortalInsightStarScorePct(detail as unknown as Record<string, unknown>, data.invPayload),
    [detail, data.invPayload],
  );

  const showStars = !listingProLocked && !listingOnly && (analysis || starScorePct != null);

  const metricCells = useMemo(() => {
    const cells: React.ReactNode[] = [
      <PortalInsightParcelMetricCard key="parcel" detail={detail} />,
    ];

    riskChips.forEach((chip) => {
      cells.push(
        <PortalInsightMetricChip
          key={chip.key}
          chip={chip}
          loading={chip.key === 'quarter-center' && quarterCenterMapLoading}
          mapActive={chip.key === 'quarter-center' && quarterCenterMapActive}
          onPress={chip.key === 'quarter-center' ? onQuarterCenterChipPress : undefined}
        />,
      );
    });

    if (onOpenSlopeTab) {
      cells.push(
        <PortalInsightSlopeMetricCard key="slope" slopePct={slopePct} onPress={onOpenSlopeTab} />,
      );
    }

    cells.push(
      <PortalInsightMorphologyMetricCard
        key="morphology"
        detail={detail}
        slopeSection={data.slopeSection}
        onPress={onOpenSlopeTab}
      />,
    );

    return cells;
  }, [
    detail,
    riskChips,
    quarterCenterMapLoading,
    quarterCenterMapActive,
    onQuarterCenterChipPress,
    onOpenSlopeTab,
    slopePct,
    data.slopeSection,
  ]);

  if (listingProLocked) {
    return (
      <View style={styles.card} accessibilityLabel="Özet karar kartı">
        <View style={styles.lockedBox}>
          <Text style={styles.lockedText}>
            <Text style={styles.lockedStrong}>Pro Sorgu</Text>
            {' '}ile açıldığında bu özet — fiyat, puan ve risk — tek bakışta görünür.
          </Text>
        </View>
      </View>
    );
  }

  if (listingOnly) {
    return (
      <View style={styles.container} accessibilityLabel="Özet karar kartı">
        <PortalInsightGeneralHeroCard detail={detail} onOpenKmTab={onOpenKmTab} />
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityLabel="Özet karar kartı">
      {data.loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Yatırım analizi hesaplanıyor…</Text>
        </View>
      ) : null}

      {!data.loading && emptyReason && !analysis ? (
        <Text style={styles.emptyText}>
          {emptyReason === 'not_analyzed'
            ? 'Mülk özeti henüz yok; hesap tamamlanınca puan ve risk kartları dolacak.'
            : 'Özet için veri yok.'}
        </Text>
      ) : null}

      {data.err ? (
        <Text style={styles.noticeText} accessibilityRole="text">
          Yatırım özeti şu an alınamadı; aşağıdaki alanlar özet verisinden gösteriliyor.
        </Text>
      ) : null}

      {showStars ? (
        <View style={styles.starRowWrap}>
          <InsightStarRow scorePct={starScorePct} onPress={onOpenMulkScoreTab} />
        </View>
      ) : null}

      <PortalInsightGeneralHeroCard detail={detail} onOpenKmTab={onOpenKmTab} />

      <MetricGridRows>{metricCells}</MetricGridRows>

      {quarterCenterMapError ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {quarterCenterMapError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
  },
  card: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  lockedBox: {
    paddingVertical: 8,
  },
  lockedText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  lockedStrong: {
    fontWeight: '700',
    color: '#0f172a',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 12,
    color: '#b45309',
    marginBottom: 8,
    lineHeight: 18,
  },
  starRowWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  starPressable: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  starPressablePressed: {
    opacity: 0.85,
  },
  starScoreText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  metricsGrid: {
    gap: 6,
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    width: '100%',
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  gridCellInner: {
    flex: 1,
    alignSelf: 'stretch',
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 18,
  },
});
