import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";

type Props = {
  creditCost: number | null;
  creditLoading?: boolean;
  removed: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function ProparcelLabelRemovalCard({
  creditCost,
  creditLoading = false,
  removed,
  disabled = false,
  onPress,
}: Props) {
  const costText =
    creditLoading
      ? "Kredi bilgisi yükleniyor…"
      : creditCost != null
        ? `${creditCost} Tepe Kredi`
        : "Kredi bilgisi alınamadı";

  return (
    <TouchableOpacity
      style={[styles.card, removed && styles.cardRemoved, disabled && styles.cardDisabled]}
      onPress={onPress}
      disabled={disabled || removed}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || removed }}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={removed ? "checkmark-circle-outline" : "pricetag-outline"}
          size={16}
          color={removed ? "#86efac" : DRONE_SETTINGS_THEME.iconColor}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>ProParcel Etiketini Kaldır</Text>
        <Text style={[styles.subtitle, removed && styles.subtitleRemoved]}>
          {removed ? "Etiket önizleme ve dışa aktarımdan kaldırıldı" : costText}
        </Text>
      </View>
      {creditLoading ? (
        <ActivityIndicator size="small" color={DRONE_SETTINGS_THEME.secondaryBtnText} />
      ) : removed ? null : (
        <Ionicons name="chevron-forward" size={18} color={DRONE_SETTINGS_THEME.tabInactiveText} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DRONE_SETTINGS_THEME.panelBorder,
    backgroundColor: DRONE_SETTINGS_THEME.panelBg,
  },
  cardRemoved: {
    borderColor: "rgba(34, 197, 94, 0.35)",
    backgroundColor: "rgba(22, 101, 52, 0.12)",
  },
  cardDisabled: {
    opacity: 0.55,
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
  },
  title: {
    color: DRONE_SETTINGS_THEME.label,
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    color: DRONE_SETTINGS_THEME.description,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  subtitleRemoved: {
    color: "#86efac",
  },
});
