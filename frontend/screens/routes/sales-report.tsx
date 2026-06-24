import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../src/hooks/useNavigation";
import {
  submitSalesReport,
  type SalesReportPropertyType,
} from "../../services/salesReportService";

const PROPERTY_TYPE_OPTIONS: Array<{ label: string; value: SalesReportPropertyType }> = [
  { label: "Arsa", value: "Arsa" },
  { label: "Tarla", value: "Tarla" },
  { label: "Köy içi", value: "Köy içi" },
  { label: "Ticari", value: "Ticari" },
];
import { launchImageLibrary } from "react-native-image-picker";

export default function SalesReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [cityName, setCityName] = useState("");
  const [townName, setTownName] = useState("");
  const [mahalle, setMahalle] = useState("");
  const [ada, setAda] = useState("");
  const [parsel, setParsel] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [propertyType, setPropertyType] = useState<SalesReportPropertyType>("Arsa");
  const [receipt, setReceipt] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickReceipt = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      quality: 0.85,
      selectionLimit: 1,
    });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert("Hata", result.errorMessage || "Dosya seçilemedi");
      return;
    }
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      Alert.alert("Hata", "Dosya seçilemedi");
      return;
    }
    const name = asset.fileName || `receipt_${Date.now()}.jpg`;
    const type = asset.type || "image/jpeg";
    setReceipt({ uri: asset.uri, name, type } as any);
  }, []);

  const onSubmit = useCallback(async () => {
    if (!mahalle || !ada || !parsel) {
      Alert.alert("Eksik", "Mahalle/Ada/Parsel zorunlu.");
      return;
    }
    if (!receipt) {
      Alert.alert("Eksik", "Dekont dosyası zorunlu.");
      return;
    }
    if (!salePrice.trim()) {
      Alert.alert("Eksik", "Satış fiyatı zorunlu.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitSalesReport({
        city_name: cityName,
        town_name: townName,
        mahalle,
        ada,
        parsel,
        sale_price: salePrice.trim(),
        area_m2: areaM2.trim() || undefined,
        property_type_value: propertyType,
        deed_fee_receipt: receipt,
      });
      if (!res.ok) throw new Error(res.error);
      Alert.alert("Gönderildi", "Satış bildiriminiz alındı. Onaylanınca 30 kredi kazanacaksınız.");
      router.back();
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Gönderilemedi");
    } finally {
      setSubmitting(false);
    }
  }, [mahalle, ada, parsel, receipt, cityName, townName, salePrice, areaM2, propertyType, router]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Satış Bildir</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAwareScrollScreen
        headerHeight={56}
        backgroundColor="#1e293b"
        contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom }]}
      >
        <View style={styles.card}>
          <Text style={styles.label}>İl (opsiyonel)</Text>
          <TextInput value={cityName} onChangeText={setCityName} style={styles.input} placeholder="İl" placeholderTextColor="#94a3b8" />

          <Text style={[styles.label, { marginTop: 10 }]}>İlçe (opsiyonel)</Text>
          <TextInput value={townName} onChangeText={setTownName} style={styles.input} placeholder="İlçe" placeholderTextColor="#94a3b8" />

          <Text style={[styles.label, { marginTop: 10 }]}>Mahalle *</Text>
          <TextInput value={mahalle} onChangeText={setMahalle} style={styles.input} placeholder="Mahalle" placeholderTextColor="#94a3b8" />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Ada *</Text>
              <TextInput value={ada} onChangeText={setAda} style={styles.input} placeholder="Ada" placeholderTextColor="#94a3b8" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Parsel *</Text>
              <TextInput value={parsel} onChangeText={setParsel} style={styles.input} placeholder="Parsel" placeholderTextColor="#94a3b8" keyboardType="numeric" />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 10 }]}>Nitelik *</Text>
          <View style={styles.chipRow}>
            {PROPERTY_TYPE_OPTIONS.map((opt) => {
              const active = propertyType === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setPropertyType(opt.value)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 10 }]}>Satış fiyatı (TL) *</Text>
          <TextInput
            value={salePrice}
            onChangeText={setSalePrice}
            style={styles.input}
            placeholder="Örn. 2500000"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
          />

          <Text style={[styles.label, { marginTop: 10 }]}>Parsel alanı (m²)</Text>
          <TextInput
            value={areaM2}
            onChangeText={setAreaM2}
            style={styles.input}
            placeholder="Opsiyonel"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
          />

          <TouchableOpacity style={[styles.pickBtn, { marginTop: 14 }]} onPress={pickReceipt} activeOpacity={0.85}>
            <Ionicons name="attach" size={18} color="#fff" />
            <Text style={styles.pickBtnText}>{receipt ? "Dekont seçildi" : "Dekont seç"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={onSubmit} disabled={submitting} activeOpacity={0.85}>
            <Ionicons name="paper-plane" size={18} color="#fff" />
            <Text style={styles.submitBtnText}>Gönder</Text>
          </TouchableOpacity>

          <Text style={styles.muted}>Onay sonrası 30 Tepe Kredi hesabına eklenir.</Text>
        </View>
      </KeyboardAwareScrollScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e293b" },
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
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff", flex: 1, textAlign: "center" },
  headerRight: { width: 36, height: 36 },
  content: { flex: 1, backgroundColor: "#f5f5f5", padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  label: { color: "#64748b", fontWeight: "800", fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: "#0f172a", backgroundColor: "#fff" },
  pickBtn: { height: 44, borderRadius: 10, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  pickBtnText: { color: "#fff", fontWeight: "900" },
  submitBtn: { marginTop: 12, height: 44, borderRadius: 10, backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  submitBtnText: { color: "#fff", fontWeight: "900" },
  muted: { marginTop: 12, color: "#64748b", fontSize: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  chipActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#1d4ed8" },
});

