/**
 * Portal detay — Yol sekmesi (web DetailRoadTab parity).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getPortalRoadDiagram, getPortalRoadSection } from '../../services/portalService';
import type { PortalQueryDetail, PortalRoadMetrics, PortalRoadSectionResponse } from '../../src/types/portal';
import {
  formatRoadFrontageMeters,
  resolveImportantFrontageM,
  resolveLongestFrontageM,
} from '../../src/utils/portalInsightHelpers';
import { buildPortalRoadSvgPanZoomHtml, PORTAL_ROAD_SVG_FIT_JS } from '../../src/utils/portalRoadSvgPanZoom';

const COLORS = {
  textPrimary: '#071733',
  textSecondary: '#64748b',
  borderSoft: '#bfdbfe',
  accentBlue: '#1d4ed8',
  pageBg: '#ffffff',
  heroBg: '#f5f9ff',
};

const DIAGRAM_HEIGHT = Math.min(420, Math.round(Dimensions.get('window').height * 0.42));

const CORNER_NOTE_DEFAULT = 'Gerçek bağlantılı parçalardan benzersiz etiket çiftleri';
const IMPORTANT_NOTE = 'En küçük yol indeksli bağlantı cephesi';
const LONGEST_NOTE = 'Ölçülen segmentler arasındaki en uzun cephe';

type Props = {
  snapshotId: number;
  detail?: PortalQueryDetail | null;
  listingProLocked?: boolean;
  sectionRef?: React.RefObject<View>;
};

function formatCount(value: unknown, isRoadV2: boolean): string {
  if (!isRoadV2) return '—';
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(value));
}

function RoadHeroBlock({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <View style={styles.heroBlock}>
      <Text style={styles.heroLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.heroValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.heroNote} numberOfLines={3}>
        {note}
      </Text>
    </View>
  );
}

function RoadHeroGrid({
  cornerCount,
  cornerNote,
  importantM,
  longestM,
  isRoadV2,
}: {
  cornerCount: unknown;
  cornerNote: string;
  importantM: number | null;
  longestM: number | null;
  isRoadV2: boolean;
}) {
  const blocks = [
    {
      key: 'corner',
      label: 'Köşe Sayısı',
      value: formatCount(cornerCount, isRoadV2),
      note: cornerNote || CORNER_NOTE_DEFAULT,
    },
    {
      key: 'important',
      label: 'Önemli Cephe',
      value: isRoadV2 ? formatRoadFrontageMeters(importantM) : '—',
      note: IMPORTANT_NOTE,
    },
    {
      key: 'longest',
      label: 'Uzun Cephe',
      value: isRoadV2 ? formatRoadFrontageMeters(longestM) : '—',
      note: LONGEST_NOTE,
    },
  ];

  return (
    <View style={styles.heroGrid}>
      {blocks.map((block) => (
        <RoadHeroBlock key={block.key} label={block.label} value={block.value} note={block.note} />
      ))}
    </View>
  );
}

function MetricCards({
  metrics,
  isRoadV2,
}: {
  metrics: PortalRoadMetrics | null | undefined;
  isRoadV2: boolean;
}) {
  const items = [
    { key: 'connection', label: 'Bağlantılı', value: formatCount(metrics?.connection_count, isRoadV2) },
    {
      key: 'assumed',
      label: 'Varsayılan bağlantılı',
      value: formatCount(metrics?.assumed_connection_count, isRoadV2),
    },
    { key: 'frontage', label: 'Sadece cephe', value: formatCount(metrics?.frontage_only_count, isRoadV2) },
    {
      key: 'total',
      label: 'Toplam cephe uzunluğu',
      value: isRoadV2 ? formatRoadFrontageMeters(metrics?.total_frontage_length_m) : '—',
    },
  ];

  return (
    <View style={styles.metricsGrid}>
      {items.map((item) => (
        <View key={item.key} style={styles.metricCard}>
          <Text style={styles.metricLabel}>{item.label}</Text>
          <Text style={styles.metricValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function RoadSvgViewer({ svg }: { svg: string }) {
  const html = useMemo(() => buildPortalRoadSvgPanZoomHtml(svg), [svg]);
  const webRef = useRef<WebView>(null);

  return (
    <View style={styles.diagramFrame}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={styles.diagramWebView}
        androidLayerType="hardware"
        onLoadEnd={() => {
          webRef.current?.injectJavaScript(PORTAL_ROAD_SVG_FIT_JS);
        }}
      />
    </View>
  );
}

export default function PortalRoadTab({
  snapshotId,
  detail = null,
  listingProLocked = false,
  sectionRef,
}: Props) {
  const [sectionData, setSectionData] = useState<PortalRoadSectionResponse | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [diagramSvg, setDiagramSvg] = useState<string | null>(null);
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const sectionFetchedForRef = useRef<number | null>(null);
  const diagramFetchedForRef = useRef<number | null>(null);

  useEffect(() => {
    setSectionData(null);
    setSectionError(null);
    setDiagramSvg(null);
    setDiagramError(null);
    sectionFetchedForRef.current = null;
    diagramFetchedForRef.current = null;
  }, [snapshotId]);

  useEffect(() => {
    if (listingProLocked || !Number.isFinite(snapshotId) || snapshotId <= 0) return;
    if (sectionFetchedForRef.current === snapshotId) return;
    sectionFetchedForRef.current = snapshotId;
    let cancelled = false;
    setSectionLoading(true);
    setSectionError(null);
    getPortalRoadSection(snapshotId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data) {
          setSectionData(res.data);
        } else {
          setSectionError(res.error || 'Yol verisi yüklenemedi');
          sectionFetchedForRef.current = null;
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSectionError(e instanceof Error ? e.message : 'Yol verisi yüklenemedi');
          sectionFetchedForRef.current = null;
        }
      })
      .finally(() => {
        if (!cancelled) setSectionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [snapshotId, listingProLocked]);

  const metrics = sectionData?.road_metrics;
  const isRoadV2 = Boolean(metrics?.is_road_v2 ?? detail?.road_v2 ?? sectionData?.road_v2_frontage?.is_road_v2);

  const heroImportantM = useMemo(() => {
    const fromMetrics = metrics?.important_frontage_length_m;
    if (fromMetrics != null && !Number.isNaN(Number(fromMetrics))) return Number(fromMetrics);
    return resolveImportantFrontageM(detail ?? sectionData ?? undefined);
  }, [metrics?.important_frontage_length_m, detail, sectionData]);

  const heroLongestM = useMemo(() => {
    const fromMetrics = metrics?.longest_frontage_length_m;
    if (fromMetrics != null && !Number.isNaN(Number(fromMetrics))) return Number(fromMetrics);
    return resolveLongestFrontageM(detail ?? sectionData ?? undefined);
  }, [metrics?.longest_frontage_length_m, detail, sectionData]);

  const cornerCount = metrics?.corner_count ?? detail?.road_v2_frontage?.corner_count;
  const cornerNote =
    (isRoadV2 && metrics?.corner_note ? String(metrics.corner_note).trim() : '') || '';

  useEffect(() => {
    if (listingProLocked || !isRoadV2 || !Number.isFinite(snapshotId) || snapshotId <= 0) return;
    if (diagramFetchedForRef.current === snapshotId) return;
    diagramFetchedForRef.current = snapshotId;
    let cancelled = false;
    setDiagramLoading(true);
    setDiagramError(null);
    getPortalRoadDiagram(snapshotId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data?.svg) {
          setDiagramSvg(String(res.data.svg));
        } else {
          setDiagramError(res.error || 'Yol diyagramı oluşturulamadı');
          diagramFetchedForRef.current = null;
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDiagramError(e instanceof Error ? e.message : 'Yol diyagramı oluşturulamadı');
          diagramFetchedForRef.current = null;
        }
      })
      .finally(() => {
        if (!cancelled) setDiagramLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [snapshotId, listingProLocked, isRoadV2]);

  if (listingProLocked) {
    return (
      <View ref={sectionRef} style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="trail-sign-outline" size={16} color={COLORS.accentBlue} />
          <Text style={styles.cardTitle}>Yol</Text>
        </View>
        <View style={styles.lockedBox}>
          <Text style={styles.lockedText}>
            <Text style={styles.lockedStrong}>Pro Sorgu</Text>
            {' '}ile açıldığında yol analizi ve cephe diyagramı görünür.
          </Text>
        </View>
      </View>
    );
  }

  if (sectionLoading && !sectionData) {
    return (
      <View ref={sectionRef} style={styles.card}>
        <ActivityIndicator size="small" color={COLORS.accentBlue} />
        <Text style={styles.emptyText}>Yol verisi yükleniyor…</Text>
      </View>
    );
  }

  if (sectionError && !sectionData) {
    return (
      <View ref={sectionRef} style={styles.card}>
        <Text style={styles.errorText}>{sectionError}</Text>
      </View>
    );
  }

  return (
    <View ref={sectionRef}>
      <View style={[styles.card, styles.heroCard]}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="trail-sign-outline" size={16} color={COLORS.accentBlue} />
          <Text style={styles.cardTitle}>Yol</Text>
        </View>

        <RoadHeroGrid
          cornerCount={cornerCount}
          cornerNote={cornerNote}
          importantM={heroImportantM}
          longestM={heroLongestM}
          isRoadV2={isRoadV2}
        />

        {metrics?.coarse_fallback_used ? (
          <Text style={styles.fallbackNote}>Kaba yol yaklaşımı kullanıldı.</Text>
        ) : null}

        <MetricCards metrics={metrics} isRoadV2={isRoadV2} />
      </View>

      <View style={[styles.card, styles.diagramCard]}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="map-outline" size={16} color={COLORS.accentBlue} />
          <Text style={styles.cardTitle}>Yol ve cephe diyagramı</Text>
        </View>

        {!isRoadV2 ? (
          <Text style={styles.emptyText}>Bu sorgu RoadV2 verisi içermiyor.</Text>
        ) : diagramLoading ? (
          <View style={styles.diagramPlaceholder}>
            <ActivityIndicator size="small" color={COLORS.accentBlue} />
            <Text style={styles.emptyText}>Diyagram oluşturuluyor…</Text>
          </View>
        ) : diagramError ? (
          <Text style={styles.errorText}>{diagramError}</Text>
        ) : diagramSvg ? (
          <RoadSvgViewer svg={diagramSvg} />
        ) : (
          <Text style={styles.emptyText}>Diyagram verisi yok.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.pageBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  heroCard: {
    backgroundColor: COLORS.heroBg,
  },
  diagramCard: {
    marginTop: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  heroGrid: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'stretch',
  },
  heroBlock: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  heroLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.accentBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginBottom: 4,
    lineHeight: 10,
  },
  heroValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  heroNote: {
    fontSize: 8,
    color: COLORS.textSecondary,
    lineHeight: 11,
  },
  fallbackNote: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 8,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '47%',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ffffff',
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
  diagramFrame: {
    height: DIAGRAM_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: '#ffffff',
  },
  diagramWebView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  diagramPlaceholder: {
    height: DIAGRAM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    lineHeight: 20,
  },
  lockedBox: {
    paddingVertical: 4,
  },
  lockedText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  lockedStrong: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
