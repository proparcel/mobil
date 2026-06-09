import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { InsightRiskChip } from '../../src/utils/portalInsightHelpers';

const METRIC_ICON: Record<InsightRiskChip['key'], string> = {
  ramsar: 'water-outline',
  hv: 'flash-outline',
  slope: 'trending-up-outline',
  imar: 'business-outline',
  'quarter-center': 'location-outline',
};

type Props = {
  chip: InsightRiskChip;
  loading?: boolean;
  mapActive?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function PortalInsightMetricChip({ chip, loading, mapActive, onPress, style }: Props) {
  const isQuarterCenter = chip.key === 'quarter-center';
  const displayValue = isQuarterCenter && loading ? 'Yükleniyor…' : chip.value;
  const iconName = METRIC_ICON[chip.key] || 'ellipse-outline';

  const content = (
    <>
      <View style={[styles.iconWrap, chip.risk && styles.iconWrapAlert]}>
        <Ionicons name={iconName} size={15} color={chip.risk ? '#c2410c' : '#2563eb'} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {chip.label}
        </Text>
        <Text style={[styles.value, chip.risk && styles.valueAlert]} numberOfLines={2}>
          {displayValue}
        </Text>
      </View>
    </>
  );

  const cardStyle = [
    styles.card,
    chip.risk && styles.cardAlert,
    mapActive && styles.cardMapActive,
    style,
  ];

  if (isQuarterCenter && onPress) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyle, pressed && styles.cardPressed]}
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityState={{ selected: mapActive, busy: loading }}
        accessibilityLabel={`${chip.label}: ${displayValue}. Haritada mahalle merkezi çizgisini aç veya kapat.`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} accessibilityLabel={`${chip.label}: ${displayValue}`}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f5f9ff',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  cardAlert: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  cardMapActive: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  cardPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    flexShrink: 0,
  },
  iconWrapAlert: {
    backgroundColor: '#ffedd5',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
    marginBottom: 3,
    lineHeight: 12,
  },
  value: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 15,
  },
  valueAlert: {
    color: '#9a3412',
  },
});
