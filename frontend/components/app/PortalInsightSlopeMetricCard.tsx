import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { resolveInsightSlopeMetricVariant } from '../../src/utils/portalInsightHelpers';
import PortalSlopeTerrainCard from './PortalSlopeTerrainCard';
import { INSIGHT_GRID_CARD_HEIGHT } from './portalInsightMetricLayout';

type Props = {
  slopePct: number | null;
  onPress?: () => void;
  style?: object;
};

export default function PortalInsightSlopeMetricCard({ slopePct, onPress, style }: Props) {
  const variant = resolveInsightSlopeMetricVariant(slopePct);

  const cardStyle = [
    styles.card,
    variant === 'danger' && styles.cardDanger,
    variant === 'alert' && styles.cardAlert,
    style,
  ];

  const content = (
    <View style={styles.inner}>
      <PortalSlopeTerrainCard slope={slopePct} embedded />
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyle, pressed && styles.cardPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Eğim kartı. Parsel Morfoloji sekmesini aç."
      >
        {content}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignSelf: 'stretch',
    height: INSIGHT_GRID_CARD_HEIGHT,
    minWidth: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f5f9ff',
    overflow: 'hidden',
  },
  cardAlert: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  cardDanger: {
    borderColor: '#f87171',
    backgroundColor: '#fef2f2',
  },
  cardPressed: {
    opacity: 0.88,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
});
