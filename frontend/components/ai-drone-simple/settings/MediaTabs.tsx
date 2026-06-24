import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";

export type MediaTabId = "video" | "narration" | "music";

export type MediaTabDef = {
  id: MediaTabId;
  label: string;
  icon: string;
};

type Props = {
  tabs: readonly MediaTabDef[];
  activeId: MediaTabId;
  onChange: (id: MediaTabId) => void;
};

const TAB_GAP = 4;
const TAB_HEIGHT = 40;

export function MediaTabs({ tabs, activeId, onChange }: Props) {
  return (
    <View style={styles.container}>
      {tabs.map((tab, index) => {
        const active = tab.id === activeId;
        return (
          <View
            key={tab.id}
            style={[styles.tabSlot, index > 0 && styles.tabSlotSpaced]}
          >
            <TouchableOpacity
              style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}
              onPress={() => onChange(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              activeOpacity={0.85}
            >
              <Ionicons
                name={tab.icon as any}
                size={15}
                color={active ? DRONE_SETTINGS_THEME.tabActiveText : DRONE_SETTINGS_THEME.tabInactiveText}
              />
              <Text
                style={[styles.tabText, active && styles.tabTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DRONE_SETTINGS_THEME.tabContainerBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DRONE_SETTINGS_THEME.tabInactiveBorder,
    padding: TAB_GAP,
    marginTop: 12,
    marginBottom: 8,
  },
  tabSlot: {
    flex: 1,
    minWidth: 0,
  },
  tabSlotSpaced: {
    marginLeft: TAB_GAP,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: TAB_HEIGHT,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  tabInactive: {
    backgroundColor: DRONE_SETTINGS_THEME.tabInactiveBg,
    borderColor: DRONE_SETTINGS_THEME.tabInactiveBorder,
  },
  tabActive: {
    backgroundColor: DRONE_SETTINGS_THEME.tabActiveBg,
    borderColor: DRONE_SETTINGS_THEME.tabActiveBorder,
  },
  tabText: {
    color: DRONE_SETTINGS_THEME.tabInactiveText,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  tabTextActive: {
    color: DRONE_SETTINGS_THEME.tabActiveText,
  },
});
