import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import locationsJson from '../src/data/locations.json';
import {
  useKeyboardHeight,
  getKeyboardAvoidingBehavior,
  SCROLL_VIEW_KEYBOARD_PROPS,
  useScrollInputIntoView,
} from '../src/keyboard';

interface AdaParselFormProps {
  onClose: () => void;
  onSubmit?: (payload: {
    mahalleTkgmValue: number;
    mahalle: string;
    ada: string;
    parsel: string;
    proparcelValue?: number;
    city?: string;
    town?: string;
  }) => void | Promise<void>;
  /**
   * Visual variant for embedding in different sheets.
   * - "light": existing white form (default)
   * - "dark": 3D editor bottomsheet theme (dark slate)
   */
  variant?: "light" | "dark";
  /** Üst ekranın ScrollView’i kaydırır; iç ScrollView yok */
  embedded?: boolean;
  /** AppBottomSheetModal içinde — sheet klavyeyi yönetir, dış KAV yok */
  inBottomSheet?: boolean;
  /** embedded + üst KeyboardAwareScrollScreen ref — ada/parsel scroll-into-view */
  scrollRef?: React.RefObject<ScrollView | null>;
}

export type AdaParselSubmitPayload = {
  mahalleTkgmValue: number;
  mahalle: string;
  ada: string;
  parsel: string;
  proparcelValue?: number;
  city?: string;
  town?: string;
};

type Quarter = {
  Id: number;
  Tkgm_text?: string;
  Tkgm_value: number;
  Proparcel_text: string;
  Proparcel_value: number | string;
  Inactive?: boolean;
};

type Town = {
  Id: number;
  Tkgm_value: number;
  Proparcel_text: string;
  Quarters: Quarter[];
};

type City = {
  Id: number;
  Tkgm_value: number;
  Proparcel_text: string;
  Towns: Town[];
};

type LocationsResponse = {
  cities: City[];
  total_cities?: number;
  total_towns?: number;
  total_quarters?: number;
};

type PickerMode = 'city' | 'town' | 'quarter' | null;

const MAX_RESULTS = 200;

const normalizeTr = (s: string): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();

// Mahalle görüntüleme formatı: "Tkgm_text (Proparcel_text)" veya sadece "Tkgm_text"
const formatQuarterText = (quarter: Quarter): string => {
  if (quarter.Proparcel_text && quarter.Proparcel_text.trim() !== '' && quarter.Tkgm_text) {
    return `${quarter.Tkgm_text} (${quarter.Proparcel_text})`;
  }
  return quarter.Tkgm_text || quarter.Proparcel_text || '';
};

