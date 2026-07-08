import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import {
  formatSlopePercentLabel,
  getMobilityHints,
  getSlopeHeatColor,
  getSlopeHillPoints,
  getSlopeInfo,
} from '../../src/utils/slopeTerrainHelpers';
import { INSIGHT_GRID_CARD_HEIGHT } from './portalInsightMetricLayout';

export type PortalSlopeTerrainCardProps = {
  slope?: number | null;
  variant?: 'default' | 'compact';
  /** Genel özet grid içinde — tam genişlik, dış kart sınırı yok */
  embedded?: boolean;
};

const TERRAIN_H = 92;
const GROUND_H = 14;
const HILL_H = TERRAIN_H - GROUND_H;

export default function PortalSlopeTerrainCard({
  slope,
  variant = 'default',
  embedded = false,
}: PortalSlopeTerrainCardProps) {
  const compact = variant === 'compact' || embedded;
  const info = useMemo(() => getSlopeInfo(slope ?? null), [slope]);
  const color = useMemo(() => getSlopeHeatColor(slope ?? null), [slope]);
  const hints = useMemo(() => getMobilityHints(slope ?? null), [slope]);
  const hillPoints = useMemo(() => getSlopeHillPoints(slope ?? null), [slope]);
  const valueLabel = formatSlopePercentLabel(slope ?? null);

  const iconIsCar = /araba/i.test(info.iconUri);
  const iconIsTractor = /traktor/i.test(info.iconUri);
  const iconLarge = iconIsCar || iconIsTractor;

  const terrainH = embedded ? INSIGHT_GRID_CARD_HEIGHT - 8 : compact ? 68 : TERRAIN_H;
  const groundH = embedded ? 12 : GROUND_H;
  const hillH = terrainH - groundH;

  return (
    <View style={[styles.card, compact && styles.cardCompact, embedded && styles.cardEmbedded]}>
      {!embedded ? (
        <View style={[styles.header, compact && styles.headerCompact]}>
          <Text style={[styles.title, compact && styles.titleCompact]}>Eğim</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.terrainArea,
          { height: terrainH },
          compact && styles.terrainAreaCompact,
          embedded && styles.terrainAreaEmbedded,
        ]}
        accessibilityRole="image"
        accessibilityLabel={`Eğim ${valueLabel}. ${info.desc}. Arazi kesiti.`}
      >
        <View style={styles.sky} />
        <View style={[styles.hillWrap, { height: hillH, bottom: groundH }]}>
          <Svg width="100%" height={hillH} viewBox={`0 0 100 ${HILL_H}`} preserveAspectRatio="none">
            <Polygon points={hillPoints} fill={color} />
          </Svg>
          <View style={styles.hillHighlight} pointerEvents="none" />
        </View>
        <View style={[styles.ground, { height: groundH }]} />
        <View
          style={[
            styles.textOverlay,
            compact && styles.textOverlayCompact,
            embedded && styles.textOverlayEmbedded,
            iconLarge && !embedded && styles.textOverlayLargeIcon,
            iconLarge && embedded && styles.textOverlayEmbeddedLargeIcon,
          ]}
        >
          <View style={[styles.textOverlayInner, compact && styles.textOverlayInnerCompact, embedded && styles.textOverlayInnerEmbedded]}>
            {embedded ? (
              <Text style={styles.titleEmbedded} numberOfLines={1}>
                Eğim
              </Text>
            ) : null}
            <Text style={[styles.value, compact && styles.valueCompact, embedded && styles.valueEmbedded]}>{valueLabel}</Text>
            <Text style={[styles.desc, compact && styles.descCompact, embedded && styles.descEmbedded]} numberOfLines={2}>
              {info.desc}
            </Text>
          </View>
        </View>
        <Image
          source={{ uri: info.iconUri }}
          style={[
            styles.icon,
            compact && styles.iconCompact,
            embedded && styles.iconEmbedded,
            iconLarge && !embedded && styles.iconLarge,
            iconLarge && embedded && styles.iconEmbeddedLarge,
            iconIsCar && styles.iconCarOffset,
            iconIsTractor && styles.iconTractorOffset,
          ]}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      {!compact ? (
        <View style={styles.hints}>
          <View style={styles.hintRow}>
            <Text style={styles.hintEmoji}>🚶</Text>
            <Text style={styles.hintText}>
              Yürüyüş: <Text style={styles.hintStrong}>{hints.walk}</Text>
            </Text>
          </View>
          <View style={[styles.hintRow, styles.hintRowBorder]}>
            <Text style={styles.hintEmoji}>🚗</Text>
            <Text style={styles.hintText}>
              Araç: <Text style={styles.hintStrong}>{hints.car}</Text>
            </Text>
          </View>
          <View style={[styles.hintRow, styles.hintRowBorder]}>
            <Text style={styles.hintEmoji}>🚜</Text>
            <Text style={styles.hintText}>
              İş makinesi: <Text style={styles.hintStrong}>{hints.tractor}</Text>
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  cardCompact: {
    maxWidth: undefined,
  },
  cardEmbedded: {
    flex: 1,
    width: '100%',
    maxWidth: undefined,
    alignSelf: 'stretch',
  },
  header: {
    alignItems: 'center',
    marginBottom: 6,
  },
  headerCompact: {
    marginBottom: 4,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  titleCompact: {
    fontSize: 10,
  },
  terrainArea: {
    position: 'relative',
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  terrainAreaCompact: {
    borderRadius: 8,
  },
  terrainAreaEmbedded: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  sky: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e0f2fe',
    opacity: 0.55,
  },
  hillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: GROUND_H,
    zIndex: 1,
  },
  hillHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    backgroundColor: '#64748b',
  },
  textOverlay: {
    position: 'absolute',
    left: 6,
    top: 6,
    right: 54,
    zIndex: 4,
  },
  textOverlayCompact: {
    right: 72,
  },
  textOverlayEmbedded: {
    left: 4,
    top: 4,
    right: 58,
  },
  textOverlayEmbeddedLargeIcon: {
    right: 66,
  },
  textOverlayLargeIcon: {
    right: 104,
  },
  textOverlayInner: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  textOverlayInnerCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  textOverlayInnerEmbedded: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  titleEmbedded: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  valueCompact: {
    fontSize: 17,
  },
  valueEmbedded: {
    fontSize: 15,
  },
  desc: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 16,
  },
  descCompact: {
    fontSize: 10,
    marginTop: 2,
  },
  descEmbedded: {
    fontSize: 11,
    marginTop: 1,
  },
  icon: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 44,
    height: 52,
    zIndex: 3,
  },
  iconCompact: {
    width: 40,
    height: 48,
    right: 22,
    top: 10,
  },
  iconEmbedded: {
    width: 44,
    height: 52,
    right: 4,
    top: 10,
    zIndex: 5,
  },
  iconEmbeddedLarge: {
    width: 56,
    height: 64,
    right: 2,
    top: 6,
    zIndex: 5,
  },
  iconLarge: {
    width: 66,
    height: 76,
    right: 2,
    top: 2,
  },
  iconCarOffset: {},
  iconTractorOffset: {},
  hints: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 2,
  },
  hintRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.45)',
    marginTop: 3,
    paddingTop: 5,
  },
  hintEmoji: {
    width: 18,
    textAlign: 'center',
    fontSize: 13,
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  hintStrong: {
    fontWeight: '700',
    color: '#0f172a',
  },
});
