import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { ListingWizardForm } from "../../src/types/listingWizard";
import { getPublicListingCategories, type PublicListingCategoryNode } from "../../services/portalService";
import { fetchListingCategoryBreadcrumb } from "../../services/listingWizardService";

type Props = {
  form: ListingWizardForm;
  updateForm: (patch: Partial<ListingWizardForm>) => void;
  busy: boolean;
};

export default function CategorySelectionStep({ form, updateForm, busy }: Props) {
  const [roots, setRoots] = useState<PublicListingCategoryNode[]>([]);
  const [children, setChildren] = useState<PublicListingCategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentStack, setParentStack] = useState<Array<{ id: string; label: string }>>([]);

  const loadRoots = useCallback(async () => {
    setLoading(true);
    const res = await getPublicListingCategories({ listingType: form.listingType });
    setRoots(res.ok ? res.data?.nodes || [] : []);
    setLoading(false);
  }, [form.listingType]);

  useEffect(() => {
    void loadRoots();
  }, [loadRoots]);

  const openNode = useCallback(
    async (node: PublicListingCategoryNode) => {
      if (busy) return;
      const id = String(node.id || "");
      const label = String(node.label || id);
      if (node.is_leaf) {
        const bc = await fetchListingCategoryBreadcrumb(id);
        const labels = (bc.ok && bc.data?.breadcrumb
          ? bc.data.breadcrumb.map((b) => String(b.label || ""))
          : [...parentStack.map((p) => p.label), label]
        ).filter(Boolean);
        updateForm({ categoryLeafId: id, categoryBreadcrumbLabels: labels });
        return;
      }
      setParentStack((prev) => [...prev, { id, label }]);
      const res = await getPublicListingCategories({ parentId: id, listingType: form.listingType });
      setChildren(res.ok ? res.data?.nodes || [] : []);
    },
    [busy, form.listingType, parentStack, updateForm],
  );

  const goBack = useCallback(() => {
    if (parentStack.length === 0) {
      setChildren([]);
      return;
    }
    const next = [...parentStack];
    next.pop();
    setParentStack(next);
    const parentId = next.length ? next[next.length - 1].id : null;
    void (async () => {
      const res = await getPublicListingCategories({
        parentId: parentId || undefined,
        listingType: form.listingType,
      });
      setChildren(res.ok ? res.data?.nodes || [] : []);
    })();
  }, [form.listingType, parentStack]);

  const list = parentStack.length ? children : roots;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Kategori seçimi</Text>
      {form.categoryLeafId ? (
        <View style={styles.selected}>
          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
          <Text style={styles.selectedText}>{form.categoryBreadcrumbLabels.join(" › ") || form.categoryLeafId}</Text>
        </View>
      ) : null}
      {parentStack.length > 0 ? (
        <TouchableOpacity onPress={goBack} style={styles.backRow}>
          <Ionicons name="chevron-back" size={18} color="#3b82f6" />
          <Text style={styles.backText}>Geri</Text>
        </TouchableOpacity>
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <ScrollView style={styles.list}>
          {list.map((node) => (
            <TouchableOpacity
              key={String(node.id)}
              style={styles.row}
              onPress={() => void openNode(node)}
              disabled={busy}
            >
              <Text style={styles.rowText}>{node.label || node.id}</Text>
              {!node.is_leaf ? <Ionicons name="chevron-forward" size={18} color="#94a3b8" /> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  selected: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, padding: 10, backgroundColor: "#f0fdf4", borderRadius: 8 },
  selectedText: { flex: 1, color: "#0f172a", fontWeight: "600" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  backText: { color: "#3b82f6", fontWeight: "600" },
  list: { maxHeight: 360 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  rowText: { fontSize: 15, color: "#0f172a", flex: 1 },
});
