import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import Ionicons from "react-native-vector-icons/Ionicons";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";

type Props = {
  value: number;
  onChange: (volume: number) => void;
  disabled?: boolean;
};

function clampVolume(raw: number): number {
  const vol = Number(raw);
  if (!Number.isFinite(vol)) return 45;
  return Math.max(0, Math.min(100, Math.round(vol)));
}

export function DroneMusicVolumeRow({ value, onChange, disabled = false }: Props) {
  const safeValue = clampVolume(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="volume-medium-outline" size={16} color={DRONE_SETTINGS_THEME.iconColor} />
        </View>
        <Text style={styles.label}>Müzik sesi</Text>
        <Text style={styles.value}>{safeValue}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={safeValue}
        onValueChange={(next) => {
          if (disabled) return;
          onChange(clampVolume(next));
        }}
        disabled={disabled}
        minimumTrackTintColor={DRONE_SETTINGS_THEME.switchTrackOn}
        maximumTrackTintColor={DRONE_SETTINGS_THEME.switchTrackOff}
        thumbTintColor={DRONE_SETTINGS_THEME.switchThumbOn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: DRONE_SETTINGS_THEME.panelRowBorder,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DRONE_SETTINGS_THEME.iconBg,
  },
  label: {
    flex: 1,
    color: DRONE_SETTINGS_THEME.label,
    fontSize: 14,
    fontWeight: "600",
  },
  value: {
    color: DRONE_SETTINGS_THEME.secondaryBtnText,
    fontSize: 14,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "right",
  },
  slider: {
    width: "100%",
    height: 32,
  },
});
