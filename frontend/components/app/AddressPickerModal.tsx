import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardHeight, SCROLL_VIEW_KEYBOARD_PROPS } from "../../src/keyboard";
import Ionicons from "react-native-vector-icons/Ionicons";
import locationsJson from "../../src/data/locations.json";

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

export type AddressValue = {
  cityId: number | null;
  cityName: string;
  districtId: number | null;
  districtName: string;
  quarterId: number | null;
  quarterName: string;
  quarterValue: number | null;
  streetAndNumber: string;
};

export function AddressPickerModal(props: {
  visible: boolean;
  title: string;
  initialValue: AddressValue;
  isSaving?: boolean;
  saveLabel?: string;
  onCancel: () => void;
  onSave: (value: AddressValue) => void;
}) {
  const { visible, title, initialValue, isSaving, saveLabel, onCancel, onSave } = props;
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [pickerMode, setPickerMode] = useState<"city" | "town" | "quarter" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const [cityId, setCityId] = useState<number | null>(null);
  const [cityName, setCityName] = useState("");
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [districtName, setDistrictName] = useState("");
  const [quarterId, setQuarterId] = useState<number | null>(null);
  const [quarterName, setQuarterName] = useState("");
  const [quarterValue, setQuarterValue] = useState<number | null>(null);
  const [streetAndNumber, setStreetAndNumber] = useState("");

  useEffect(() => {
    if (!visible) return;
    setCityId(initialValue.cityId ?? null);
    setCityName(initialValue.cityName ?? "");
    setDistrictId(initialValue.districtId ?? null);
    setDistrictName(initialValue.districtName ?? "");
    setQuarterId(initialValue.quarterId ?? null);
    setQuarterName(initialValue.quarterName ?? "");
    setQuarterValue(initialValue.quarterValue ?? null);
    setStreetAndNumber(initialValue.streetAndNumber ?? "");
    setPickerMode(null);
    setPickerSearch("");
  }, [visible, initialValue]);

  const listData = useMemo(() => {
    const q = (pickerSearch || "").trim().toLowerCase();
    if (pickerMode === "city") {
      const list = locationsData?.cities ?? [];
      return q ? list.filter((c) => (c.Proparcel_text || "").toLowerCase().includes(q)) : list;
    }
    const currentCity = locationsData?.cities?.find((c) => c.Id === cityId);
    if (pickerMode === "town") {
      const list = currentCity?.Towns ?? [];
      return q ? list.filter((t) => (t.Proparcel_text || "").toLowerCase().includes(q)) : list;
    }
    if (pickerMode === "quarter") {
      const currentTown = currentCity?.Towns?.find((t) => t.Id === districtId);
      const list = currentTown?.Quarters ?? [];
      return q ? list.filter((qu) => ((qu.Proparcel_text || qu.Tkgm_text) || "").toLowerCase().includes(q)) : list;
    }
    return [];
  }, [pickerMode, pickerSearch, cityId, districtId]);

  const handlePick = (item: CityItem | TownItem | QuarterItem) => {
    if (pickerMode === "city") {
      const c = item as CityItem;
      setCityId(c.Id);
      setCityName(c.Proparcel_text || "");
      setDistrictId(null);
      setDistrictName("");
      setQuarterId(null);
      setQuarterName("");
      setQuarterValue(null);
    } else if (pickerMode === "town") {
      const t = item as TownItem;
      setDistrictId(t.Id);
      setDistrictName(t.Proparcel_text || "");
      setQuarterId(null);
      setQuarterName("");
      setQuarterValue(null);
    } else if (pickerMode === "quarter") {
      const qu = item as QuarterItem;
      setQuarterId(qu.Id);
      setQuarterName(qu.Proparcel_text || qu.Tkgm_text || "");
      const qvRaw = qu.Proparcel_value as any;
      const qv = qvRaw === null || qvRaw === undefined || qvRaw === "" ? null : Number(qvRaw);
      setQuarterValue(Number.isFinite(qv) ? qv : null);
    }
    setPickerSearch("");
    setPickerMode(null);
  };

  const currentValue: AddressValue = {
    cityId,
    cityName,
    districtId,
    districtName,
    quarterId,
    quarterName,
    quarterValue,
    streetAndNumber,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setPickerMode(null);
        onCancel();
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity
              onPress={() => {
                setPickerMode(null);
                onCancel();
              }}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalScrollView}>
            <View style={styles.addressModalField}>
              <TouchableOpacity style={styles.addressPickerTouch} onPress={() => setPickerMode("city")}>
                <Text style={[styles.addressPickerText, !cityName && styles.placeholderText]}>{cityName || "İl"}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.addressModalField}>
              <TouchableOpacity
                style={[styles.addressPickerTouch, !cityId && styles.addressPickerDisabled]}
                onPress={() => cityId && setPickerMode("town")}
                disabled={!cityId}
              >
                <Text style={[styles.addressPickerText, !districtName && styles.placeholderText]}>{districtName || "İlçe"}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.addressModalField}>
              <TouchableOpacity
                style={[styles.addressPickerTouch, !districtId && styles.addressPickerDisabled]}
                onPress={() => districtId && setPickerMode("quarter")}
                disabled={!districtId}
              >
                <Text style={[styles.addressPickerText, !quarterName && styles.placeholderText]}>{quarterName || "Mahalle"}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.addressModalField}>
              <TextInput
                style={styles.input}
                value={streetAndNumber}
                onChangeText={setStreetAndNumber}
                placeholder="Sokak, Kapı No, Kat, Daire"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalSaveButton, styles.addressUpdateButton]}
              onPress={() => onSave(currentValue)}
              disabled={!!isSaving}
            >
              <Text style={styles.modalSaveButtonText}>{saveLabel || "Kaydet"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={pickerMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerMode(null)}
      >
        <View style={styles.modalOverlay}>
          {/* picker: View + keyboardHeight padding (merkezi useKeyboardHeight) */}
          <View
            style={[
              styles.modalContent,
              styles.pickerModalContent,
              { paddingBottom: 12 + insets.bottom + keyboardHeight },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerMode === "city" && "İl seçin"}
                {pickerMode === "town" && "İlçe seçin"}
                {pickerMode === "quarter" && "Mahalle seçin"}
              </Text>
              <TouchableOpacity onPress={() => setPickerMode(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.pickerSearchInput]}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Ara..."
              placeholderTextColor="#94a3b8"
            />

            <FlatList
              data={listData}
              keyExtractor={(item: any) => String(item?.Id)}
              keyboardShouldPersistTaps={SCROLL_VIEW_KEYBOARD_PROPS.keyboardShouldPersistTaps}
              renderItem={({ item }: { item: any }) => {
                const label = item?.Proparcel_text || item?.Tkgm_text || "";
                return (
                  <TouchableOpacity style={styles.pickerItemRow} onPress={() => handlePick(item)}>
                    <Text style={styles.pickerItemText} numberOfLines={2}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalScrollView: {
    width: "100%",
  },
  addressModalField: {
    marginBottom: 12,
  },
  addressPickerTouch: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
  },
  addressPickerDisabled: {
    opacity: 0.5,
  },
  addressPickerText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  placeholderText: {
    color: "#94a3b8",
    fontWeight: "400",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveButton: {
    backgroundColor: "#2563eb",
  },
  modalSaveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  addressUpdateButton: {
    marginTop: 6,
  },
  pickerModalContent: {
    paddingTop: 16,
  },
  pickerSearchInput: {
    marginBottom: 10,
  },
  pickerItemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  pickerItemText: {
    color: "#0f172a",
    fontSize: 15,
  },
});

