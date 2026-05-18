/**
 * Web mahalle-bilgileri Select2 ile aynı amaç: aramalı mahalle seçimi (bottom sheet + filtre).
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AranacaklarBottomSheetShell } from "./AranacaklarBottomSheetShell";

const COLORS = {
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  borderSoft: "#e2e8f0",
  accentBlue: "#3b82f6",
} as const;

export type QuarterSelectItem = { value: number; label: string };

type Props = {
  label: string;
  /** false: üstte etiket gösterme (placeholder yeterli) */
  hideLabel?: boolean;
  /** Seçim yokken buton üzerindeki metin */
  placeholder?: string;
  items: QuarterSelectItem[];
  selectedValue: number | null;
  onSelect: (v: number | null) => void;
  loading?: boolean;
  disabled?: boolean;
};

export function PromahalleQuarterSelect({
  label,
  hideLabel,
  placeholder = "Mahalle ara veya seçin…",
  items,
  selectedValue,
  onSelect,
  loading,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = items.find((i) => i.value === selectedValue);

  const listItems = useMemo(() => items.filter((i) => i.value !== 0 && i.label.trim() !== ""), [items]);

  const filtered = useMemo(() => {
    const t = q.trim().toLocaleLowerCase("tr-TR");
    if (!t) return listItems;
    return listItems.filter((n) =>
      String(n.label ?? "")
        .toLocaleLowerCase("tr-TR")
        .includes(t)
    );
  }, [listItems, q]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const canOpen = !loading && !disabled && listItems.length > 0;

  return (
    <View style={styles.wrap}>
      {hideLabel ? null : <Text style={styles.lbl}>{label}</Text>}
      <TouchableOpacity
        style={[styles.pickerButton, (!canOpen || loading) && styles.pickerDisabled]}
        onPress={() => canOpen && setOpen(true)}
        disabled={!canOpen || loading || disabled}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
        ) : (
          <>
            <Text style={[styles.pickerButtonText, !selected && styles.pickerPlaceholder]} numberOfLines={2}>
              {selected ? selected.label : placeholder}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
          </>
        )}
      </TouchableOpacity>

      <AranacaklarBottomSheetShell
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        headerExtra={
          <TextInput
            style={styles.searchInp}
            placeholder="Mahalle ara…"
            placeholderTextColor={COLORS.textSecondary}
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
            autoCapitalize="none"
          />
        }
      >
        {filtered.map((n, idx) => {
          const isActive = selectedValue === n.value;
          return (
            <TouchableOpacity
              key={`${n.value}-${idx}`}
              style={[styles.modalItem, isActive && styles.modalItemActive]}
              onPress={() => {
                onSelect(n.value);
                setOpen(false);
              }}
            >
              <Text style={[styles.modalItemText, isActive && styles.modalItemTextActive]} numberOfLines={3}>
                {n.label ?? ""}
              </Text>
              {isActive ? <Ionicons name="checkmark" size={18} color={COLORS.accentBlue} /> : null}
            </TouchableOpacity>
          );
        })}
        {filtered.length === 0 ? <Text style={styles.emptySearch}>Sonuç yok</Text> : null}
        <TouchableOpacity style={styles.doneBtn} onPress={() => setOpen(false)} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Kapat</Text>
        </TouchableOpacity>
      </AranacaklarBottomSheetShell>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  lbl: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary, marginBottom: 6 },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fafafa",
  },
  pickerDisabled: { opacity: 0.45 },
  pickerButtonText: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: "600", paddingRight: 8 },
  pickerPlaceholder: { color: COLORS.textSecondary, fontWeight: "500" },
  searchInp: {
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: "#f8fafc",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  modalItemActive: { backgroundColor: "#eff6ff" },
  modalItemText: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingRight: 8 },
  modalItemTextActive: { color: COLORS.accentBlue, fontWeight: "600" },
  emptySearch: { textAlign: "center", color: COLORS.textSecondary, padding: 16 },
  doneBtn: {
    marginTop: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  doneBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
});