const AdaParselForm: React.FC<AdaParselFormProps> = ({
  onClose,
  onSubmit,
  variant = "light",
  embedded = false,
  inBottomSheet = false,
  scrollRef,
}) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const styles = useMemo(() => createStyles(variant), [variant]);
  const useOuterKav = !embedded && !inBottomSheet;
  const adaParselWrapRef = useRef<View>(null);
  const { handleFocus: scrollAdaParselIntoView, handleBlur: scrollAdaParselBlur } =
    useScrollInputIntoView({
      scrollRef: scrollRef ?? { current: null },
      inputWrapRef: adaParselWrapRef,
    });
  const onAdaParselFocus = embedded && scrollRef ? scrollAdaParselIntoView : undefined;
  const onAdaParselBlur = embedded && scrollRef ? scrollAdaParselBlur : undefined;

  // Lokasyon verileri yerel JSON dosyasından yüklenir
  const locations = locationsJson as unknown as LocationsResponse;
  const locationsLoading = false;
  const locationsError: string | null = null;

  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedTown, setSelectedTown] = useState<Town | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter | null>(null);

  const [ada, setAda] = useState('');
  const [parsel, setParsel] = useState('');

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const cityItems = useMemo(() => locations?.cities || [], [locations]);
  const townItems = useMemo(() => selectedCity?.Towns || [], [selectedCity]);
  const quarterItems = useMemo(
    () => (selectedTown?.Quarters || []).filter((q) => !q?.Inactive),
    [selectedTown]
  );

  const currentPicker = useMemo(() => {
    if (pickerMode === 'city') return { title: 'İl Seçiniz', items: cityItems };
    if (pickerMode === 'town') return { title: 'İlçe Seçiniz', items: townItems };
    if (pickerMode === 'quarter')
      return { title: 'Mahalle Seçiniz', items: quarterItems };
    return null;
  }, [pickerMode, cityItems, townItems, quarterItems]);

  const filteredItems = useMemo(() => {
    if (!currentPicker) return [];
    const q = normalizeTr(pickerSearch);
    if (!q) return currentPicker.items.slice(0, MAX_RESULTS);

    const out: any[] = [];
    for (const it of currentPicker.items as any[]) {
      // Hem Tkgm_text hem Proparcel_text içinde ara
      const tkgmTxt = normalizeTr(String(it?.Tkgm_text || ''));
      const proparcelTxt = normalizeTr(String(it?.Proparcel_text || ''));
      if (tkgmTxt.includes(q) || proparcelTxt.includes(q)) {
        out.push(it);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [currentPicker, pickerSearch]);

  const handleSorgula = () => {
    if (!selectedCity || !selectedTown || !selectedQuarter || !ada || !parsel) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }
    const payload = {
      mahalleTkgmValue: Number(selectedQuarter.Tkgm_value),
      mahalle: selectedQuarter.Proparcel_text,
      ada: String(ada).trim(),
      parsel: String(parsel).trim(),
      proparcelValue: Number((selectedQuarter as any).Proparcel_value),
      city: selectedCity.Proparcel_text,
      town: selectedTown.Proparcel_text,
    };
    if (onSubmit) {
      onSubmit(payload);
      return;
    }
  };

  const handleTemizle = () => {
    setSelectedCity(null);
    setSelectedTown(null);
    setSelectedQuarter(null);
    setAda('');
    setParsel('');
  };

  const openPicker = (mode: PickerMode) => {
    setPickerSearch('');
    setPickerMode(mode);
  };

  const closePicker = () => {
    setPickerMode(null);
    setPickerSearch('');
  };

  const selectItem = (item: any) => {
    if (pickerMode === 'city') {
      setSelectedCity(item as City);
      setSelectedTown(null);
      setSelectedQuarter(null);
    } else if (pickerMode === 'town') {
      setSelectedTown(item as Town);
      setSelectedQuarter(null);
    } else if (pickerMode === 'quarter') {
      setSelectedQuarter(item as Quarter);
    }
    closePicker();
  };

  const formFields = (
        <View style={styles.form} testID="search-fields-area">
          <View style={styles.fieldContainer}>
            <TouchableOpacity
              testID="city-picker-button"
              accessibilityLabel="İl seçimi alanını aç"
              style={styles.picker}
              onPress={() => openPicker('city')}
              activeOpacity={0.85}
            >
              <Text style={[styles.pickerText, !selectedCity && styles.placeholderText]}>
                {selectedCity?.Proparcel_text || 'İl seçiniz'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldContainer}>
            <TouchableOpacity
              testID="town-picker-button"
              accessibilityLabel="İlçe seçimi alanını aç"
              style={[styles.picker, !selectedCity && styles.pickerDisabled]}
              onPress={() => selectedCity && openPicker('town')}
              disabled={!selectedCity}
              activeOpacity={0.85}
            >
              <Text style={[styles.pickerText, !selectedTown && styles.placeholderText]}>
                {selectedTown?.Proparcel_text || 'İlçe seçiniz'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldContainer}>
            <TouchableOpacity
              testID="quarter-picker-button"
              accessibilityLabel="Mahalle seçimi alanını aç"
              style={[styles.picker, !selectedTown && styles.pickerDisabled]}
              onPress={() => selectedTown && openPicker('quarter')}
              disabled={!selectedTown}
              activeOpacity={0.85}
            >
              <Text style={[styles.pickerText, !selectedQuarter && styles.placeholderText]}>
                {selectedQuarter ? formatQuarterText(selectedQuarter) : 'Mahalle seçiniz'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>
          </View>

          <View ref={adaParselWrapRef} collapsable={false}>
            <View style={styles.fieldContainer}>
              <TextInput
                testID="ada-input"
                accessibilityLabel="Ada numarası giriş alanı"
                style={styles.input}
                placeholder="Ada"
                value={ada}
                onChangeText={setAda}
                keyboardType="numeric"
                onFocus={onAdaParselFocus}
                onBlur={onAdaParselBlur}
              />
            </View>

            <View style={styles.fieldContainer}>
              <TextInput
                testID="parsel-input"
                accessibilityLabel="Parsel numarası giriş alanı"
                style={styles.input}
                placeholder="Parsel"
                value={parsel}
                onChangeText={setParsel}
                keyboardType="numeric"
                onFocus={onAdaParselFocus}
                onBlur={onAdaParselBlur}
              />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              testID="submit-query-button"
              accessibilityLabel="Parsel sorgulamasını başlat"
              style={[styles.button, styles.primaryButton]}
              onPress={handleSorgula}
              activeOpacity={0.9}
            >
              <Ionicons name="search" size={18} color="#fff" />
              <Text style={styles.buttonText}>Sorgula</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="clear-form-button"
              accessibilityLabel="Tüm form alanlarını temizle"
              style={[styles.button, styles.secondaryButton]}
              onPress={handleTemizle}
              activeOpacity={0.9}
            >
              <Ionicons name="trash-outline" size={18} color="#1a237e" />
              <Text style={styles.secondaryButtonText}>Temizle</Text>
            </TouchableOpacity>
          </View>
        </View>
  );

  const formBody = embedded ? (
    <View style={styles.formEmbed}>{formFields}</View>
  ) : (
    <ScrollView
      style={[styles.formContainer, { flex: 1 }]}
      contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
      keyboardShouldPersistTaps={SCROLL_VIEW_KEYBOARD_PROPS.keyboardShouldPersistTaps}
      keyboardDismissMode={SCROLL_VIEW_KEYBOARD_PROPS.keyboardDismissMode}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled
    >
      {formFields}
    </ScrollView>
  );

  return (
    <View
      style={[styles.container, embedded || inBottomSheet ? styles.containerEmbedded : { flex: 1 }]}
      testID="search-form-container"
    >
      {useOuterKav ? (
        <KeyboardAvoidingView
          behavior={getKeyboardAvoidingBehavior('form')}
          style={{ flex: 1 }}
        >
          {formBody}
        </KeyboardAvoidingView>
      ) : (
        formBody
      )}

      <Modal
        visible={!!pickerMode}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            testID="picker-modal-view"
            behavior={getKeyboardAvoidingBehavior('modal')}
            style={[
              styles.pickerModal,
              { paddingBottom: 12 + (insets.bottom || 0) + keyboardHeight },
            ]}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{currentPicker?.title || ''}</Text>
              <TouchableOpacity testID="picker-close-button" onPress={closePicker} style={styles.pickerCloseBtn}>
                <Ionicons name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color="#64748b" />
              <TextInput
                testID="picker-search-input"
                style={styles.searchInput}
                placeholder="Ara..."
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            <FlatList
              testID="picker-list"
              data={filteredItems}
              keyExtractor={(item: any, idx) => String(item?.Id ?? idx)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }: any) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => selectItem(item)}>
                  <Text style={styles.pickerItemText} numberOfLines={2}>
                    {pickerMode === 'quarter' && item?.Tkgm_text
                      ? (item.Proparcel_text && item.Proparcel_text.trim() !== ''
                          ? `${item.Tkgm_text} (${item.Proparcel_text})`
                          : item.Tkgm_text)
                      : item?.Proparcel_text}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (variant: "light" | "dark") => {
  const isDark = variant === "dark";

  const COLORS = {
    bg: isDark ? "#1e293b" : "#ffffff",
    surface: isDark ? "#0f172a" : "#ffffff",
    border: isDark ? "#334155" : "#dddddd",
    borderSoft: isDark ? "#334155" : "#e2e8f0",
    text: isDark ? "#e2e8f0" : "#1f2937",
    textMuted: isDark ? "#94a3b8" : "#666666",
    placeholder: isDark ? "#64748b" : "#999999",
    accent: "#3b82f6",
    accentDark: "#1e40af",
  } as const;

  return StyleSheet.create({
  container: { flex: 1 },
  containerEmbedded: { flexGrow: 0 },
  formEmbed: { backgroundColor: COLORS.bg },
  formContainer: { flex: 1, backgroundColor: COLORS.bg },
  form: { padding: 16 },
  fieldContainer: { marginBottom: 12 },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  pickerDisabled: { backgroundColor: isDark ? "rgba(15, 23, 42, 0.55)" : "#f5f5f5", opacity: 0.6 },
  pickerText: { fontSize: 16, color: COLORS.text },
  placeholderText: { color: COLORS.placeholder },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  buttonContainer: { marginTop: 12, gap: 10 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10, gap: 8 },
  primaryButton: { backgroundColor: isDark ? COLORS.accent : COLORS.accentDark },
  secondaryButton: { backgroundColor: isDark ? COLORS.surface : "#fff", borderWidth: 1, borderColor: isDark ? COLORS.accent : COLORS.accentDark },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  secondaryButtonText: { fontSize: 16, fontWeight: '600', color: isDark ? "#e2e8f0" : COLORS.accentDark },
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { flex: 1, color: '#dc2626', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  pickerModal: { backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '75%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  pickerCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderSoft },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.surface },
  pickerItem: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerItemText: { fontSize: 16, color: COLORS.text },
});
};

export default AdaParselForm;
