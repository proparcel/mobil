import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SCROLL_VIEW_KEYBOARD_PROPS, useKeyboardHeight } from "../../src/keyboard";
import { sheetScrollBottomPadding } from "../../src/utils/sheetSafeArea";
import { normalizeTr } from "../../src/utils/voiceLocationResolve";
import locationsJson from "../../src/data/locations.json";
import VoiceExpertiseLocationModal from "./VoiceExpertiseLocationModal";
import type { RegistrationCompanyItem } from "../../src/types/auth";
import type {
  VoiceRegistrationCorporateType,
  VoiceRegistrationMemberType,
} from "../../src/types/voiceRegistration";

type QuarterItem = {
  Id: number;
  Tkgm_text?: string;
  Proparcel_text: string;
  Proparcel_value?: number | string;
};
type TownItem = { Id: number; Proparcel_text: string; Quarters: QuarterItem[] };
type CityItem = { Id: number; Proparcel_text: string; Towns: TownItem[] };
type LocationsData = { cities: CityItem[] };
const locationsData = locationsJson as unknown as LocationsData;

export type ExpertiseQuarterSelection = { quarter_value: number; label: string };
export type ExpertiseCitySelection = { city_id: number; label: string };

export type RegistrationExpertiseValue = {
  quarters: ExpertiseQuarterSelection[];
  cities: ExpertiseCitySelection[];
};

type Props = {
  mode: "quarters" | "cities";
  value: RegistrationExpertiseValue;
  onChange: (next: RegistrationExpertiseValue) => void;
  onContinue: () => void;
  onSkip: () => void;
  busy?: boolean;
  voiceMemberType?: VoiceRegistrationMemberType;
  voiceCorporateType?: VoiceRegistrationCorporateType | null;
  voiceSelectedCompany?: RegistrationCompanyItem | null;
};

