/**
 * Yol çiz modu bar: Genişlik input (default 2m), Son Sil, İptal, Tamamla.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { parcelSplitTheme } from "../theme";

const MODE_BAR_HEIGHT = 48;

type Props = {
  roadWidthInput: string;
  setRoadWidthInput: (v: string) => void;
  roadDraftPointsCount: number;
  onComplete: () => void;
  onRemoveLast: () => void;
  onCancel: () => void;
};

export const ROAD_MODE_BAR_HEIGHT_PX = MODE_BAR_HEIGHT;

export function RoadModeBar({
  roadWidthInput,
  setRoadWidthInput,
  roadDraftPointsCount,
  onComplete,
  onRemoveLast,
  onCancel,
}: Props) {
  return (
    <View style={[styles.bar, { height: MODE_BAR_HEIGHT }]}>
      <Text style={styles.label}>Genişlik</Text>
      <TextInput
        style={styles.input}
        value={roadWidthInput}
        onChangeText={setRoadWidthInput}
        keyboardType="decimal-pad"
        placeholder="2"
      />
      <Text style={styles.unit}>m</Text>
      <TouchableOpacity
        style={[styles.btn, roadDraftPointsCount < 2 && styles.btnDisabled]}
        onPress={onComplete}
        disabled={roadDraftPointsCount < 2}
        accessibilityLabel="Tamamla"
      >
        <Text style={styles.btnText}>Tamamla</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btn}
        onPress={onRemoveLast}
        disabled={roadDraftPointsCount === 0}
        accessibilityLabel="Son noktayı sil"
      >
        <Text style={styles.btnText}>Son Sil</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={onCancel} accessibilityLabel="İptal">
        <Text style={styles.btnText}>İptal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: parcelSplitTheme.cardBg,
  },
  label: {
    fontSize: 12,
    color: parcelSplitTheme.textMuted,
    fontWeight: "600",
  },
  input: {
    width: 48,
    height: 36,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    paddingHorizontal: 6,
    fontSize: 13,
    color: parcelSplitTheme.brandNavy,
  },
  unit: {
    fontSize: 12,
    color: parcelSplitTheme.textMuted,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: parcelSplitTheme.accentBlue,
    minHeight: 40,
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
});
