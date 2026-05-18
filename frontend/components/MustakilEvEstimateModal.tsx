import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';

export type MustakilEvParams = {
  area_m2: number;
  building_age: number;
  quality_level: string;
  has_pool: boolean;
  has_landscape: boolean;
  year: number;
  land_type: string;
  parking_type: string;
  has_sauna: boolean;
  has_turkish_bath: boolean;
  has_gym: boolean;
  has_cinema_room: boolean;
  heating?: string;
  arazi_m2?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onResult: (params: VillaParams | null) => void | Promise<void>;
  areaM2?: number;
};

const QUALITIES = [
  { code: 'STANDARD', label: 'Standart', color: '#6b7280' },
  { code: 'GOOD', label: 'İyi', color: '#22c55e' },
  { code: 'LUX', label: 'Lüks', color: '#f59e0b' },
  { code: 'ULTRA', label: 'Ultra Lüks', color: '#ef4444' },
] as const;

const LAND_TYPES = [
  { code: 'arsa', label: 'Arsa', color: '#0ea5e9' },
  { code: 'tarla', label: 'Tarla', color: '#22c55e' },
  { code: 'koyici', label: 'Köyiçi', color: '#8b5cf6' },
] as const;

const PARKING_OPTIONS = [
  { value: 'kapali', label: 'Kapalı otopark' },
  { value: 'acik', label: 'Açık otopark' },
  { value: 'yok', label: 'Otopark yok' },
] as const;

const HEATING_OPTIONS = [
  { value: '', label: 'Seçiniz (opsiyonel)' },
  { value: 'yerden_isitma', label: 'Yerden ısıtma' },
  { value: 'dogalgaz_kombi', label: 'Doğalgaz (kombi)' },
  { value: 'soba', label: 'Soba' },
  { value: 'klima', label: 'Klima' },
  { value: 'isitma_yok', label: 'Isıtma yok' },
  { value: 'diger', label: 'Diğer' },
] as const;

