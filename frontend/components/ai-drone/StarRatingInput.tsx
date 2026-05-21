import React, { useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type Props = {
  value: number;
  onChange?: (stars: number) => void;
  readonly?: boolean;
  size?: number;
  label?: string;
};

export function StarRatingInput({ value, onChange, readonly = false, size = 32, label }: Props) {
  const stars = [1, 2, 3, 4, 5];

  const onPress = useCallback(
    (n: number) => {
      if (readonly || !onChange) return;
      onChange(n);
    },
    [onChange, readonly],
  );

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={`Puan: ${value} / 5`}>
        {stars.map((n) => {
          const filled = n <= value;
          return (
            <TouchableOpacity
              key={n}
              onPress={() => onPress(n)}
              disabled={readonly}
              activeOpacity={readonly ? 1 : 0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityLabel={`${n} yıldız`}
            >
              <Ionicons name={filled ? "star" : "star-outline"} size={size} color={filled ? "#f59e0b" : "#cbd5e1"} />
            </TouchableOpacity>
          );
        })}
      </View>
      {!readonly && value > 0 ? <Text style={styles.hint}>{value} / 5</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  hint: { fontSize: 13, color: "#64748b", fontWeight: "600" },
});
