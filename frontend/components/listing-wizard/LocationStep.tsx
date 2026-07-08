import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet } from "react-native";
import type { ListingWizardForm } from "../../src/types/listingWizard";
import locationsJson from "../../src/data/locations.json";

type QuarterItem = { Id: number; Tkgm_text?: string; Proparcel_text: string; Proparcel_value?: number | string };
type TownItem = { Id: number; Proparcel_text: string; Quarters: QuarterItem[] };
type CityItem = { Id: number; Proparcel_text: string; Towns: TownItem[] };
const locationsData = locationsJson as { cities: CityItem[] };

type Props = {
  form: ListingWizardForm;
  updateForm: (patch: Partial<ListingWizardForm>) => void;
  busy: boolean;
};

export default function LocationStep({ form, updateForm, busy }: Props) {
  const [picker, setPicker] = useState<"city" | "town" | "quarter" | null>(null);

  const city = useMemo(
    () => locationsData.cities.find((c) => String(c.Id) === form.cityId),
    [form.cityId],
  );
  const town = useMemo(
    () => city?.Towns.find((t) => String(t.Id) === form.districtId),
    [city, form.districtId],
  );

  const listData = useMemo(() => {
    if (picker === "city") return locationsData.cities;
    if (picker === "town") return city?.Towns || [];
    if (picker === "quarter") return town?.Quarters || [];
    return [];
  }, [picker, city, town]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Konum</Text>
      <Text style={styles.lbl}>Ada</Text>
      <TextInput
        style={styles.input}
        value={form.ada}
        onChangeText={(ada) => updateForm({ ada, locationLabels: { ...form.locationLabels, ada } })}
        editable={!busy}
      />
      <Text style={styles.lbl}>Parsel</Text>
      <TextInput
        style={styles.input}
        value={form.parsel}
        onChangeText={(parsel) => updateForm({ parsel, locationLabels: { ...form.locationLabels, parsel } })}
        editable={!busy}
      />
      <Text style={styles.lbl}>Alan (m²)</Text>
      <TextInput
        style={styles.input}
        value={form.areaM2}
        onChangeText={(areaM2) => updateForm({ areaM2 })}
        keyboardType="numeric"
        editable={!busy}
      />
      {(["city", "town", "quarter"] as const).map((mode) => {
        const label =
          mode === "city" ? "İl" : mode === "town" ? "İlçe" : "Mahalle";
        const value =
          mode === "city"
            ? city?.Proparcel_text
            : mode === "town"
              ? town?.Proparcel_text
              : town?.Quarters.find((q) => String(q.Id) === form.quarterId)?.Proparcel_text;
        const disabled = (mode === "town" && !form.cityId) || (mode === "quarter" && !form.districtId);
        return (
          <View key={mode}>
            <Text style={styles.lbl}>{label}</Text>
            <TouchableOpacity
              style={[styles.picker, disabled && styles.pickerDisabled]}
              onPress={() => !disabled && setPicker(mode)}
              disabled={disabled || busy}
            >
              <Text style={value ? styles.pickerVal : styles.pickerPh}>{value || "Seçin"}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <Modal visible={picker != null} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <FlatList
              data={listData}
              keyExtractor={(item) => String((item as CityItem).Id)}
              renderItem={({ item }) => {
                const id = String((item as CityItem).Id);
                const name =
                  (item as CityItem).Proparcel_text ||
                  (item as QuarterItem).Proparcel_text ||
                  (item as QuarterItem).Tkgm_text ||
                  id;
                return (
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => {
                      if (picker === "city") {
                        updateForm({
                          cityId: id,
                          districtId: "",
                          quarterId: "",
                          locationLabels: { ...form.locationLabels, il: name },
                        });
                      } else if (picker === "town") {
                        updateForm({
                          districtId: id,
                          quarterId: "",
                          locationLabels: { ...form.locationLabels, ilce: name },
                        });
                      } else if (picker === "quarter") {
                        const q = item as QuarterItem;
                        updateForm({
                          quarterId: id,
                          proparcelValue: q.Proparcel_value != null ? String(q.Proparcel_value) : form.proparcelValue,
                          mahalleTkgmValue: q.Tkgm_text || form.mahalleTkgmValue,
                          locationLabels: { ...form.locationLabels, mahalle: name },
                        });
                      }
                      setPicker(null);
                    }}
                  >
                    <Text>{name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity onPress={() => setPicker(null)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  lbl: { fontSize: 13, fontWeight: "600", color: "#0f172a", marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  picker: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 14,
    backgroundColor: "#fff",
  },
  pickerDisabled: { opacity: 0.5 },
  pickerVal: { color: "#0f172a" },
  pickerPh: { color: "#94a3b8" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", maxHeight: "60%", borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalClose: { padding: 16, alignItems: "center" },
  modalCloseText: { color: "#3b82f6", fontWeight: "700" },
});
