import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";
import { CompactSwitch } from "./CompactSwitch";

export type PairedToggleConfig = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

type Props = {
  icon?: string;
  left: PairedToggleConfig;
  right: PairedToggleConfig;
  showTopBorder?: boolean;
};

export function PairedToggleRow({ icon, left, right, showTopBorder = true }: Props) {
  return (
    <View style={[styles.wrap, showTopBorder && styles.wrapBorder]}>
      <View style={styles.row}>
        {icon ? (
          <View style={styles.iconWrap}>
            <Ionicons name={icon as any} size={16} color={DRONE_SETTINGS_THEME.iconColor} />
          </View>
        ) : null}
        <View style={styles.paired}>
          <View style={styles.toggleItem}>
            <Text style={styles.label} numberOfLines={1}>{left.label}</Text>
            <CompactSwitch
              value={left.value}
              onValueChange={left.onValueChange}
              disabled={left.disabled}
              accessibilityLabel={left.label}
            />
          </View>
          <View style={styles.toggleItem}>
            <Text
              style={[styles.label, right.disabled && styles.labelMuted]}
              numberOfLines={1}
            >
              {right.label}
            </Text>
            <CompactSwitch
              value={right.value}
              onValueChange={right.onValueChange}
              disabled={right.disabled}
              accessibilityLabel={right.label}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  wrapBorder: {
    borderTopWidth: 1,
    borderTopColor: DRONE_SETTINGS_THEME.panelRowBorder,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DRONE_SETTINGS_THEME.iconBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  paired: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
  },
  toggleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  label: {
    color: DRONE_SETTINGS_THEME.label,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  labelMuted: {
    opacity: 0.45,
  },
});
