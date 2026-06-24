import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";

type Props = {
  message: string;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
};

export function StatusErrorPanel({ message, style }: Props) {
  const text = String(message || "").trim();
  if (!text) return null;

  return (
    <View style={[styles.panel, style]} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={20} color={DRONE_SETTINGS_THEME.errorText} />
      <Text style={styles.text} numberOfLines={2}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: DRONE_SETTINGS_THEME.errorBg,
    borderWidth: 1,
    borderColor: DRONE_SETTINGS_THEME.errorBorder,
  },
  text: {
    flex: 1,
    color: DRONE_SETTINGS_THEME.errorText,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
});
