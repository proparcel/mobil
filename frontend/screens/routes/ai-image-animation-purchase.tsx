/**
 * AI Resim Canlandırma — paket tanımlama / mevcut pakete devam (web 3d_editor_purchase ai_img akışı).
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MobileAiScreenShell } from "../../components/app/MobileAiScreenHeader";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { AiImageAnimationPurchaseModal } from "../../components/ai-image-animation/AiImageAnimationPurchaseModal";
import { useRouter } from "../../src/hooks/useNavigation";
import { creditService } from "../../services/creditService";
import {
  IMAGE_ANIMATION_PACKAGE_ACTION,
  IMAGE_ANIMATION_PACKAGE_UNITS,
  createImageAnimationLicenseRef,
  getImageAnimationPackageStatus,
  listImageAnimationPackages,
  type ImageAnimationPackageRow,
} from "../../services/imageAnimationService";

const DE = {
  shell: "#0b1220",
  card: "rgba(15, 23, 42, 0.72)",
  text: "#e5eefc",
  muted: "#94a3b8",
  border: "rgba(148, 163, 184, 0.22)",
  primary: "#38bdf8",
  primaryDark: "#0ea5e9",
  badge: "#22c55e",
  coin: "#fbbf24",
} as const;

export default function AiImageAnimationPurchaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<ImageAnimationPackageRow[]>([]);
  const [packageName, setPackageName] = useState("");
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [packageCoinCost, setPackageCoinCost] = useState<number | null>(null);
  const [packageUnitsPerCredit, setPackageUnitsPerCredit] = useState(IMAGE_ANIMATION_PACKAGE_UNITS);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [pendingLicenseRef, setPendingLicenseRef] = useState("");
  const [pendingTitle, setPendingTitle] = useState("");

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, cost, pkgStatus] = await Promise.all([
        listImageAnimationPackages(),
        creditService.getCreditCostForAction(IMAGE_ANIMATION_PACKAGE_ACTION),
        getImageAnimationPackageStatus(),
      ]);
      if (cost != null && cost > 0) setPackageCoinCost(cost);
      else setPackageCoinCost(null);
      if (pkgStatus.ok && pkgStatus.status.unitsPerCredit > 0) {
        setPackageUnitsPerCredit(pkgStatus.status.unitsPerCredit);
      }
      if (listRes.ok) {
        setPackages(listRes.items);
        if (listRes.items.length === 1) {
          setSelectedRef(listRes.items[0]!.reference_id);
        }
      } else {
        setPackages([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  const openEditor = useCallback(
    (licenseRef: string, imageAnimationTitle: string) => {
      router.push("ai-image-animation-editor", {
        license_ref: licenseRef,
        image_animation_title: imageAnimationTitle,
      });
    },
    [router],
  );

  const onContinueExisting = useCallback(() => {
    const selected = packages.find((row) => row.reference_id === selectedRef);
    if (!selected) {
      Alert.alert("Seçim", "Devam etmek için listeden bir paket seçin.");
      return;
    }
    openEditor(
      selected.reference_id,
      String(selected.image_animation_title || selected.label || "AI Resim Canlandırma").trim(),
    );
  }, [openEditor, packages, selectedRef]);

  const onOpenPurchaseModal = useCallback(() => {
    const title = packageName.trim();
    if (title.length < 2) {
      Alert.alert("Paket adı", "Canlandırma paketinize en az 2 karakterlik bir ad verin.");
      return;
    }
    setPendingTitle(title);
    setPendingLicenseRef(createImageAnimationLicenseRef());
    setPurchaseModalVisible(true);
  }, [packageName]);

  const onPurchaseSuccess = useCallback(() => {
    if (!pendingLicenseRef.trim() || !pendingTitle.trim()) return;
    openEditor(pendingLicenseRef, pendingTitle);
  }, [openEditor, pendingLicenseRef, pendingTitle]);

  return (
    <MobileAiScreenShell
      title="AI Resim Canlandırma"
      subtitle="Paket tanımla veya devam et"
      onBack={() => router.back()}
      pageBackgroundColor={DE.shell}
    >
      <KeyboardAwareScrollScreen
        headerHeight={63}
        backgroundColor={DE.shell}
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: 24 + insets.bottom }]}
      >
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color={DE.primary} />
          <Text style={styles.infoText}>
            {packageCoinCost ?? "—"} Tepe Kredi karşılığında {packageUnitsPerCredit} resim canlandırma hakkı
            tanımlanır. Pakete verdiğiniz ad ile kalan haklarınıza sonra tekrar girebilirsiniz.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={DE.primary} size="large" />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="albums-outline" size={20} color={DE.primary} />
                <View style={styles.cardHeadText}>
                  <Text style={styles.cardTitle}>Mevcut paketleriniz</Text>
                  <Text style={styles.cardSub}>
                    Kalan hakkı olan paketlerinizden birini seçip editöre devam edin.
                  </Text>
                </View>
              </View>

              {packages.length ? (
                <ScrollView style={styles.packageList} nestedScrollEnabled>
                  {packages.map((row) => {
                    const active = selectedRef === row.reference_id;
                    const label = String(row.label || row.image_animation_title || "AI Resim Canlandırma").trim();
                    return (
                      <TouchableOpacity
                        key={row.reference_id}
                        style={[styles.packageRow, active && styles.packageRowActive]}
                        onPress={() => setSelectedRef(row.reference_id)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={active ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={active ? DE.primary : DE.muted}
                        />
                        <View style={styles.packageRowBody}>
                          <Text style={styles.packageName} numberOfLines={2}>
                            {label}
                          </Text>
                          <Text style={styles.packageMeta}>
                            {row.remainingUses}/{row.packageUnitsTotal} hak kaldı
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.emptyText}>Kullanılmamış paket bulunamadı.</Text>
              )}

              <TouchableOpacity
                style={[styles.secondaryBtn, !packages.length && styles.btnDisabled]}
                onPress={() => void onContinueExisting()}
                disabled={!packages.length}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-forward" size={18} color={DE.text} />
                <Text style={styles.secondaryBtnText}>Seçili pakete devam et</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="create-outline" size={20} color={DE.primary} />
                <View style={styles.cardHeadText}>
                  <Text style={styles.cardTitle}>Yeni paket</Text>
                  <Text style={styles.cardSub}>
                    Canlandırma işinize bir ad verin; satın alma onayında kredi düşülür ve hak tanımlanır.
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Paket adı</Text>
              <TextInput
                value={packageName}
                onChangeText={setPackageName}
                style={styles.input}
                placeholder="Örn. Villa salon görselleri"
                placeholderTextColor={DE.muted}
                maxLength={120}
                autoCapitalize="sentences"
              />

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => void onOpenPurchaseModal()}
                activeOpacity={0.85}
              >
                <Ionicons name="cart" size={18} color="#0f172a" />
                <Text style={styles.primaryBtnText}>Paketi satın al</Text>
                <Text style={styles.primaryCoin}>
                  +{packageCoinCost != null ? packageCoinCost : "—"} kredi
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAwareScrollScreen>

      <AiImageAnimationPurchaseModal
        visible={purchaseModalVisible}
        onClose={() => setPurchaseModalVisible(false)}
        referenceId={pendingLicenseRef}
        packageTitle={pendingTitle}
        onPurchaseSuccess={onPurchaseSuccess}
      />
    </MobileAiScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: DE.shell },
  bodyContent: { padding: 14, gap: 14 },
  loaderWrap: { paddingVertical: 48, alignItems: "center" },
  infoBanner: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DE.border,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  infoText: { flex: 1, color: DE.text, fontSize: 13, lineHeight: 19 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DE.border,
    backgroundColor: DE.card,
    padding: 14,
    gap: 12,
  },
  cardHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  cardHeadText: { flex: 1, gap: 4 },
  cardTitle: { color: DE.text, fontSize: 16, fontWeight: "700" },
  cardSub: { color: DE.muted, fontSize: 13, lineHeight: 18 },
  packageList: { maxHeight: 220 },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 8,
    backgroundColor: "rgba(2, 6, 23, 0.35)",
  },
  packageRowActive: {
    borderColor: "rgba(56, 189, 248, 0.45)",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  packageRowBody: { flex: 1, gap: 2 },
  packageName: { color: DE.text, fontSize: 14, fontWeight: "600" },
  packageMeta: { color: DE.badge, fontSize: 12, fontWeight: "600" },
  emptyText: { color: DE.muted, fontSize: 13, paddingVertical: 6 },
  fieldLabel: { color: DE.muted, fontSize: 12, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: DE.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: DE.text,
    fontSize: 15,
    backgroundColor: "rgba(2, 6, 23, 0.45)",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: DE.primary,
    borderRadius: 12,
    paddingVertical: 13,
  },
  primaryBtnText: { color: "#0f172a", fontSize: 15, fontWeight: "700" },
  primaryCoin: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DE.border,
    paddingVertical: 12,
    backgroundColor: "rgba(2, 6, 23, 0.35)",
  },
  secondaryBtnText: { color: DE.text, fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.45 },
});
