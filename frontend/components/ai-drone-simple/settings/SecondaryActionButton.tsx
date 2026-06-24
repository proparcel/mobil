import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";

type Props = {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SecondaryActionButton({
  label,
  icon = "image-outline",
  onPress,
  disabled = false,
  loading = false,
  style,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={DRONE_SETTINGS_THEME.secondaryBtnText} size="small" />
      ) : (
        <>
          <Ionicons name={icon as any} size={16} color={DRONE_SETTINGS_THEME.secondaryBtnText} />
          <Text style={styles.text}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 40,
    borderRadius: 10,
    backgroundColor: DRONE_SETTINGS_THEME.secondaryBtnBg,
    borderWidth: 1,
    borderColor: DRONE_SETTINGS_THEME.secondaryBtnBorder,
    paddingHorizontal: 14,
  },
  btnDisabled: { opacity: 0.55 },
  text: {
    color: DRONE_SETTINGS_THEME.secondaryBtnText,
    fontWeight: "700",
    fontSize: 13,
  },
});
