/**
 * Yol Çiz modunda altta gösterilen hızlı seçim paneli.
 * Dikey, Yatay, Kenar, Çiz butonları. DrawBar (RoadModeBar) sadece Çiz seçilince gösterilir.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { parcelSplitTheme } from "./theme";
import type { RoadDrawSubMode } from "../../../src/types/parcelSplit";

const PANEL_HEIGHT = 48;

type Props = {
  roadDrawSubMode: RoadDrawSubMode;
  onSelectSubMode: (mode: RoadDrawSubMode) => void;
};

export const ROAD_QUICK_PANEL_HEIGHT_PX = PANEL_HEIGHT;

export function RoadQuickPanel({
  roadDrawSubMode,
  onSelectSubMode,
}: Props) {
  const isActive = (m: RoadDrawSubMode) => roadDrawSubMode === m;
  const btn = (mode: RoadDrawSubMode, label: string, icon: React.ComponentProps<typeof Ionicons>["name"]) => (
    <TouchableOpacity
      key={mode}
      style={[styles.btn, isActive(mode) && styles.btnActive]}
      onPress={() => onSelectSubMode(mode)}
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={18}
        color={isActive(mode) ? parcelSplitTheme.accentBlue : parcelSplitTheme.textMuted}
      />
      <Text style={[styles.btnText, isActive(mode) && styles.btnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.panel, { height: PANEL_HEIGHT }]}>
      {btn("vertical", "Dikey", "swap-vertical-outline")}
      {btn("horizontal", "Yatay", "swap-horizontal-outline")}
      {btn("edge", "Kenar", "git-branch-outline")}
      {btn("freehand", "Çiz", "pencil-outline")}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: parcelSplitTheme.cardBg,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  btnActive: {
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  btnText: {
    fontSize: 12,
    fontWeight: "600",
    color: parcelSplitTheme.textMuted,
  },
  btnTextActive: {
    color: parcelSplitTheme.accentBlue,
  },
});
