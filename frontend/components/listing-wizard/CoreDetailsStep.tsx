import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import type { ListingWizardForm } from "../../src/types/listingWizard";

type Props = {
  form: ListingWizardForm;
  updateForm: (patch: Partial<ListingWizardForm>) => void;
  busy: boolean;
};

export default function CoreDetailsStep({ form, updateForm, busy }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Temel bilgiler</Text>
      <Text style={styles.lbl}>İlan tipi</Text>
      <View style={styles.row}>
        {(["sale", "rent"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, form.listingType === t && styles.chipActive]}
            onPress={() => updateForm({ listingType: t })}
            disabled={busy}
          >
            <Text style={[styles.chipText, form.listingType === t && styles.chipTextActive]}>
              {t === "sale" ? "Satılık" : "Kiralık"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.lbl}>Fiyat (TRY)</Text>
      <TextInput
        style={styles.input}
        value={form.priceAmount}
        onChangeText={(v) => updateForm({ priceAmount: v })}
        keyboardType="numeric"
        placeholder="0"
        editable={!busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  lbl: { fontSize: 13, fontWeight: "600", color: "#0f172a", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", gap: 10 },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  chipActive: { backgroundColor: "#eff6ff", borderColor: "#3b82f6" },
  chipText: { color: "#64748b", fontWeight: "600" },
  chipTextActive: { color: "#1d4ed8" },
});
