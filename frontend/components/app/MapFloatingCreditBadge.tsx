import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  testID?: string;
};

const BADGE_HEIGHT = 34;
const HALF_OVERLAP = BADGE_HEIGHT / 2;

export function MapFloatingCreditBadge({ label, onPress, testID }: Props) {
  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        activeOpacity={0.82}
        accessibilityLabel="Kredi bakiyesi"
        style={styles.pill}
      >
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const MAP_FLOATING_CREDIT_BADGE_OVERLAP = HALF_OVERLAP;

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: -HALF_OVERLAP,
    left: 0,
    right: 0,
    zIndex: 200,
    alignItems: 'center',
    ...(Platform.OS === 'android' ? { elevation: 24 } : {}),
  },
  pill: {
    height: BADGE_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    ...(Platform.OS === 'android' ? { elevation: 8 } : {}),
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
