import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import type { ListingWizardForm } from "../../src/types/listingWizard";
import {
  getPublicListingAttributeSchema,
  type PublicListingAttributeField,
} from "../../services/portalService";

type Props = {
  form: ListingWizardForm;
  updateForm: (patch: Partial<ListingWizardForm>) => void;
  busy: boolean;
};

function fieldVisible(field: PublicListingAttributeField, attrs: Record<string, unknown>): boolean {
  const vw = field.visible_when;
  if (!vw || !vw.field) return true;
  const cur = attrs[vw.field];
  if (vw.equals != null) return String(cur) === String(vw.equals);
  const inList = (vw as { in?: unknown[] }).in;
  if (Array.isArray(inList)) return inList.map(String).includes(String(cur));
  return true;
}

export default function DynamicAttributesStep({ form, updateForm, busy }: Props) {
  const [fields, setFields] = useState<PublicListingAttributeField[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const leaf = form.categoryLeafId.trim();
    if (!leaf) return;
    setLoading(true);
    const res = await getPublicListingAttributeSchema(leaf);
    setFields(res.ok ? res.data?.fields || [] : []);
    setLoading(false);
  }, [form.categoryLeafId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setAttr = (key: string, value: unknown) => {
    updateForm({
      listingAttributes: { ...form.listingAttributes, [key]: value },
    });
  };

  if (!form.categoryLeafId.trim()) {
    return <Text style={styles.hint}>Önce kategori seçin.</Text>;
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <ScrollView style={styles.wrap}>
      <Text style={styles.title}>Detaylar</Text>
      {fields.filter((f) => fieldVisible(f, form.listingAttributes)).map((field) => {
        const key = String(field.key || field.binding || "");
        if (!key) return null;
        const val = form.listingAttributes[key];
        if (field.choices && field.choices.length > 0) {
          return (
            <View key={key} style={styles.field}>
              <Text style={styles.lbl}>
                {field.label || key}
                {field.required ? " *" : ""}
              </Text>
              <View style={styles.choiceRow}>
                {field.choices.map((c) => (
                  <TouchableOpacity
                    key={String(c.value)}
                    style={[styles.chip, String(val) === String(c.value) && styles.chipActive]}
                    onPress={() => setAttr(key, c.value)}
                    disabled={busy}
                  >
                    <Text style={[styles.chipText, String(val) === String(c.value) && styles.chipTextActive]}>
                      {c.label || String(c.value)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        }
        return (
          <View key={key} style={styles.field}>
            <Text style={styles.lbl}>
              {field.label || key}
              {field.required ? " *" : ""}
            </Text>
            <TextInput
              style={styles.input}
              value={val != null ? String(val) : ""}
              onChangeText={(t) => setAttr(key, t)}
              keyboardType={field.value_type === "number" ? "numeric" : "default"}
              editable={!busy}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  hint: { color: "#64748b" },
  field: { marginBottom: 12 },
  lbl: { fontSize: 13, fontWeight: "600", color: "#0f172a", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: { backgroundColor: "#eff6ff", borderColor: "#3b82f6" },
  chipText: { color: "#64748b", fontSize: 13 },
  chipTextActive: { color: "#1d4ed8", fontWeight: "600" },
});
