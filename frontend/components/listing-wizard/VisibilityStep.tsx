import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { ListingWizardForm } from "../../src/types/listingWizard";

type Props = {
  form: ListingWizardForm;
  updateForm: (patch: Partial<ListingWizardForm>) => void;
  busy: boolean;
};

export default function VisibilityStep({ form, updateForm, busy }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Görünürlük onayı</Text>
      <Text style={styles.hint}>İlanınızın açık vitrinde mi yoksa Sandık’ta mı yayınlanacağını seçin.</Text>
      {(
        [
          { key: "public" as const, title: "Açık İlan", desc: "Emlak vitrininde tüm üyeler görebilir." },
          { key: "vault" as const, title: "Gizli İlan (Sandık)", desc: "Yalnızca danışmanlara özel portal." },
        ] as const
      ).map((opt) => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.card, form.portalVisibility === opt.key && styles.cardActive]}
          onPress={() => updateForm({ portalVisibility: opt.key })}
          disabled={busy}
        >
          <Text style={styles.cardTitle}>{opt.title}</Text>
          <Text style={styles.cardDesc}>{opt.desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  hint: { fontSize: 14, color: "#64748b", lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fff",
  },
  cardActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  cardDesc: { fontSize: 13, color: "#64748b", marginTop: 4 },
});
