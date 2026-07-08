import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PortalQueryDetail } from '../../src/types/portal';
import {
  resolveInsightMorphologyType,
  resolveInsightMorphologyVariant,
  resolvePortalMorphologyLabel,
} from '../../src/utils/portalInsightHelpers';
import { INSIGHT_GRID_CARD_HEIGHT } from './portalInsightMetricLayout';

type Props = {
  detail: PortalQueryDetail;
  slopeSection?: Record<string, unknown> | null;
  onPress?: () => void;
  style?: object;
};

export default function PortalInsightMorphologyMetricCard({
  detail,
  slopeSection,
  onPress,
  style,
}: Props) {
  const morphologyLabel = useMemo(
    () => resolvePortalMorphologyLabel(detail, slopeSection),
    [detail, slopeSection],
  );
  const morphologyType = useMemo(
    () => resolveInsightMorphologyType(detail, slopeSection),
    [detail, slopeSection],
  );
  const variant = resolveInsightMorphologyVariant(morphologyType);

  const cardStyle = [
    styles.card,
    variant === 'alert' && styles.cardAlert,
    style,
  ];

  const content = (
    <>
      <View style={[styles.iconWrap, variant === 'alert' && styles.iconWrapAlert]}>
        <Ionicons name="layers-outline" size={15} color={variant === 'alert' ? '#c2410c' : '#2563eb'} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          Morfolojik Tip
        </Text>
        <Text style={[styles.value, variant === 'alert' && styles.valueAlert]} numberOfLines={2}>
          {morphologyLabel}
        </Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyle, pressed && styles.cardPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Morfolojik tip ${morphologyLabel}. Parsel Morfoloji sekmesini aç.`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} accessibilityLabel={`Morfolojik tip ${morphologyLabel}.`}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignSelf: 'stretch',
    height: INSIGHT_GRID_CARD_HEIGHT,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f5f9ff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardAlert: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  cardPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 32,
    height: 32,
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
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
    marginBottom: 4,
    lineHeight: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
  },
  valueAlert: {
    color: '#9a3412',
  },
});
