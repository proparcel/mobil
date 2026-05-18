import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AppBottomSheetModal from './app/AppBottomSheetModal';

export type KonutDaireParams = {
  emsal_info?: string;
  retaining_wall?: { height_m?: number; length_m?: number };
  amenities?: string[];
  year: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onResult: (params: KonutDaireParams | null) => void | Promise<void>;
};

const AMENITIES = [
  { code: 'SECURITY_24_7', label: '7/24 Güvenlik' },
  { code: 'PARKING_INDOOR', label: 'Kapalı Otopark' },
  { code: 'POOL', label: 'Havuz' },
  { code: 'FITNESS', label: 'Fitness' },
] as const;

const KonutDaireModal: React.FC<Props> = ({ visible, onClose, onResult }) => {
  const [emsal, setEmsal] = useState('');
  const [heightM, setHeightM] = useState('1');
  const [lengthM, setLengthM] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);

  const toggleAmenity = (code: string) => {
    setAmenities((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const submit = () => {
    const h = parseFloat(heightM);
    const len = parseFloat(lengthM);
    onResult({
      emsal_info: emsal.trim() || undefined,
      retaining_wall:
        len > 0 ? { height_m: isNaN(h) ? 1 : h, length_m: len } : undefined,
      amenities,
      year: new Date().getFullYear(),
    });
  };

  if (!visible) return null;

  return (
    <AppBottomSheetModal visible={visible} onClose={onClose} snapPoints={['85%']} initialIndex={0}>
      <BottomSheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Konut + Daire Hesaplama</Text>
        <Text style={styles.label}>Emsal bilgisi (opsiyonel)</Text>
        <TextInput style={styles.input} value={emsal} onChangeText={setEmsal} multiline placeholder="Ada/parsel, m², fiyat..." />
        <Text style={styles.label}>İstinat duvarı yüksekliği (m)</Text>
        <TextInput style={styles.input} value={heightM} onChangeText={setHeightM} keyboardType="numeric" />
        <Text style={styles.label}>İstinat duvarı uzunluğu (m)</Text>
        <TextInput style={styles.input} value={lengthM} onChangeText={setLengthM} keyboardType="numeric" />
        <Text style={styles.label}>Sosyal donatılar</Text>
        <View style={styles.chipRow}>
          {AMENITIES.map((a) => {
            const on = amenities.includes(a.code);
            return (
              <TouchableOpacity key={a.code} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleAmenity(a.code)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{a.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.btnGhost} onPress={onClose}>
            <Text>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={submit}>
            <Text style={styles.btnPrimaryText}>Onayla</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

export default KonutDaireModal;

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#0f172a' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  chipOn: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 13, color: '#6b7280' },
  chipTextOn: { color: '#2563eb', fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  btnGhost: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db' },
  btnPrimary: { padding: 12, borderRadius: 8, backgroundColor: '#3b82f6' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
});
