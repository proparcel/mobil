/**
 * OTP sonrası tamamlayıcı onboarding:
 * Avatar → Adres → Uzmanlık Bölgeleri (Danışman/Kurumsal)
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { launchImageLibrary } from "react-native-image-picker";
import Ionicons from "react-native-vector-icons/Ionicons";

import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { useKeyboardHeight, getKeyboardAvoidingBehavior } from "../../src/keyboard";
import { authService } from "../../services/authService";
import { AddressPickerModal, type AddressValue } from "../../components/app/AddressPickerModal";
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

type Step = "avatar" | "address" | "expertise";

export default function CompleteRegistrationScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  const [step, setStep] = useState<Step>("avatar");
  const [loading, setLoading] = useState(false);

  // Avatar upload
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [showRemoveBgModal, setShowRemoveBgModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Address
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressInitial, setAddressInitial] = useState<AddressValue>({
    cityId: null,
    cityName: "",
    districtId: null,
    districtName: "",
    quarterId: null,
    quarterName: "",
    quarterValue: null,
    streetAndNumber: "",
  });

  // Expertise picker state
  const [expertisePickerMode, setExpertisePickerMode] = useState<"city" | "town" | "quarter" | null>(null);
  const [expertisePickerSearch, setExpertisePickerSearch] = useState("");
  const [expCityId, setExpCityId] = useState<number | null>(null);
  const [expCityName, setExpCityName] = useState("");
  const [expTownId, setExpTownId] = useState<number | null>(null);
  const [expTownName, setExpTownName] = useState("");
  const [expQuarterId, setExpQuarterId] = useState<number | null>(null);
  const [expQuarterName, setExpQuarterName] = useState("");
  const [selectedQuarters, setSelectedQuarters] = useState<Array<{ quarter_value: number; label: string }>>([]);
  const [savingExpertise, setSavingExpertise] = useState(false);

  const isConsultantOrBroker = user?.role === "consultant" || user?.role === "broker";

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("login");
      return;
    }
    if (!isConsultantOrBroker) {
      router.replace("index");
      return;
    }
    // Prefill address from profile if exists
    (async () => {
      setLoading(true);
      try {
        const res = await authService.getProfile();
        if (res.success && res.data) {
          const p = res.data.profile as any;
          setAddressInitial({
            cityId: p.city_id ?? null,
            cityName: p.city_name ?? "",
            districtId: p.district_id ?? null,
            districtName: p.district_name ?? "",
            quarterId: p.quarter_id ?? null,
            quarterName: p.quarter_name ?? "",
            quarterValue: p.quarter_value ?? null,
            streetAndNumber: p.street_and_number ?? "",
          });
        }
      } catch {
        // best-effort
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, isConsultantOrBroker]);

  useEffect(() => {
    if (step === "address") setShowAddressModal(true);
  }, [step]);

  const handleAvatarPick = async () => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      quality: 0.8,
      selectionLimit: 1,
    });
    if (result.assets && result.assets[0] && result.assets[0].uri) {
      setPendingAvatarUri(result.assets[0].uri);
      setShowRemoveBgModal(true);
    }
  };

  const handleAvatarRemoveBgChoice = async (removeBackground: boolean) => {
    if (!pendingAvatarUri) return;
    setUploadingAvatar(true);
    setShowRemoveBgModal(false);
    const uri = pendingAvatarUri;
    setPendingAvatarUri(null);
    try {
      const response = await authService.uploadAvatar(uri, { remove_background: removeBackground });
      if (response.success) {
        Alert.alert("Başarılı", "Profil fotoğrafınız yüklendi ve onaya gönderildi.");
        setStep("address");
      } else {
        Alert.alert("Hata", response.message || "Fotoğraf yüklenemedi");
      }
    } catch {
      Alert.alert("Hata", "Fotoğraf yüklenirken bir hata oluştu");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveAddress = async (addr: AddressValue) => {
    // Adres zorunlu: en az il+ilçe
    if (!addr.cityId || !addr.districtId) {
      Alert.alert("Uyarı", "Lütfen il ve ilçe seçin.");
      return;
    }
    setLoading(true);
    try {
      const response = await authService.updateProfile({
        city_id: addr.cityId,
        city_name: addr.cityName,
        district_id: addr.districtId,
        district_name: addr.districtName,
        quarter_id: addr.quarterId ?? undefined,
        quarter_name: addr.quarterName,
        quarter_value: addr.quarterValue ?? undefined,
        street_and_number: addr.streetAndNumber,
        address_line1: addr.streetAndNumber,
        city: addr.cityName,
        district: addr.districtName,
      });
      if (response.success) {
        setShowAddressModal(false);
        setStep("expertise");
      } else {
        Alert.alert("Hata", response.message || "Adres kaydedilemedi");
      }
    } finally {
      setLoading(false);
    }
  };

  const expertiseListData = useMemo(() => {
    const q = (expertisePickerSearch || "").trim().toLowerCase();
    if (expertisePickerMode === "city") {
      const list = locationsData?.cities ?? [];
      return q ? list.filter((c) => (c.Proparcel_text || "").toLowerCase().includes(q)) : list;
    }
    const currentCity = locationsData?.cities?.find((c) => c.Id === expCityId);
    if (expertisePickerMode === "town") {
      const list = currentCity?.Towns ?? [];
      return q ? list.filter((t) => (t.Proparcel_text || "").toLowerCase().includes(q)) : list;
    }
    if (expertisePickerMode === "quarter") {
      const currentTown = currentCity?.Towns?.find((t) => t.Id === expTownId);
      const list = currentTown?.Quarters ?? [];
      return q ? list.filter((qu) => ((qu.Proparcel_text || qu.Tkgm_text) || "").toLowerCase().includes(q)) : list;
    }
    return [];
  }, [expertisePickerMode, expertisePickerSearch, expCityId, expTownId]);

  const addSelectedQuarter = (qu: QuarterItem) => {
    const qvRaw = qu.Proparcel_value as any;
    const qv = qvRaw === null || qvRaw === undefined || qvRaw === "" ? null : Number(qvRaw);
    if (!Number.isFinite(qv)) return;
    if (selectedQuarters.some((s) => s.quarter_value === qv)) return;
    if (selectedQuarters.length >= 5) return;
    const label = qu.Proparcel_text || qu.Tkgm_text || "";
    setSelectedQuarters((prev) => [...prev, { quarter_value: qv, label }]);
  };

  const removeSelectedQuarter = (qv: number) => {
    setSelectedQuarters((prev) => prev.filter((x) => x.quarter_value !== qv));
  };

  const handleSaveExpertise = async () => {
    if (selectedQuarters.length < 1) {
      Alert.alert("Uyarı", "En az 1 uzmanlık bölgesi seçmelisiniz.");
      return;
    }
    setSavingExpertise(true);
    try {
      const res = await authService.updateExpertiseAreas(selectedQuarters.map((x) => x.quarter_value));
      if (res.success) {
        Alert.alert("Başarılı", "Kayıt tamamlandı.");
        router.replace("index");
      } else {
        Alert.alert("Hata", res.message || "Uzmanlık bölgeleri kaydedilemedi");
      }
    } finally {
      setSavingExpertise(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kayıt Tamamlama</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.subHeader}>
        <Text style={styles.subtitle}>
          {step === "avatar" && "1/3 Profil fotoğrafı"}
          {step === "address" && "2/3 Adres"}
          {step === "expertise" && "3/3 Uzmanlık Bölgeleri"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
        </View>
      ) : null}

      {step === "avatar" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profil Fotoğrafı</Text>
          <Text style={styles.cardHint}>Fotoğraf yükleyin. İsterseniz arka planı temizleyebiliriz.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAvatarPick} disabled={uploadingAvatar}>
            {uploadingAvatar ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Fotoğraf Seç</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep("address")} disabled={uploadingAvatar}>
            <Text style={styles.secondaryButtonText}>Şimdilik Geç</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === "expertise" && (
        <KeyboardAwareScrollScreen headerHeight={56} backgroundColor="#f8fafc" contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Uzmanlık Bölgeleri</Text>
            <Text style={styles.cardHint}>İl/ilçe/mahalle seçin. Mahalle seçince aşağıda eklenir. En fazla 5.</Text>

            <View style={styles.row}>
              <TouchableOpacity style={styles.dropdown} onPress={() => setExpertisePickerMode("city")}>
                <Text style={[styles.dropdownText, !expCityName && styles.placeholder]}>{expCityName || "İl"}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.dropdown, !expCityId && styles.dropdownDisabled]}
                onPress={() => expCityId && setExpertisePickerMode("town")}
                disabled={!expCityId}
              >
                <Text style={[styles.dropdownText, !expTownName && styles.placeholder]}>{expTownName || "İlçe"}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.dropdown,
                  (!expTownId || selectedQuarters.length >= 5) && styles.dropdownDisabled,
                ]}
                onPress={() => expTownId && selectedQuarters.length < 5 && setExpertisePickerMode("quarter")}
                disabled={!expTownId || selectedQuarters.length >= 5}
              >
                <Text style={[styles.dropdownText, !expQuarterName && styles.placeholder]}>
                  {expQuarterName || "Mahalle"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.counter}>{selectedQuarters.length}/5</Text>
            </View>

            {selectedQuarters.length >= 5 ? <Text style={styles.warn}>5/5 dolu</Text> : null}

            <View style={styles.chips}>
              {selectedQuarters.map((q) => (
                <View key={q.quarter_value} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {q.label}
                  </Text>
                  <TouchableOpacity onPress={() => removeSelectedQuarter(q.quarter_value)}>
                    <Ionicons name="close" size={16} color="#0f172a" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveExpertise} disabled={savingExpertise}>
              {savingExpertise ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Kaydet ve Bitir</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollScreen>
      )}

      {/* Address modal step */}
      <AddressPickerModal
        visible={showAddressModal}
        title="Adres Ekle"
        initialValue={addressInitial}
        isSaving={loading}
        saveLabel="Kaydet"
        onCancel={() => {
          Alert.alert("Uyarı", "Danışman/Kurumsal üyelik için adres adımı zorunludur.");
        }}
        onSave={handleSaveAddress}
      />

      {/* Remove background modal */}
      <Modal visible={showRemoveBgModal} transparent animationType="fade" onRequestClose={() => setShowRemoveBgModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowRemoveBgModal(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Arka Plan Temizlensin mi?</Text>
            <Text style={styles.modalText}>Evet seçerseniz fotoğraf arka planı otomatik temizlenir.</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={() => handleAvatarRemoveBgChoice(true)}>
                <Text style={styles.primaryButtonText}>Evet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => handleAvatarRemoveBgChoice(false)}>
                <Text style={styles.secondaryButtonText}>Hayır</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Expertise picker modal */}
      <Modal
        visible={expertisePickerMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setExpertisePickerMode(null)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={getKeyboardAvoidingBehavior('modal')}
            style={[styles.pickerBox, { paddingBottom: 12 + insets.bottom + keyboardHeight }]}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.modalTitle}>
                {expertisePickerMode === "city" && "İl seçin"}
                {expertisePickerMode === "town" && "İlçe seçin"}
                {expertisePickerMode === "quarter" && "Mahalle seçin"}
              </Text>
              <TouchableOpacity onPress={() => setExpertisePickerMode(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              value={expertisePickerSearch}
              onChangeText={setExpertisePickerSearch}
              placeholder="Ara..."
              placeholderTextColor="#94a3b8"
            />
            <FlatList
              data={expertiseListData}
              keyExtractor={(item: any) => String(item?.Id)}
              renderItem={({ item }: { item: any }) => {
                const label = item?.Proparcel_text || item?.Tkgm_text || "";
                return (
                  <TouchableOpacity
                    style={styles.pickerRow}
                    onPress={() => {
                      if (expertisePickerMode === "city") {
                        const c = item as CityItem;
                        setExpCityId(c.Id);
                        setExpCityName(c.Proparcel_text || "");
                        setExpTownId(null);
                        setExpTownName("");
                        setExpQuarterId(null);
                        setExpQuarterName("");
                      } else if (expertisePickerMode === "town") {
                        const t = item as TownItem;
                        setExpTownId(t.Id);
                        setExpTownName(t.Proparcel_text || "");
                        setExpQuarterId(null);
                        setExpQuarterName("");
                      } else if (expertisePickerMode === "quarter") {
                        const qu = item as QuarterItem;
                        setExpQuarterId(qu.Id);
                        setExpQuarterName(qu.Proparcel_text || qu.Tkgm_text || "");
                        addSelectedQuarter(qu);
                        // Dropdown reset (öneri)
                        setExpQuarterId(null);
                        setExpQuarterName("");
                      }
                      setExpertisePickerSearch("");
                      setExpertisePickerMode(null);
                    }}
                  >
                    <Text style={styles.pickerText} numberOfLines={2}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "#3b82f6",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold", flex: 1, textAlign: "center" },
  headerRight: { width: 36, height: 36 },
  subHeader: { paddingHorizontal: 16, paddingTop: 12 },
  subtitle: { color: "#94a3b8" },
  loadingBox: { padding: 16 },

  card: {
    margin: 16,
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  cardHint: { color: "#94a3b8", marginBottom: 12, lineHeight: 20 },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: { color: "#cbd5e1", fontWeight: "700" },

  row: { marginTop: 10, flexDirection: "row", alignItems: "center" },
  dropdown: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0b1220",
  },
  dropdownDisabled: { opacity: 0.5 },
  dropdownText: { color: "#e2e8f0", fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  placeholder: { color: "#64748b", fontWeight: "400" },
  counter: { color: "#94a3b8", marginLeft: 10, fontWeight: "700" },
  warn: { color: "#fbbf24", marginTop: 10, fontWeight: "700" },
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

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 16 },
  modalBox: { backgroundColor: "#fff", borderRadius: 14, padding: 16, width: "100%", maxWidth: 420 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalText: { color: "#475569", marginTop: 8, marginBottom: 14, lineHeight: 20 },

  pickerBox: { backgroundColor: "#fff", borderRadius: 14, padding: 16, width: "100%", maxWidth: 420, maxHeight: "85%" },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  searchInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  pickerText: { color: "#0f172a", fontSize: 15 },
});

