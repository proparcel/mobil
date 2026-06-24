import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";
import { CompactSwitch } from "./CompactSwitch";
import { SecondaryActionButton } from "./SecondaryActionButton";

export type SettingRowConfig = {
  key: string;
  icon: string;
  label: string;
  description?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  switchDisabled?: boolean;
  secondaryAction?: {
    label: string;
    icon?: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    visible?: boolean;
  };
};

type Props = {
  row: SettingRowConfig;
  showTopBorder?: boolean;
};

export function SettingRow({ row, showTopBorder = true }: Props) {
  const hasSwitch = typeof row.value === "boolean" && row.onValueChange;

  return (
    <View style={[styles.wrap, showTopBorder && styles.wrapBorder]}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name={row.icon as any} size={16} color={DRONE_SETTINGS_THEME.iconColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.label} numberOfLines={2}>{row.label}</Text>
          {row.description ? (
            <Text style={styles.description}>{row.description}</Text>
          ) : null}
        </View>
        {hasSwitch ? (
          <CompactSwitch
            value={row.value!}
            onValueChange={row.onValueChange!}
            disabled={row.switchDisabled}
            accessibilityLabel={row.label}
          />
        ) : null}
      </View>
      {row.secondaryAction?.visible ? (
        <SecondaryActionButton
          label={row.secondaryAction.label}
          icon={row.secondaryAction.icon}
          onPress={row.secondaryAction.onPress}
          disabled={row.secondaryAction.disabled}
          loading={row.secondaryAction.loading}
          style={styles.secondaryBtn}
        />
      ) : null}
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
  textWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  label: {
    color: DRONE_SETTINGS_THEME.label,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  description: {
    color: DRONE_SETTINGS_THEME.description,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  secondaryBtn: {
    marginTop: 10,
  },
});
