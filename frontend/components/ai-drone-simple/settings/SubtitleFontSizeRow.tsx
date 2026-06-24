import React, { useCallback } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";

const SUBTITLE_FONT_SIZE = {
  min: 12,
  max: 56,
  step: 2,
  inputHeight: 32,
} as const;

type Props = {
  value: number;
  onChange: (fontSize: number) => void;
  disabled?: boolean;
  showTopBorder?: boolean;
};

function clampFontSize(raw: number): number {
  const rounded = Math.round(raw);
  return Math.max(
    SUBTITLE_FONT_SIZE.min,
    Math.min(SUBTITLE_FONT_SIZE.max, rounded),
  );
}

export function SubtitleFontSizeRow({
  value,
  onChange,
  disabled = false,
  showTopBorder = true,
}: Props) {
  const safeValue = clampFontSize(value);

  const bump = useCallback(
    (delta: number) => {
      if (disabled) return;
      onChange(clampFontSize(safeValue + delta));
    },
    [disabled, onChange, safeValue],
  );

  const onInputChange = useCallback(
    (text: string) => {
      if (disabled) return;
      const digits = String(text || "").replace(/[^\d]/g, "");
      if (!digits) return;
      onChange(clampFontSize(Number(digits)));
    },
    [disabled, onChange],
  );

  return (
    <View style={[styles.wrap, showTopBorder && styles.wrapBorder]}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="text-outline" size={16} color={DRONE_SETTINGS_THEME.iconColor} />
        </View>
        <Text style={styles.label}>Font Size</Text>
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.stepBtn, disabled && styles.stepBtnDisabled]}
            onPress={() => bump(-SUBTITLE_FONT_SIZE.step)}
            disabled={disabled || safeValue <= SUBTITLE_FONT_SIZE.min}
            accessibilityLabel="Font boyutunu küçült"
          >
            <Ionicons name="remove" size={18} color={DRONE_SETTINGS_THEME.secondaryBtnText} />
          </TouchableOpacity>
          <View style={[styles.inputWrap, disabled && styles.inputDisabled]}>
            <TextInput
              style={styles.input}
              value={String(safeValue)}
              onChangeText={onInputChange}
              keyboardType="number-pad"
              maxLength={2}
              editable={!disabled}
              selectTextOnFocus
              includeFontPadding={false}
              textAlignVertical="center"
              accessibilityLabel="Altyazı font boyutu"
            />
          </View>
          <TouchableOpacity
            style={[styles.stepBtn, disabled && styles.stepBtnDisabled]}
            onPress={() => bump(SUBTITLE_FONT_SIZE.step)}
            disabled={disabled || safeValue >= SUBTITLE_FONT_SIZE.max}
            accessibilityLabel="Font boyutunu büyüt"
          >
            <Ionicons name="add" size={18} color={DRONE_SETTINGS_THEME.secondaryBtnText} />
          </TouchableOpacity>
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
  label: {
    flex: 1,
    color: DRONE_SETTINGS_THEME.label,
    fontSize: 14,
    fontWeight: "600",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DRONE_SETTINGS_THEME.secondaryBtnBorder,
    backgroundColor: DRONE_SETTINGS_THEME.secondaryBtnBg,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: {
    opacity: 0.45,
  },
  inputWrap: {
    width: 36,
    height: SUBTITLE_FONT_SIZE.inputHeight,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: DRONE_SETTINGS_THEME.panelBorder,
    backgroundColor: "#081827",
    alignItems: "center",
    justifyContent: "center",
  },
  inputDisabled: {
    opacity: 0.45,
  },
  input: {
    width: "100%",
    height: SUBTITLE_FONT_SIZE.inputHeight,
    color: DRONE_SETTINGS_THEME.label,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 0,
    paddingVertical: 0,
    margin: 0,
    backgroundColor: "transparent",
    ...(Platform.OS === "android"
      ? {
          textAlignVertical: "center",
          lineHeight: SUBTITLE_FONT_SIZE.inputHeight,
        }
      : {
          lineHeight: SUBTITLE_FONT_SIZE.inputHeight,
          paddingTop: 0,
          paddingBottom: 0,
        }),
  },
});
