import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import type { WizardStepDef } from "../../src/config/listingWizardConfig";

type Props = {
  steps: WizardStepDef[];
  currentIndex: number;
};

export default function ListingWizardStepper({ steps, currentIndex }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wrap} contentContainerStyle={styles.row}>
      {steps.map((step, i) => {
        const active = i === currentIndex;
        const done = i < currentIndex;
        return (
          <View key={step.key} style={[styles.chip, active && styles.chipActive, done && styles.chipDone]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
              {i + 1}. {step.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { maxHeight: 44, marginBottom: 12 },
  row: { gap: 8, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#334155",
  },
  chipActive: { backgroundColor: "#3b82f6" },
  chipDone: { backgroundColor: "#475569" },
  chipText: { color: "#cbd5e1", fontSize: 12, fontWeight: "600", maxWidth: 140 },
  chipTextActive: { color: "#fff" },
});
