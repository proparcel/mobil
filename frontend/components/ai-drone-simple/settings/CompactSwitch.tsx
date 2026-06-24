import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";

export const COMPACT_SWITCH_SIZE = {
  width: 34,
  height: 18,
  thumb: 14,
  margin: 2,
} as const;

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function CompactSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: Props) {
  const { width, height, thumb, margin } = COMPACT_SWITCH_SIZE;

  return (
    <Pressable
      onPress={() => {
        if (!disabled) onValueChange(!value);
      }}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        {
          width,
          height,
          borderRadius: height / 2,
        },
        value ? styles.trackOn : styles.trackOff,
        disabled && styles.disabled,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            width: thumb,
            height: thumb,
            borderRadius: thumb / 2,
            backgroundColor: value
              ? DRONE_SETTINGS_THEME.switchThumbOn
              : DRONE_SETTINGS_THEME.switchThumbOff,
          },
          value
            ? { alignSelf: "flex-end", marginRight: margin }
            : { alignSelf: "flex-start", marginLeft: margin },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: "center",
    flexShrink: 0,
  },
  trackOn: {
    backgroundColor: DRONE_SETTINGS_THEME.switchTrackOn,
  },
  trackOff: {
    backgroundColor: DRONE_SETTINGS_THEME.switchTrackOff,
    opacity: 0.92,
  },
  thumb: {
    backgroundColor: DRONE_SETTINGS_THEME.switchThumbOff,
  },
  disabled: {
    opacity: 0.45,
  },
});
