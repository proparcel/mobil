/**
 * AI Resim Canlandırma — web 3d-editor-purchase (target=ai_img) ile aynı akış, native UI.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { creditService } from "../../services/creditService";
import { listImageAnimationLicenses, type ImageAnimationLicenseRow } from "../../services/imageAnimationService";

const TepeCoinIcon = require("../../assets/images/TepeCoin.png");

const AI_IMG_ACTION = "ai_img";

const COLORS = {
  pageBg: "#f8fafc",
  cardBg: "#ffffff",
  text: "#1e293b",
  muted: "#64748b",
  primary: "#1a5fb4",
  infoBg: "#eff6ff",
  infoBorder: "#bfdbfe",
  infoText: "#1e40af",
  border: "#e2e8f0",
} as const;

export default function AiImageAnimationPurchaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [title, setTitle] = useState("");
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [licenses, setLicenses] = useState<ImageAnimationLicenseRow[]>([]);
  const [selectedLicenseRef, setSelectedLicenseRef] = useState("");
  const [loading, setLoading] = useState(true);
  const [purchaseBusy, setPurchaseBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cost, balRes, licRes] = await Promise.all([
        creditService.getCreditCostForAction(AI_IMG_ACTION),
        creditService.getBalance(),
        listImageAnimationLicenses(),
      ]);
      setCreditCost(cost);
      if (balRes.success && balRes.data) {
        setBalance(balRes.data.balance);
      }
      if (licRes.ok) {
        setLicenses(licRes.items);
        if (licRes.items[0]?.reference_id) {
          setSelectedLicenseRef(licRes.items[0].reference_id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const goEditor = useCallback(
    (animationTitle: string, licenseRef: string) => {
      router.push("ai-image-animation-editor", {
        image_animation_title: animationTitle.trim() || "AI Resim Canlandırma",
        license_ref: licenseRef,
      });
    },
    [router],
  );

  const handleUseExistingLicense = useCallback(() => {
    const row = licenses.find((item) => item.reference_id === selectedLicenseRef);
    if (!row) {
      Alert.alert("Seçim", "Lütfen mevcut bir başlık seçin.");
      return;
    }
    goEditor(row.label, row.reference_id);
  }, [goEditor, licenses, selectedLicenseRef]);

  const handlePurchase = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert("Giriş gerekli", "Satın almak için giriş yapın.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş", onPress: () => router.push("login") },
      ]);
      return;
    }
    const animationTitle = title.trim();
    if (!animationTitle) {
      Alert.alert("Eksik", "Lütfen canlandırma adını girin.");
      return;
    }
    if (creditCost == null) {
      Alert.alert("Kredi bilgisi", "Kredi maliyeti yüklenemedi. Lütfen tekrar deneyin.");
      return;
    }
    const referenceId = `ai_img:${Date.now()}`;
    Alert.alert(
      "Onay",
      `${creditCost} Tepe Coin harcanacak.\n\nCanlandırma: ${animationTitle}\n\nDevam edilsin mi?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Satın Al",
          onPress: async () => {
            setPurchaseBusy(true);
            try {
              const description = JSON.stringify({
                product: "AI Resim Canlandırma",
                title: animationTitle,
                source: "mobile_purchase",
              });
              const res = await creditService.useCredit(AI_IMG_ACTION, description, referenceId);
              if (res.success) {
                goEditor(animationTitle, referenceId);
              } else {
                Alert.alert("İşlem başarısız", res.message || res.error || "Kredi kullanılamadı.");
              }
            } catch (e: unknown) {
              Alert.alert("Hata", e instanceof Error ? e.message : "İşlem tamamlanamadı.");
            } finally {
              setPurchaseBusy(false);
            }
          },
        },
      ],
    );
  }, [creditCost, goEditor, isAuthenticated, router, title]);

  const balanceAfter =
    balance != null && creditCost != null ? Math.max(0, balance - creditCost) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Resim Canlandırma</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <KeyboardAwareScrollScreen
          headerHeight={56}
          backgroundColor={COLORS.pageBg}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="image-outline" size={28} color={COLORS.primary} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>AI Resim Canlandırma Lisansı</Text>
              <Text style={styles.heroSub}>
                Tek kullanımlık paket: 1 görsel/frame canlandırma hakkı verir.
              </Text>
            </View>
          </View>

          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.infoText} />
            <Text style={styles.infoText}>
              Bu paket 1 görsel/frame canlandırma hakkı verir. Ek frame için editörde mevcut ek frame
              ödeme akışı kullanılır.
            </Text>
          </View>

          {licenses.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mevcut başlıklarınız</Text>
              <Text style={styles.sectionHint}>
                Daha önce aldığınız kullanılmamış bir hak varsa seçip satın almadan editöre gidin.
              </Text>
              {licenses.map((row) => {
                const selected = selectedLicenseRef === row.reference_id;
                return (
                  <TouchableOpacity
                    key={row.reference_id}
                    style={[styles.licenseRow, selected && styles.licenseRowSelected]}
                    onPress={() => setSelectedLicenseRef(row.reference_id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={selected ? COLORS.primary : COLORS.muted}
                    />
                    <Text style={styles.licenseLabel}>{row.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleUseExistingLicense} activeOpacity={0.85}>
                <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
                <Text style={styles.secondaryBtnText}>Editöre Git</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Canlandırma bilgisi</Text>
            <Text style={styles.sectionHint}>Bu ad editörde resim canlandırma işi için kullanılacak.</Text>
            <Text style={styles.fieldLabel}>Canlandırma adı</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholder="Örn. Villa Salon Görselleri"
              placeholderTextColor="#94a3b8"
              maxLength={120}
            />
          </View>

          <View style={styles.creditBox}>
            <Image source={TepeCoinIcon} style={styles.coinIcon} resizeMode="contain" />
            <View style={styles.creditRows}>
              <View style={styles.creditRow}>
                <Text style={styles.creditRowLabel}>Gerekli kredi</Text>
                <Text style={styles.creditRowValue}>{creditCost ?? "—"} Tepe Coin</Text>
              </View>
              <View style={styles.creditRow}>
                <Text style={styles.creditRowLabel}>Mevcut bakiye</Text>
                <Text style={styles.creditRowValue}>{balance ?? "—"}</Text>
              </View>
              {balanceAfter != null ? (
                <View style={styles.creditRow}>
                  <Text style={styles.creditRowLabel}>İşlem sonrası</Text>
                  <Text style={styles.creditRowValue}>{balanceAfter}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (purchaseBusy || creditCost == null || !title.trim()) && styles.primaryBtnDisabled]}
            onPress={handlePurchase}
            disabled={purchaseBusy || creditCost == null || !title.trim()}
            activeOpacity={0.85}
          >
            {purchaseBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cart-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>AI Resim Canlandır Satın Al</Text>
              </>
            )}
          </TouchableOpacity>
        </KeyboardAwareScrollScreen>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: COLORS.text },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, maxWidth: 520, alignSelf: "center", width: "100%" },
  hero: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#e8f1fc",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: "700", color: COLORS.text },
  heroSub: { marginTop: 6, fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  infoBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: COLORS.infoBg,
    borderWidth: 1,
    borderColor: COLORS.infoBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  infoText: { flex: 1, color: COLORS.infoText, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  sectionHint: { fontSize: 13, color: COLORS.muted, marginBottom: 12, lineHeight: 19 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: COLORS.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: "#fff",
  },
  licenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  licenseRowSelected: { backgroundColor: "rgba(26, 95, 180, 0.08)" },
  licenseLabel: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "600" },
  secondaryBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: "700", fontSize: 15 },
  creditBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fffbeb",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 16,
    marginBottom: 16,
  },
  coinIcon: { width: 40, height: 40 },
  creditRows: { flex: 1, gap: 8 },
  creditRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  creditRowLabel: { fontSize: 13, color: "#92400e", fontWeight: "600" },
  creditRowValue: { fontSize: 15, fontWeight: "800", color: "#b45309" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
