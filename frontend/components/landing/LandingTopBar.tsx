import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { proparcelFavicon } from './proparcelBrandAssets';
import { landingColors } from './landingTheme';

type Props = {
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
};

export function LandingTopBar({ onMenuPress, onNotificationsPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={onMenuPress}
        accessibilityLabel="Menü"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="menu" size={26} color={landingColors.text} />
      </TouchableOpacity>

      <View style={styles.logoWrap}>
        <View style={styles.logoOrb}>
          <Image
            source={proparcelFavicon}
            style={styles.logoImage}
            resizeMode="cover"
            accessibilityLabel="ProParcel"
          />
        </View>
        <Text style={styles.logoText}>ProParcel</Text>
      </View>

      <TouchableOpacity
        style={styles.iconBtn}
        onPress={onNotificationsPress}
        accessibilityLabel="Bildirimler"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="notifications-outline" size={24} color={landingColors.text} />
        <View style={styles.notifDot} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    minHeight: 72,
    backgroundColor: 'rgba(8, 17, 32, 0.35)',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(8, 26, 55, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(57, 223, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: landingColors.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: landingColors.text,
    letterSpacing: 0.3,
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: landingColors.electricBlue,
    borderWidth: 1.5,
    borderColor: landingColors.bgDeep,
  },
});
