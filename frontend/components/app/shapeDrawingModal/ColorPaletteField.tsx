import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { isSameColor, SHAPE_COLOR_PALETTE } from "./shapeColorPalette";

type Props = {
  label: string;
  value: string;
  onSelect: (hex: string) => void;
  palette?: readonly string[];
  pickerId: string;
  activePickerId: string | null;
  setActivePickerId: (id: string | null) => void;
};

export function ColorPaletteField({
  label,
  value,
  onSelect,
  palette = SHAPE_COLOR_PALETTE,
  pickerId,
  activePickerId,
  setActivePickerId,
}: Props) {
  const open = activePickerId === pickerId;
  const displayColor = value || "#3b82f6";

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.triggerRow}
        onPress={() => setActivePickerId(open ? null : pickerId)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${label} rengi seç`}
      >
        <Text style={styles.label}>{label}</Text>
        <View style={styles.triggerRight}>
          <View
            style={[
              styles.swatch,
              { backgroundColor: displayColor },
              isSameColor(displayColor, "#ffffff") && styles.swatchLightBorder,
            ]}
          />
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
        </View>
      </TouchableOpacity>

      {open ? (
        <View style={styles.paletteGrid}>
          {palette.map((c) => {
            const active = isSameColor(displayColor, c);
            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.paletteSwatch,
                  { backgroundColor: c },
                  isSameColor(c, "#ffffff") && styles.swatchLightBorder,
                  active && styles.paletteSwatchActive,
                ]}
                onPress={() => {
                  onSelect(c);
                  setActivePickerId(null);
                }}
                accessibilityLabel={`Renk ${c}`}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(51, 65, 85, 0.45)",
    borderWidth: 1,
    borderColor: "#334155",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  triggerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#334155",
  },
  swatchLightBorder: {
    borderColor: "#64748b",
  },
  paletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  paletteSwatch: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#334155",
  },
  paletteSwatchActive: {
    borderColor: "#93c5fd",
    borderWidth: 3,
  },
});
