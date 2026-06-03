import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  type ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  getKeyboardAvoidingBehavior,
  SCROLL_VIEW_KEYBOARD_PROPS,
  useKeyboardHeight,
  useScrollInputIntoView,
} from "../../src/keyboard";
import locationsJson from "../../src/data/locations.json";
import type { AddressValue } from "./AddressPickerModal";
import { sheetScrollBottomPadding } from "../../src/utils/sheetSafeArea";

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

export function AddressFormFields(props: {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  errors?: { address?: string; streetAndNumber?: string };
  /** Uzun kayıt formu scroll'u — sokak alanı odakta görünür kalsın */
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const { value, onChange, errors, scrollRef } = props;
  const streetWrapRef = useRef<View>(null);
  const fallbackScrollRef = useRef<ScrollView>(null);
  const { handleFocus: scrollStreetIntoView, handleBlur: scrollStreetBlur } = useScrollInputIntoView({
    scrollRef: scrollRef ?? fallbackScrollRef,
    inputWrapRef: streetWrapRef,
  });
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [pickerMode, setPickerMode] = useState<"city" | "town" | "quarter" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const listData = useMemo(() => {
    const q = (pickerSearch || "").trim().toLowerCase();
    if (pickerMode === "city") {
      const list = locationsData?.cities ?? [];
      return q ? list.filter((c) => (c.Proparcel_text || "").toLowerCase().includes(q)) : list;
    }
    const currentCity = locationsData?.cities?.find((c) => c.Id === value.cityId);
    if (pickerMode === "town") {
      const list = currentCity?.Towns ?? [];
      return q ? list.filter((t) => (t.Proparcel_text || "").toLowerCase().includes(q)) : list;
    }
    if (pickerMode === "quarter") {
      const currentTown = currentCity?.Towns?.find((t) => t.Id === value.districtId);
      const list = currentTown?.Quarters ?? [];
      return q ? list.filter((qu) => ((qu.Proparcel_text || qu.Tkgm_text) || "").toLowerCase().includes(q)) : list;
    }
    return [];
  }, [pickerMode, pickerSearch, value.cityId, value.districtId]);

  const handlePick = (item: CityItem | TownItem | QuarterItem) => {
    if (pickerMode === "city") {
      const c = item as CityItem;
      onChange({
        cityId: c.Id,
        cityName: c.Proparcel_text || "",
        districtId: null,
        districtName: "",
        quarterId: null,
        quarterName: "",
        quarterValue: null,
        streetAndNumber: value.streetAndNumber,
      });
    } else if (pickerMode === "town") {
      const t = item as TownItem;
      onChange({
        ...value,
        districtId: t.Id,
        districtName: t.Proparcel_text || "",
        quarterId: null,
        quarterName: "",
        quarterValue: null,
      });
    } else if (pickerMode === "quarter") {
      const qu = item as QuarterItem;
      const qvRaw = qu.Proparcel_value as any;
      const qv = qvRaw === null || qvRaw === undefined || qvRaw === "" ? null : Number(qvRaw);
      onChange({
        ...value,
        quarterId: qu.Id,
        quarterName: qu.Proparcel_text || qu.Tkgm_text || "",
        quarterValue: Number.isFinite(qv) ? qv : null,
      });
    }
    setPickerSearch("");
    setPickerMode(null);
  };

  return (
    <>
      <View style={styles.field}>
        <TouchableOpacity
          style={[styles.pickerTouch, errors?.address && styles.pickerTouchError]}
          onPress={() => {
            setPickerSearch("");
            setPickerMode("city");
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.pickerText, !value.cityName && styles.placeholderText]}>
            {value.cityName || "İl *"}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <TouchableOpacity
          style={[
            styles.pickerTouch,
            !value.cityId && styles.pickerTouchDisabled,
            errors?.address && styles.pickerTouchError,
          ]}
          onPress={() => {
            if (!value.cityId) return;
            setPickerSearch("");
            setPickerMode("town");
          }}
          disabled={!value.cityId}
          activeOpacity={0.85}
        >
          <Text style={[styles.pickerText, !value.districtName && styles.placeholderText]}>
            {value.districtName || "İlçe *"}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <TouchableOpacity
          style={[
            styles.pickerTouch,
            !value.districtId && styles.pickerTouchDisabled,
            errors?.address && styles.pickerTouchError,
          ]}
          onPress={() => {
            if (!value.districtId) return;
            setPickerSearch("");
            setPickerMode("quarter");
          }}
          disabled={!value.districtId}
          activeOpacity={0.85}
        >
          <Text style={[styles.pickerText, !value.quarterName && styles.placeholderText]}>
            {value.quarterName || "Mahalle *"}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <View ref={streetWrapRef} collapsable={false} style={styles.field}>
        <TextInput
          style={[styles.input, errors?.streetAndNumber && styles.inputError]}
          value={value.streetAndNumber}
          onChangeText={(streetAndNumber) => onChange({ ...value, streetAndNumber })}
          placeholder="Sokak, kapı no, kat, daire *"
          placeholderTextColor="#999"
          onFocus={scrollRef ? scrollStreetIntoView : undefined}
          onBlur={scrollRef ? scrollStreetBlur : undefined}
        />
      </View>

      {errors?.address ? <Text style={styles.fieldError}>{errors.address}</Text> : null}
      {errors?.streetAndNumber ? <Text style={styles.fieldError}>{errors.streetAndNumber}</Text> : null}

      <Modal
        visible={pickerMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerMode(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={getKeyboardAvoidingBehavior("modal")}
        >
          <View style={[styles.pickerSheet, { paddingBottom: sheetScrollBottomPadding(insets.bottom, 12) }]}>
            <View style={styles.modalHeader}>
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
              style={[styles.input, styles.pickerSearchInput]}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Ara..."
              placeholderTextColor="#94a3b8"
            />

            <FlatList
              style={styles.pickerList}
              contentContainerStyle={
                keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined
              }
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
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 10,
  },
  pickerTouch: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: "#fafafa",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTouchDisabled: {
    opacity: 0.5,
  },
  pickerTouchError: {
    borderColor: "#dc3545",
  },
  pickerText: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
    marginRight: 12,
  },
  placeholderText: {
    color: "#999",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: "#fafafa",
    color: "#111827",
  },
  inputError: {
    borderColor: "#dc3545",
  },
  fieldError: {
    color: "#dc3545",
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    width: "100%",
    height: "75%",
    maxHeight: "85%",
  },
  pickerList: {
    flex: 1,
    minHeight: 0,
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
