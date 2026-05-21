import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LANDING_CAPABILITIES, type LandingCapabilityId } from './landingCapabilities';
import { LandingGlassCard } from './LandingGlassCard';
import { landingColors, landingRadii } from './landingTheme';

export type { LandingCapabilityId as LandingFeatureId };

const CARD_WIDTH = (Dimensions.get('window').width - 20 * 2 - 12) / 2;

type Props = {
  onFeaturePress: (id: LandingCapabilityId) => void;
};

export function LandingFeatureGrid({ onFeaturePress }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Yapabilecekleriniz</Text>
      <View style={styles.grid}>
        {LANDING_CAPABILITIES.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.9}
            onPress={() => onFeaturePress(item.id)}
            style={styles.cardTouch}
          >
            <LandingGlassCard style={styles.featureCard}>
              <View style={[styles.iconWrap, { backgroundColor: `${item.iconColor}22` }]}>
                <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={3}>
                {item.description}
              </Text>
              <View style={styles.arrow}>
                <Ionicons name="arrow-forward" size={14} color={landingColors.textSoft} />
              </View>
            </LandingGlassCard>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: landingColors.text,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardTouch: {
    width: CARD_WIDTH,
  },
  featureCard: {
    minHeight: 170,
    borderRadius: landingRadii.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: landingColors.text,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: landingColors.textMuted,
    paddingRight: 28,
  },
  arrow: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