export function RegistrationExpertiseStep({
  mode,
  value,
  onChange,
  onContinue,
  onSkip,
  busy,
  voiceMemberType,
  voiceCorporateType,
  voiceSelectedCompany,
}: Props) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [pickerMode, setPickerMode] = useState<"city" | "town" | "quarter" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [expCityId, setExpCityId] = useState<number | null>(null);
  const [expCityName, setExpCityName] = useState("");
  const [expTownId, setExpTownId] = useState<number | null>(null);
  const [expTownName, setExpTownName] = useState("");
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  const selectedCount = mode === "cities" ? value.cities.length : value.quarters.length;
  const voiceEnabled = voiceMemberType != null;

  const pickerListData = useMemo(() => {
    const q = normalizeTr(pickerSearch || "");
    if (mode === "cities" && pickerMode === "city") {
      const list = locationsData?.cities ?? [];
      return q ? list.filter((c) => normalizeTr(c.Proparcel_text || "").includes(q)) : list;
    }
    if (mode === "quarters") {
      if (pickerMode === "city") {
        const list = locationsData?.cities ?? [];
        return q ? list.filter((c) => normalizeTr(c.Proparcel_text || "").includes(q)) : list;
      }
      const currentCity = locationsData?.cities?.find((c) => c.Id === expCityId);
      if (pickerMode === "town") {
        const list = currentCity?.Towns ?? [];
        return q ? list.filter((t) => normalizeTr(t.Proparcel_text || "").includes(q)) : list;
      }
      if (pickerMode === "quarter") {
        const currentTown = currentCity?.Towns?.find((t) => t.Id === expTownId);
        const list = currentTown?.Quarters ?? [];
        return q
          ? list.filter((qu) =>
              normalizeTr((qu.Proparcel_text || qu.Tkgm_text) || "").includes(q),
            )
          : list;
      }
    }
    return [];
  }, [mode, pickerMode, pickerSearch, expCityId, expTownId]);

  const addCity = (city: CityItem) => {
    if (value.cities.some((c) => c.city_id === city.Id)) return;
    if (value.cities.length >= 5) return;
    onChange({
      ...value,
      cities: [
        ...value.cities,
        { city_id: city.Id, label: city.Proparcel_text || String(city.Id) },
      ],
    });
  };

  const addQuarter = (qu: QuarterItem) => {
    const qvRaw = qu.Proparcel_value as number | string | null | undefined;
    const qv = qvRaw === null || qvRaw === undefined || qvRaw === "" ? null : Number(qvRaw);
    if (!Number.isFinite(qv)) return;
    if (value.quarters.some((s) => s.quarter_value === qv)) return;
    if (value.quarters.length >= 5) return;
    onChange({
      ...value,
      quarters: [
        ...value.quarters,
        { quarter_value: qv as number, label: qu.Proparcel_text || qu.Tkgm_text || "" },
      ],
    });
  };

  const removeCity = (cityId: number) => {
    onChange({ ...value, cities: value.cities.filter((c) => c.city_id !== cityId) });
  };

  const removeQuarter = (qv: number) => {
    onChange({ ...value, quarters: value.quarters.filter((q) => q.quarter_value !== qv) });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Uzmanlık Bölgeleri</Text>
      <Text style={styles.cardHint}>
        {mode === "cities"
          ? "Ana uzmanlık illerinizi seçin (en fazla 5). Bu adım isteğe bağlıdır."
          : "Uzmanlık mahallelerinizi seçin (en fazla 5). Bu adım isteğe bağlıdır."}
      </Text>

      {voiceEnabled && selectedCount < 5 ? (
        <TouchableOpacity
          style={styles.voiceBtn}
          onPress={() => setVoiceModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Sesli Komut ile Bölge Ekle"
        >
          <Ionicons name="mic-outline" size={20} color="#1d4ed8" />
          <Text style={styles.voiceBtnText}>Sesli Komut ile Bölge Ekle</Text>
        </TouchableOpacity>
      ) : null}

      {mode === "cities" ? (
        <>
          <TouchableOpacity
            style={[styles.dropdown, selectedCount >= 5 && styles.dropdownDisabled]}
            onPress={() => {
              if (selectedCount < 5) {
                setPickerSearch("");
                setPickerMode("city");
              }
            }}
            disabled={selectedCount >= 5}
          >
            <Text style={[styles.dropdownText, styles.placeholder]}>İl ekle</Text>
            <Ionicons name="chevron-down" size={18} color="#64748b" />
          </TouchableOpacity>
          <View style={styles.chips}>
            {value.cities.map((c) => (
              <View key={c.city_id} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {c.label}
                </Text>
                <TouchableOpacity onPress={() => removeCity(c.city_id)}>
                  <Ionicons name="close" size={16} color="#0f172a" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => {
                setPickerSearch("");
                setPickerMode("city");
              }}
            >
              <Text style={[styles.dropdownText, !expCityName && styles.placeholder]}>
                {expCityName || "İl"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.dropdown, !expCityId && styles.dropdownDisabled]}
              onPress={() => {
                if (expCityId) {
                  setPickerSearch("");
                  setPickerMode("town");
                }
              }}
              disabled={!expCityId}
            >
              <Text style={[styles.dropdownText, !expTownName && styles.placeholder]}>
                {expTownName || "İlçe"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.dropdown, (!expTownId || selectedCount >= 5) && styles.dropdownDisabled]}
              onPress={() => {
                if (expTownId && selectedCount < 5) {
                  setPickerSearch("");
                  setPickerMode("quarter");
                }
              }}
              disabled={!expTownId || selectedCount >= 5}
            >
              <Text style={[styles.dropdownText, styles.placeholder]}>Mahalle ekle</Text>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.counter}>{selectedCount}/5</Text>
          </View>
          <View style={styles.chips}>
            {value.quarters.map((q) => (
              <View key={q.quarter_value} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {q.label}
                </Text>
                <TouchableOpacity onPress={() => removeQuarter(q.quarter_value)}>
                  <Ionicons name="close" size={16} color="#0f172a" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}

      {selectedCount >= 5 ? <Text style={styles.warn}>5/5 dolu</Text> : null}

      <TouchableOpacity style={styles.primaryButton} onPress={onContinue} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Devam</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={onSkip} disabled={busy}>
        <Text style={styles.secondaryButtonText}>Atla</Text>
      </TouchableOpacity>

      <Modal
        visible={pickerMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPickerSearch("");
          setPickerMode(null);
        }}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalWrap}>
            <View style={[styles.pickerModal, { paddingBottom: sheetScrollBottomPadding(insets.bottom, 12) }]}>
              <View style={styles.pickerHeader}>
                <Text style={styles.modalTitle}>
                  {pickerMode === "city" && "İl seçin"}
                  {pickerMode === "town" && "İlçe seçin"}
                  {pickerMode === "quarter" && "Mahalle seçin"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setPickerSearch("");
                    setPickerMode(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.searchInput}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Ara..."
                placeholderTextColor="#94a3b8"
                autoCorrect={false}
                autoCapitalize="none"
              />
              <FlatList
                style={styles.pickerList}
                contentContainerStyle={
                  keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined
                }
                data={pickerListData}
                keyExtractor={(item: CityItem | TownItem | QuarterItem) => String(item.Id)}
                keyboardShouldPersistTaps={SCROLL_VIEW_KEYBOARD_PROPS.keyboardShouldPersistTaps}
                keyboardDismissMode={SCROLL_VIEW_KEYBOARD_PROPS.keyboardDismissMode}
                ListEmptyComponent={
                  pickerSearch.trim() ? (
                    <Text style={styles.pickerEmptyText}>Sonuç bulunamadı</Text>
                  ) : null
                }
                renderItem={({ item }) => {
                  const label =
                    "Proparcel_text" in item
                      ? item.Proparcel_text || ("Tkgm_text" in item ? item.Tkgm_text : "")
                      : "";
                  return (
                    <TouchableOpacity
                      style={styles.pickerRow}
                      onPress={() => {
                        if (pickerMode === "city") {
                          const city = item as CityItem;
                          if (mode === "cities") {
                            addCity(city);
                          } else {
                            setExpCityId(city.Id);
                            setExpCityName(city.Proparcel_text || "");
                            setExpTownId(null);
                            setExpTownName("");
                          }
                        } else if (pickerMode === "town") {
                          const town = item as TownItem;
                          setExpTownId(town.Id);
                          setExpTownName(town.Proparcel_text || "");
                        } else if (pickerMode === "quarter") {
                          addQuarter(item as QuarterItem);
                        }
                        setPickerSearch("");
                        setPickerMode(null);
                      }}
                    >
                      <Text style={styles.pickerText} numberOfLines={2}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {voiceEnabled && voiceMemberType ? (
        <VoiceExpertiseLocationModal
          visible={voiceModalVisible}
          mode={mode}
          memberType={voiceMemberType}
          corporateType={voiceCorporateType ?? null}
          selectedCompany={voiceSelectedCompany ?? null}
          currentValue={value}
          onApply={onChange}
          onClose={() => setVoiceModalVisible(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 24,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 8 },
  cardHint: { fontSize: 14, color: "#6b7280", marginBottom: 12, lineHeight: 20 },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  voiceBtnText: {
    color: "#1d4ed8",
    fontSize: 15,
    fontWeight: "700",
  },
  row: { marginTop: 10, flexDirection: "row", alignItems: "center" },
  dropdown: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  dropdownDisabled: { opacity: 0.5 },
  dropdownText: { color: "#111827", fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  placeholder: { color: "#999", fontWeight: "400" },
  counter: { color: "#6b7280", marginLeft: 10, fontWeight: "700" },
  warn: { color: "#d97706", marginTop: 10, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: "100%",
  },
  chipText: { color: "#0f172a", fontWeight: "700", maxWidth: 240 },
  primaryButton: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#fff",
  },
  secondaryButtonText: { color: "#334155", fontSize: 16, fontWeight: "600" },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerModalWrap: {
    width: "100%",
    height: "75%",
    maxHeight: "85%",
  },
  pickerModal: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pickerList: {
    flex: 1,
    minHeight: 0,
  },
  pickerEmptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  pickerText: { color: "#0f172a", fontSize: 15 },
});
