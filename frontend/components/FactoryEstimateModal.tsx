import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import { API_URL } from '../config/api';

const PARAM_DEPS: Record<string, string> = {
  CRANE_TON: 'HAS_CRANE',
  COLD_TEMP_CLASS: 'IS_COLD_STORAGE',
};

export type FactoryParams = {
  type_code: string;
  params: Record<string, unknown>;
  factory_age: number;
  area_m2: number;
  year: number;
  location: Record<string, unknown>;
};

type CostType = {
  TypeCode: string;
  DisplayNameTR: string;
  Description?: string;
};

type CostParam = {
  ParamCode: string;
  DisplayNameTR: string;
  DataType: string;
  IsRequired?: boolean;
  EnumJson?: unknown;
  MinValue?: number;
  MaxValue?: number;
  Unit?: string;
  HelpText?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onResult: (params: FactoryParams | null) => void | Promise<void>;
  areaM2?: number;
  location?: Record<string, unknown>;
};

const FactoryEstimateModal: React.FC<Props> = ({
  visible,
  onClose,
  onResult,
  areaM2 = 0,
  location = {},
}) => {
  const insets = useSafeAreaInsets();
  const backendUrl = useMemo(() => (API_URL || '').replace(/\/$/, ''), []);

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState<CostType[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [typeParams, setTypeParams] = useState<CostParam[]>([]);
  const [area, setArea] = useState('');
  const [factoryAge, setFactoryAge] = useState(0);
  const [paramValues, setParamValues] = useState<Record<string, string | boolean>>({});

  const reset = useCallback(() => {
    setStep(1);
    setLoading(false);
    setTypes([]);
    setSelectedType(null);
    setTypeParams([]);
    setArea(areaM2 > 0 ? String(Math.round(areaM2)) : '');
    setFactoryAge(0);
    setParamValues({});
  }, [areaM2]);

  useEffect(() => {
    if (!visible) return;
    reset();
  }, [visible, reset]);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/cost/types/?category=FACTORY`);
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.types)) {
        Alert.alert('Hata', 'Yapı tipleri yüklenemedi.');
        return;
      }
      setTypes(data.types);
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (visible && step === 1 && types.length === 0 && !loading) {
      loadTypes();
    }
  }, [visible, step, types.length, loading, loadTypes]);

  const loadParams = useCallback(async (typeCode: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${backendUrl}/api/cost/type-params/?type_code=${encodeURIComponent(typeCode)}`
      );
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.params)) {
        Alert.alert('Hata', 'Parametreler yüklenemedi.');
        return;
      }
      setTypeParams(data.params);
      const initial: Record<string, string | boolean> = {};
      for (const p of data.params) {
        if (p.DataType === 'bool') initial[p.ParamCode] = false;
      }
      setParamValues(initial);
      setStep(2);
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  const ageMultiplier = useMemo(() => {
    if (factoryAge < 10) return 1.8;
    const mult = 1.8 - ((factoryAge - 10) * 0.8) / 40;
    return Math.max(1.0, Math.min(1.8, mult));
  }, [factoryAge]);

  const isParamVisible = (p: CostParam) => {
    const dep = PARAM_DEPS[p.ParamCode];
    if (!dep) return true;
    return paramValues[dep] === true;
  };

  const handleSubmit = () => {
    const areaVal = parseFloat(area.replace(',', '.'));
    if (!areaVal || areaVal <= 0) {
      Alert.alert('Uyarı', 'Geçerli bir alan (m²) girin.');
      return;
    }
    if (!selectedType) return;

    const params: Record<string, unknown> = {};
    for (const p of typeParams) {
      if (!isParamVisible(p)) continue;
      const raw = paramValues[p.ParamCode];
      if (p.DataType === 'bool') {
        params[p.ParamCode] = raw === true;
      } else if (raw !== '' && raw !== undefined && raw !== null) {
        params[p.ParamCode] = p.DataType === 'enum' ? raw : parseFloat(String(raw));
      }
    }

    const result: FactoryParams = {
      type_code: selectedType,
      params,
      factory_age: Math.max(0, Math.min(50, Math.round(factoryAge))),
      area_m2: areaVal,
      year: new Date().getFullYear(),
      location: location || {},
    };
    onResult(result);
  };

  const renderEnumParam = (p: CostParam) => {
    const items = Array.isArray(p.EnumJson) ? p.EnumJson : [];
    return (
      <View key={p.ParamCode} style={styles.paramBlock}>
        <Text style={styles.label}>
          {p.DisplayNameTR}
          {p.IsRequired ? ' *' : ''}
        </Text>
        <View style={styles.chipRow}>
          {items.map((item: any, idx: number) => {
            const v = typeof item === 'object' ? item.value : item;
            const l = typeof item === 'object' ? item.label : String(item);
            const selected = paramValues[p.ParamCode] === v;
            return (
              <TouchableOpacity
                key={`${p.ParamCode}-${idx}`}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setParamValues((prev) => ({ ...prev, [p.ParamCode]: v }))}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

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
        <Text style={styles.title}>Fabrika Maliyet Tahmini</Text>
        <Text style={styles.subtitle}>
          {step === 1 ? 'Adım 1/2 — Yapı tipi seçin' : 'Adım 2/2 — Parametreleri girin'}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 24 }} />
        ) : step === 1 ? (
          <>
            {types.map((t) => (
              <TouchableOpacity
                key={t.TypeCode}
                style={[styles.typeBtn, selectedType === t.TypeCode && styles.typeBtnSelected]}
                onPress={() => setSelectedType(t.TypeCode)}
              >
                <Text style={styles.typeBtnTitle}>{t.DisplayNameTR}</Text>
                {t.Description ? <Text style={styles.typeBtnDesc}>{t.Description}</Text> : null}
              </TouchableOpacity>
            ))}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
                <Text style={styles.btnSecondaryText}>Kapat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, !selectedType && styles.btnDisabled]}
                disabled={!selectedType}
                onPress={() => selectedType && loadParams(selectedType)}
              >
                <Text style={styles.btnPrimaryText}>İleri</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.paramBlock}>
              <Text style={styles.label}>Alan (m²) *</Text>
              <TextInput
                style={styles.input}
                value={area}
                onChangeText={setArea}
                keyboardType="numeric"
                placeholder="Örn: 5000"
              />
            </View>

            {typeParams.filter(isParamVisible).map((p) => {
              if (p.DataType === 'enum') return renderEnumParam(p);
              if (p.DataType === 'bool') {
                return (
                  <View key={p.ParamCode} style={styles.paramBlock}>
                    <View style={styles.switchRow}>
                      <Text style={styles.label}>{p.DisplayNameTR}</Text>
                      <Switch
                        value={paramValues[p.ParamCode] === true}
                        onValueChange={(v) =>
                          setParamValues((prev) => ({ ...prev, [p.ParamCode]: v }))
                        }
                      />
                    </View>
                  </View>
                );
              }
              return (
                <View key={p.ParamCode} style={styles.paramBlock}>
                  <Text style={styles.label}>
                    {p.DisplayNameTR}
                    {p.IsRequired ? ' *' : ''}
                    {p.Unit ? ` (${p.Unit})` : ''}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={String(paramValues[p.ParamCode] ?? '')}
                    onChangeText={(t) =>
                      setParamValues((prev) => ({ ...prev, [p.ParamCode]: t }))
                    }
                    keyboardType="numeric"
                    placeholder={p.HelpText || ''}
                  />
                </View>
              );
            })}

            <View style={[styles.paramBlock, styles.ageBlock]}>
              <Text style={styles.labelBold}>Fabrika Yaşı *</Text>
              <Text style={styles.hint}>0–9 yıl = yeni fabrika; 10–50 yaşta değer düşer</Text>
              <Slider
                minimumValue={0}
                maximumValue={50}
                step={1}
                value={factoryAge}
                onValueChange={setFactoryAge}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#e5e7eb"
              />
              <View style={styles.ageRow}>
                <TextInput
                  style={[styles.input, styles.ageInput]}
                  value={String(factoryAge)}
                  onChangeText={(t) => {
                    const v = parseInt(t, 10);
                    if (isNaN(v)) setFactoryAge(0);
                    else setFactoryAge(Math.max(0, Math.min(50, v)));
                  }}
                  keyboardType="number-pad"
                />
                <Text style={styles.hint}>yıl — Yaş çarpanı: x{ageMultiplier.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(1)}>
                <Text style={styles.btnSecondaryText}>Geri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, styles.btnSuccess]} onPress={handleSubmit}>
                <Text style={styles.btnPrimaryText}>Onayla ve Hesapla</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

export default FactoryEstimateModal;

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 16 },
  typeBtn: {
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  typeBtnSelected: { borderColor: '#3b82f6' },
  typeBtnTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  typeBtnDesc: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  paramBlock: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  labelBold: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  hint: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipSelected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 13, color: '#6b7280' },
  chipTextSelected: { color: '#2563eb', fontWeight: '600' },
  ageBlock: { marginTop: 8, paddingTop: 16, borderTopWidth: 2, borderTopColor: '#e5e7eb' },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  ageInput: { width: 72, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  btnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  btnSecondaryText: { fontSize: 14, color: '#374151' },
  btnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
  },
  btnSuccess: { backgroundColor: '#10b981', flex: 1 },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { fontSize: 14, fontWeight: '600', color: '#fff', textAlign: 'center' },
});
