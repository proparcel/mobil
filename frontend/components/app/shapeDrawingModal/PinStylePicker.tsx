import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import {
  MAP_PIN_STYLES,
  type MapPinVariant,
} from "@/src/maps/drawing/mapPinStyles";

type Props = {
  selected: MapPinVariant;
  onSelect: (variant: MapPinVariant) => void;
  accentColor?: string;
  compact?: boolean;
};

/** Harita iğnesi stil seçici — menü ve özellik panelinde kullanılır. */
export function PinStylePicker({
  selected,
  onSelect,
  accentColor = "#3b82f6",
  compact = false,
}: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact ? <Text style={styles.label}>İğne stili</Text> : null}
      <View style={styles.row}>
        {MAP_PIN_STYLES.map((style) => {
          const active = selected === style.id;
          return (
            <TouchableOpacity
              key={style.id}
              style={[
                styles.option,
                active && { borderColor: accentColor, backgroundColor: "rgba(59,130,246,0.18)" },
              ]}
              onPress={() => onSelect(style.id)}
              accessibilityLabel={style.label}
              accessibilityState={{ selected: active }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name={style.previewIcon}
                size={compact ? 22 : 26}
                color={active ? accentColor : "#cbd5e1"}
              />
              {!compact ? (
                <Text style={[styles.optionLabel, active && { color: accentColor }]} numberOfLines={1}>
                  {style.label}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  wrapCompact: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    minWidth: 68,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "rgba(15,23,42,0.55)",
    gap: 4,
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
  },
});
