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
import PortalInsightMetricChip from './PortalInsightMetricChip';
import PortalInsightPriceCard from './PortalInsightPriceCard';

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

export default function PortalInsightSummaryCard({
  detail,
  data,
  listingProLocked = false,
  listingOnly = false,
  onOpenMulkScoreTab,
  onOpenKmTab,
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
      <View style={styles.card} accessibilityLabel="Özet karar kartı">
        <View style={styles.metricsRow}>
          <PortalInsightPriceCard summary={detail} onOpenKmTab={onOpenKmTab} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card} accessibilityLabel="Özet karar kartı">
      {data.loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Yatırım analizi hesaplanıyor…</Text>
        </View>
      ) : !data.loading && emptyReason && !analysis ? (
        <Text style={styles.emptyText}>
          {emptyReason === 'not_analyzed'
            ? 'Mülk özeti henüz yok; hesap tamamlanınca bu kart dolacak.'
            : 'Özet için veri yok.'}
        </Text>
      ) : (
        <>
          {data.err ? (
            <Text style={styles.noticeText} accessibilityRole="text">
              Yatırım özeti şu an alınamadı; aşağıdaki alanlar özet verisinden gösteriliyor.
            </Text>
          ) : null}

          {showStars ? (
            <InsightStarRow scorePct={starScorePct} onPress={onOpenMulkScoreTab} />
          ) : null}

          {riskChips.length > 0 || onOpenKmTab ? (
            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                {riskChips.slice(0, 3).map((chip) => (
                  <PortalInsightMetricChip
                    key={chip.key}
                    chip={chip}
                    loading={chip.key === 'quarter-center' && quarterCenterMapLoading}
                    mapActive={chip.key === 'quarter-center' && quarterCenterMapActive}
                    onPress={chip.key === 'quarter-center' ? onQuarterCenterChipPress : undefined}
                  />
                ))}
              </View>
              <View style={styles.metricsRow}>
                {riskChips.slice(3).map((chip) => (
                  <PortalInsightMetricChip
                    key={chip.key}
                    chip={chip}
                    loading={chip.key === 'quarter-center' && quarterCenterMapLoading}
                    mapActive={chip.key === 'quarter-center' && quarterCenterMapActive}
                    onPress={chip.key === 'quarter-center' ? onQuarterCenterChipPress : undefined}
                  />
                ))}
                <PortalInsightPriceCard summary={detail} onOpenKmTab={onOpenKmTab} />
              </View>
            </View>
          ) : null}

          {quarterCenterMapError ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {quarterCenterMapError}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
  },
  noticeText: {
    fontSize: 12,
    color: '#b45309',
    marginBottom: 8,
    lineHeight: 18,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  starPressable: {
    alignSelf: 'flex-start',
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
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    width: '100%',
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 18,
  },
});