const MustakilEvEstimateModal: React.FC<Props> = ({ visible, onClose, onResult, areaM2 = 0 }) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2>(1);

  const [buildArea, setBuildArea] = useState('');
  const [araziM2, setAraziM2] = useState('');
  const [buildingAge, setBuildingAge] = useState(0);
  const [quality, setQuality] = useState('STANDARD');
  const [landType, setLandType] = useState('arsa');
  const [hasPool, setHasPool] = useState(false);
  const [hasLandscape, setHasLandscape] = useState(false);
  const [parking, setParking] = useState('yok');
  const [heating, setHeating] = useState('');
  const [hasSauna, setHasSauna] = useState(false);
  const [hasHamam, setHasHamam] = useState(false);
  const [hasGym, setHasGym] = useState(false);
  const [hasCinema, setHasCinema] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setBuildArea(areaM2 > 0 ? String(Math.round(areaM2)) : '');
    setAraziM2('');
    setBuildingAge(0);
    setQuality('STANDARD');
    setLandType('arsa');
    setHasPool(false);
    setHasLandscape(false);
    setParking('yok');
    setHeating('');
    setHasSauna(false);
    setHasHamam(false);
    setHasGym(false);
    setHasCinema(false);
  }, [areaM2]);

  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const goNext = () => {
    const areaV = parseFloat(buildArea.replace(',', '.'));
    if (!areaV || areaV <= 0) {
      Alert.alert('Uyarı', 'İnşaat alanı zorunludur ve 0\'dan büyük olmalıdır.');
      return;
    }
    setStep(2);
  };

  const submit = () => {
    const areaV = parseFloat(buildArea.replace(',', '.'));
    if (!areaV || areaV <= 0) return;

    const result: MustakilEvParams = {
      area_m2: areaV,
      building_age: Math.max(0, Math.round(buildingAge)),
      quality_level: quality,
      has_pool: hasPool,
      has_landscape: hasLandscape,
      year: new Date().getFullYear(),
      land_type: landType,
      parking_type: parking,
      has_sauna: hasSauna,
      has_turkish_bath: hasHamam,
      has_gym: hasGym,
      has_cinema_room: hasCinema,
    };
    if (heating.trim()) result.heating = heating.trim();
    const araziV = parseFloat(araziM2.replace(',', '.'));
    if (araziV > 0 && !isNaN(araziV)) result.arazi_m2 = araziV;
    onResult(result);
  };

  const qualityLabel = QUALITIES.find((q) => q.code === quality)?.label || quality;
  const landLabel = LAND_TYPES.find((l) => l.code === landType)?.label || landType;
  const parkLabel = PARKING_OPTIONS.find((p) => p.value === parking)?.label || parking;
  const heatLabel = HEATING_OPTIONS.find((h) => h.value === heating)?.label || '-';

  const bandText =
    parseFloat(buildArea) <= 200
      ? 'Küçük Villa (≤200 m²)'
      : parseFloat(buildArea) < 500
        ? 'Orta Villa (200–500 m²)'
        : 'Büyük Villa (500+ m²)';

  if (!visible) return null;

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={['92%']}
      initialIndex={0}
      modalProps={{ android_keyboardInputMode: 'adjustResize', keyboardBehavior: 'interactive' as any }}
    >
      <BottomSheetScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 + (insets.bottom || 0) * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Müstakil Ev Maliyet Tahmini</Text>
        <View style={styles.stepBar}>
          <View style={[styles.stepSeg, step >= 1 && styles.stepSegActive]} />
          <View style={[styles.stepSeg, step >= 2 && styles.stepSegActive]} />
        </View>

        {step === 1 ? (
          <>
            <Text style={styles.subtitle}>Adım 1 / 2 — Villa bilgileri</Text>

            <Text style={styles.label}>Brüt inşaat alanı (m²) *</Text>
            <TextInput
              style={styles.input}
              value={buildArea}
              onChangeText={setBuildArea}
              keyboardType="numeric"
              placeholder="Örn: 250"
            />

            <Text style={[styles.label, styles.sectionTop]}>Arazi metrekare (m²)</Text>
            <TextInput
              style={styles.input}
              value={araziM2}
              onChangeText={setAraziM2}
              keyboardType="numeric"
              placeholder="Örn: 500"
            />
            <Text style={styles.hint}>Parsel alanı; değiştirmek isterseniz buradan güncelleyin.</Text>

            <Text style={[styles.label, styles.sectionTop]}>Bina yaşı (yıl) *</Text>
            <Slider
              minimumValue={0}
              maximumValue={30}
              step={1}
              value={Math.min(30, buildingAge)}
              onValueChange={setBuildingAge}
              minimumTrackTintColor="#0ea5e9"
            />
            <TextInput
              style={[styles.input, { width: 80, marginTop: 8 }]}
              value={String(buildingAge)}
              onChangeText={(t) => {
                const v = parseInt(t, 10);
                setBuildingAge(isNaN(v) ? 0 : Math.max(0, v));
              }}
              keyboardType="number-pad"
            />

            <Text style={[styles.label, styles.sectionTop]}>Kalite seviyesi *</Text>
            <View style={styles.chipRow}>
              {QUALITIES.map((q) => {
                const sel = quality === q.code;
                return (
                  <TouchableOpacity
                    key={q.code}
                    style={[styles.chip, sel && { borderColor: q.color, backgroundColor: `${q.color}15` }]}
                    onPress={() => setQuality(q.code)}
                  >
                    <Text style={[styles.chipText, sel && { color: q.color, fontWeight: '600' }]}>
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, styles.sectionTop]}>Arazi tipi *</Text>
            <View style={styles.chipRow}>
              {LAND_TYPES.map((lt) => {
                const sel = landType === lt.code;
                return (
                  <TouchableOpacity
                    key={lt.code}
                    style={[styles.chip, sel && { borderColor: lt.color, backgroundColor: `${lt.color}15` }]}
                    onPress={() => setLandType(lt.code)}
                  >
                    <Text style={[styles.chipText, sel && { color: lt.color, fontWeight: '600' }]}>
                      {lt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Havuz var mı?</Text>
              <Switch value={hasPool} onValueChange={setHasPool} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Peyzaj / çevre düzenlemesi</Text>
              <Switch value={hasLandscape} onValueChange={setHasLandscape} />
            </View>

            <Text style={[styles.label, styles.sectionTop]}>Otopark</Text>
            <View style={styles.chipRow}>
              {PARKING_OPTIONS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.chip, parking === p.value && styles.chipSelected]}
                  onPress={() => setParking(p.value)}
                >
                  <Text style={[styles.chipText, parking === p.value && styles.chipTextSelected]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, styles.sectionTop]}>Isıtma</Text>
            <View style={styles.chipRow}>
              {HEATING_OPTIONS.filter((h) => h.value !== '').map((h) => (
                <TouchableOpacity
                  key={h.value}
                  style={[styles.chip, heating === h.value && styles.chipSelected]}
                  onPress={() => setHeating(h.value)}
                >
                  <Text style={[styles.chipText, heating === h.value && styles.chipTextSelected]}>
                    {h.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, styles.sectionTop]}>Sauna / hamam / spor / sinema</Text>
            <View style={styles.checkGrid}>
              <View style={styles.switchRow}>
                <Text style={styles.checkLabel}>Sauna</Text>
                <Switch value={hasSauna} onValueChange={setHasSauna} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.checkLabel}>Hamam</Text>
                <Switch value={hasHamam} onValueChange={setHasHamam} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.checkLabel}>Spor salonu</Text>
                <Switch value={hasGym} onValueChange={setHasGym} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.checkLabel}>Sinema odası</Text>
                <Switch value={hasCinema} onValueChange={setHasCinema} />
              </View>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
                <Text style={styles.btnSecondaryText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={goNext}>
                <Text style={styles.btnPrimaryText}>Devam →</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Adım 2 / 2 — Onay</Text>
            <View style={styles.summaryCard}>
              <SummaryRow label="İnşaat alanı" value={`${buildArea} m²`} />
              {araziM2 ? <SummaryRow label="Arazi" value={`${araziM2} m²`} /> : null}
              <SummaryRow label="Bina yaşı" value={`${buildingAge} yıl`} />
              <SummaryRow label="Kalite" value={qualityLabel} />
              <SummaryRow label="Arazi tipi" value={landLabel} />
              <SummaryRow label="Havuz" value={hasPool ? 'Evet' : 'Hayır'} />
              <SummaryRow label="Peyzaj" value={hasLandscape ? 'Evet' : 'Hayır'} />
              <SummaryRow label="Otopark" value={parkLabel} />
              <SummaryRow label="Isıtma" value={heatLabel} />
              <SummaryRow
                label="Wellness"
                value={
                  [hasSauna && 'Sauna', hasHamam && 'Hamam', hasGym && 'Spor', hasCinema && 'Sinema']
                    .filter(Boolean)
                    .join(', ') || '-'
                }
              />
            </View>
            <View style={styles.bandBox}>
              <Text style={styles.bandText}>Band: {bandText}</Text>
            </View>
            <View style={styles.footer}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(1)}>
                <Text style={styles.btnSecondaryText}>← Geri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, styles.btnSuccess]} onPress={submit}>
                <Text style={styles.btnPrimaryText}>Sorguyu Başlat</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default MustakilEvEstimateModal;

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginVertical: 12 },
  stepBar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stepSeg: { flex: 1, height: 4, borderRadius: 4, backgroundColor: '#e5e7eb' },
  stepSegActive: { backgroundColor: '#0ea5e9' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  hint: { fontSize: 11, color: '#6b7280', marginBottom: 12 },
  sectionTop: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipSelected: { borderColor: '#0ea5e9', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 13, color: '#6b7280' },
  chipTextSelected: { color: '#0284c7', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  checkGrid: { marginTop: 4 },
  checkLabel: { fontSize: 13, color: '#374151' },
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryLabel: { fontSize: 13, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  bandBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  bandText: { fontSize: 13, color: '#1e40af' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  btnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  btnSecondaryText: { fontSize: 14, color: '#374151' },
  btnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
  },
  btnSuccess: { backgroundColor: '#22c55e' },
  btnPrimaryText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
