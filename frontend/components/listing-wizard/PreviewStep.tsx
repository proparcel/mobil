import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { ListingWizardForm } from "../../src/types/listingWizard";
import { resolveMediaUrl } from "../../src/utils/resolveMediaUrl";
import { Image } from "react-native";

type Props = { form: ListingWizardForm };

export default function PreviewStep({ form }: Props) {
  const cover = form.listingMedia[0];
  const coverUri = cover ? resolveMediaUrl(cover.url || cover.thumb_url || "") : null;
  const price = form.priceAmount
    ? Number(String(form.priceAmount).replace(/\./g, "").replace(",", "."))
    : null;

  return (
    <ScrollView style={styles.wrap}>
      <Text style={styles.title}>Önizleme</Text>
      {coverUri ? <Image source={{ uri: coverUri }} style={styles.cover} /> : null}
      <Text style={styles.heading}>{form.title || "Başlıksız ilan"}</Text>
      {price != null && Number.isFinite(price) ? (
        <Text style={styles.price}>
          {price.toLocaleString("tr-TR")} {form.currency || "TRY"} · {form.listingType === "rent" ? "Kiralık" : "Satılık"}
        </Text>
      ) : null}
      <Text style={styles.line}>
        {form.categoryBreadcrumbLabels.join(" › ") || form.categoryLeafId || "—"}
      </Text>
      <Text style={styles.line}>
        {[form.locationLabels.il, form.locationLabels.ilce, form.locationLabels.mahalle].filter(Boolean).join(" / ")}
      </Text>
      <Text style={styles.line}>
        Ada {form.ada || "—"} · Parsel {form.parsel || "—"}
      </Text>
      {form.description.trim() ? <Text style={styles.desc}>{form.description.trim()}</Text> : null}
      <Text style={styles.line}>
        Görünürlük: {form.portalVisibility === "vault" ? "Sandık (gizli)" : "Açık vitrin"}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  cover: { width: "100%", height: 180, borderRadius: 10, backgroundColor: "#e2e8f0", marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  price: { fontSize: 16, fontWeight: "600", color: "#1d4ed8", marginTop: 4 },
  line: { fontSize: 14, color: "#64748b", marginTop: 6 },
  desc: { fontSize: 14, color: "#334155", marginTop: 12, lineHeight: 20 },
});
