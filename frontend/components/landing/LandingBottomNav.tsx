import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { landingColors, landingRadii } from './landingTheme';

export type LandingNavTab = 'home' | 'earn' | 'usage' | 'map';

type TabDef = {
  id: LandingNavTab;
  label: string;
  icon: string;
  iconActive: string;
  accessibilityLabel: string;
};

const TABS: TabDef[] = [
  {
    id: 'home',
    label: 'Ana Sayfa',
    icon: 'home-outline',
    iconActive: 'home',
    accessibilityLabel: 'Ana sayfa',
  },
  {
    id: 'earn',
    label: 'Kazanım',
    icon: 'gift-outline',
    iconActive: 'gift',
    accessibilityLabel: 'Kredi kazanım şansları',
  },
  {
    id: 'usage',
    label: 'Kullanım',
    icon: 'wallet-outline',
    iconActive: 'wallet',
    accessibilityLabel: 'Kredi kullanım alanları',
  },
  {
    id: 'map',
    label: 'Harita',
    icon: 'map-outline',
    iconActive: 'map',
    accessibilityLabel: 'Harita ana sayfa',
  },
];

type Props = {
  active: LandingNavTab;
  onTabPress: (tab: LandingNavTab) => void;
};

export function LandingBottomNav({ active, onTabPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.item}
              onPress={() => onTabPress(tab.id)}
              activeOpacity={0.85}
              accessibilityLabel={tab.accessibilityLabel}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Ionicons
                  name={(isActive ? tab.iconActive : tab.icon) as any}
                  size={22}
                  color={isActive ? landingColors.cyanBright : landingColors.textSoft}
                />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(8, 23, 48, 0.82)',
    borderRadius: landingRadii.nav,
    borderWidth: 1,
    borderColor: landingColors.borderGlass,
    paddingVertical: 10,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 12 },
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  iconWrap: {
    padding: 4,
  },
  iconWrapActive: {
    shadowColor: landingColors.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    color: landingColors.textSoft,
    textAlign: 'center',
  },
  labelActive: {
    color: landingColors.cyanBright,
    fontWeight: '700',
  },
});
