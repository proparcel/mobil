/**
 * Web IntentEditor’daki Select2 alt kategoriye denk: aramalı tek seçim listesi.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PublicListingCategoryNode } from '../../services/portalService';
import { AranacaklarBottomSheetShell } from './AranacaklarBottomSheetShell';

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#3b82f6',
  cardBg: '#ffffff',
} as const;

export function AranacaklarSubCategorySelect({
  nodes,
  value,
  onChange,
  loading,
  errorText,
}: {
  nodes: PublicListingCategoryNode[];
  value: string;
  onChange: (leafId: string) => void;
  loading?: boolean;
  errorText?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const selected = nodes.find((n) => String(n.id) === String(value));

  const filtered = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('tr-TR');
    if (!t) return nodes;
    return nodes.filter((n) =>
      String(n.label ?? '')
        .toLocaleLowerCase('tr-TR')
        .includes(t),
    );
  }, [nodes, q]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const canOpen = !loading && nodes.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lbl}>Alt kategori (ilan türü)</Text>
      <TouchableOpacity
        style={[styles.pickerButton, (!canOpen || loading) && styles.pickerDisabled]}
        onPress={() => canOpen && setOpen(true)}
        disabled={!canOpen || loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
        ) : (
          <>
            <Text
              style={[styles.pickerButtonText, !selected && styles.pickerPlaceholder]}
              numberOfLines={2}
            >
              {selected ? selected.label : 'Alt kategori seçin veya arayın…'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
          </>
        )}
      </TouchableOpacity>

      {errorText ? <Text style={styles.warn}>{errorText}</Text> : null}

      <AranacaklarBottomSheetShell
        visible={open}
        onClose={() => setOpen(false)}
        title="Alt kategori"
        headerExtra={
          <TextInput
            style={styles.searchInp}
            placeholder="Ara…"
            placeholderTextColor={COLORS.textSecondary}
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
            autoCapitalize="none"
          />
        }
      >
        {filtered.map((n, idx) => {
          const isActive = String(value) === String(n.id);
          return (
            <TouchableOpacity
              key={String(n.id ?? idx)}
              style={[styles.modalItem, isActive && styles.modalItemActive]}
              onPress={() => {
                onChange(String(n.id ?? ''));
                setOpen(false);
              }}
            >
              <Text style={[styles.modalItemText, isActive && styles.modalItemTextActive]} numberOfLines={3}>
                {n.label ?? ''}
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
  wrap: { marginBottom: 4 },
  lbl: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 6 },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    gap: 8,
  },
  pickerDisabled: { opacity: 0.5 },
  pickerButtonText: { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  pickerPlaceholder: { color: COLORS.textSecondary },
  warn: { color: '#dc2626', fontSize: 13, marginTop: 6 },
  searchInp: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: '#f8fafc',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderSoft,
  },
  modalItemActive: { backgroundColor: '#eff6ff' },
  modalItemText: { fontSize: 14, color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  modalItemTextActive: { color: COLORS.accentBlue, fontWeight: '600' },
  emptySearch: { padding: 20, textAlign: 'center', color: COLORS.textSecondary, fontSize: 14 },
  doneBtn: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: COLORS.accentBlue,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
