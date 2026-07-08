import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ListingWizardForm } from "../../src/types/listingWizard";

type Props = { form: ListingWizardForm };

export default function PublishStep({ form }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Yayın</Text>
      <Text style={styles.hint}>
        Onayladığınızda ilan vitrine yayınlanır. Tepe Kredi kullanımı sunucu tarafında kontrol edilir.
      </Text>
      <View style={styles.box}>
        <Text style={styles.boxTitle}>{form.title || "Başlıksız ilan"}</Text>
        <Text style={styles.boxLine}>
          {form.portalVisibility === "vault" ? "Sandık (gizli)" : "Açık vitrin"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  hint: { fontSize: 14, color: "#64748b", lineHeight: 20 },
  box: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  boxTitle: { fontWeight: "700", fontSize: 16, color: "#0f172a" },
  boxLine: { color: "#64748b", marginTop: 6 },
});
