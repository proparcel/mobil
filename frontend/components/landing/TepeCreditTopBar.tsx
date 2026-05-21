import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { proparcelFavicon } from './proparcelBrandAssets';
import { tepeCreditColors } from './tepeCreditTheme';

type Props = {
  onBack: () => void;
  onHelp?: () => void;
  /** Varsayılan: Tepe Kredi */
  title?: string;
};

export function TepeCreditTopBar({ onBack, onHelp, title = 'Tepe Kredi' }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={onBack}
        accessibilityLabel="Geri"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={22} color={tepeCreditColors.text} />
      </TouchableOpacity>

      <View style={styles.center}>
        <Image source={proparcelFavicon} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{title}</Text>
      </View>

      <TouchableOpacity
        style={styles.iconBtn}
        onPress={onHelp}
        accessibilityLabel="Yardım"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="help-circle-outline" size={24} color={tepeCreditColors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    minHeight: 72,
    backgroundColor: 'rgba(7, 17, 31, 0.4)',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 23, 48, 0.65)',
    borderWidth: 1,
    borderColor: tepeCreditColors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 28,
    height: 28,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: tepeCreditColors.text,
  },
});
