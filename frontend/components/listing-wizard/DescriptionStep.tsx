import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import type { ListingWizardForm } from "../../src/types/listingWizard";
import { generateListingDescription, generateListingTitle } from "../../services/listingWizardService";

type Props = {
  listingId: string;
  form: ListingWizardForm;
  updateForm: (patch: Partial<ListingWizardForm>) => void;
  busy: boolean;
};

export default function DescriptionStep({ listingId, form, updateForm, busy }: Props) {
  const [aiBusy, setAiBusy] = useState(false);

  const aiContext = {
    category_leaf_id: form.categoryLeafId,
    listing_type: form.listingType,
    price_amount: form.priceAmount,
    ada: form.ada,
    parsel: form.parsel,
    location_labels: form.locationLabels,
    listing_attributes: form.listingAttributes,
  };

  const onAiTitle = useCallback(async () => {
    setAiBusy(true);
    try {
      const res = await generateListingTitle(listingId, aiContext);
      if (res.ok && res.data?.title) updateForm({ title: res.data.title });
    } finally {
      setAiBusy(false);
    }
  }, [aiContext, listingId, updateForm]);

  const onAiDescription = useCallback(async () => {
    setAiBusy(true);
    try {
      const res = await generateListingDescription(listingId, aiContext);
      if (res.ok && res.data?.description) updateForm({ description: res.data.description });
      if (res.ok && res.data?.title && !form.title.trim()) updateForm({ title: res.data.title! });
    } finally {
      setAiBusy(false);
    }
  }, [aiContext, form.title, listingId, updateForm]);

  return (
    <ScrollView style={styles.wrap}>
      <Text style={styles.title}>Açıklama</Text>
      <View style={styles.aiRow}>
        <TouchableOpacity style={styles.aiBtn} onPress={() => void onAiTitle()} disabled={busy || aiBusy}>
          <Text style={styles.aiBtnText}>AI Başlık</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.aiBtn} onPress={() => void onAiDescription()} disabled={busy || aiBusy}>
          <Text style={styles.aiBtnText}>AI Açıklama</Text>
        </TouchableOpacity>
        {aiBusy ? <ActivityIndicator size="small" /> : null}
      </View>
      <Text style={styles.lbl}>Başlık</Text>
      <TextInput
        style={styles.input}
        value={form.title}
        onChangeText={(title) => updateForm({ title })}
        editable={!busy}
      />
      <Text style={styles.lbl}>İlan metni</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={form.description}
        onChangeText={(description) => updateForm({ description })}
        multiline
        textAlignVertical="top"
        editable={!busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  aiRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  aiBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  aiBtnText: { color: "#3b82f6", fontWeight: "600", fontSize: 13 },
  lbl: { fontSize: 13, fontWeight: "600", color: "#0f172a", marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  textArea: { minHeight: 140 },
});
