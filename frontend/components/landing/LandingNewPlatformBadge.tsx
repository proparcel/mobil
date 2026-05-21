import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { landingColors } from './landingTheme';

export function LandingNewPlatformBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>YENİ PLATFORM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(57, 223, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(57, 223, 255, 0.4)',
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: landingColors.cyanBright,
  },
});
