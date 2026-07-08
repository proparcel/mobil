/**
 * Android Google Play Billing checkout.
 * Havale/EFT Android'da devre dışı — yalnızca Google Play Billing.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter, useLocalSearchParams } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { creditService, type CreditPackage } from "../../services/creditService";
import {
  initializeGooglePlayIAP,
  loadPlayProducts,
  purchasePlayProduct,
  restorePlayPurchases,
  type PlayProductInfo,
  type ValidateReceiptResult,
} from "../../services/googlePlayIapService";
import { isEkPackage, resolvePlayProductId } from "../../config/iapProducts";
import { DJANGO_API_URL } from "../../config/api";

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildPurchaseSuccessMessage(result: ValidateReceiptResult, pkg: CreditPackage): string {
  if (result.already_processed) {
    return "Satın almanız daha önce işlenmişti. Bakiyeniz güncellendi.";
  }
  if (result.message?.trim()) {
    return result.message.trim();
  }
  return `Ödemeniz başarılı! ${pkg.credits} Tepe Kredi hesabınıza yüklendi.`;
}

function isYearlySubscriptionPackage(pkg: CreditPackage | null): boolean {
  return Boolean(pkg && pkg.duration_months >= 12 && !isEkPackage(pkg));
}

/** Şimdilik yalnızca GET /api/packages/ fiyatları; App Store localizedPrice kullanılmaz. */
function resolveCheckoutPrice(pkg: CreditPackage | null): {
  mainPrice: string;
  periodSuffix: string;
  yearlyTotalLine: string | null;
} {
  const isYearlySub = isYearlySubscriptionPackage(pkg);

  if (isYearlySub && pkg) {
    return {
      mainPrice: `${formatMoney(Number(pkg.monthly_price ?? 0))} ₺`,
      periodSuffix: "/ay",
      yearlyTotalLine: `Toplam: ${formatMoney(Number(pkg.price ?? 0))} ₺/yıl`,
    };
  }

  const monthly = pkg && pkg.duration_months <= 1;
  const amount = monthly
    ? Number(pkg?.monthly_price ?? pkg?.price ?? 0)
    : Number(pkg?.price ?? 0);

  return {
    mainPrice: `${formatMoney(amount)} ₺`,
    periodSuffix: "",
    yearlyTotalLine: null,
  };
}
function formatChargedAmount(
  result: ValidateReceiptResult,
  fallbackStorePrice: string | null,
  periodSuffix: string
): string | null {
  if (result.display_price?.trim()) {
    const price = result.display_price.trim();
    if (periodSuffix === "/ay" && !price.toLowerCase().includes("/ay")) {
      return `${price} /ay`;
    }
    return price;
  }
  if (result.amount_paid != null) {
    const cur = (result.currency || "").trim().toUpperCase();
    const formatted = formatMoney(result.amount_paid);
    const amount = cur === "TRY" ? `₺${formatted}` : cur ? `${formatted} ${cur}` : `${formatted} ₺`;
    return periodSuffix === "/ay" ? `${amount} /ay` : amount;
  }
  if (fallbackStorePrice) {
    return periodSuffix === "/ay" && !fallbackStorePrice.includes("/ay")
      ? `${fallbackStorePrice} /ay`
      : fallbackStorePrice;
  }
  return null;
}

function showPurchaseSuccessAlert(
  result: ValidateReceiptResult,
  pkg: CreditPackage,
  txId: string,
  fallbackStorePrice: string | null,
  periodSuffix: string
) {
  const title = result.already_processed ? "Satın Alma Zaten İşlenmiş" : "Satın Alma Başarılı";
  const lines = [buildPurchaseSuccessMessage(result, pkg)];
  const charged = formatChargedAmount(result, fallbackStorePrice, periodSuffix);
  if (charged) {
    lines.push(`Çekilen tutar: ${charged}`);
  }
  if (result.new_balance != null) {
    lines.push(`Güncel bakiye: ${result.new_balance.toLocaleString("tr-TR")} Tepe Kredi`);
  }
  if (txId) {
    lines.push(`İşlem No: ${txId}`);
  }
  Alert.alert(title, lines.join("\n\n"));
}

export default function BillingCheckoutAndroidScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{
    package_id?: string;
    package_name?: string;
    package_price?: string;
    package_credits?: string;
  }>();

  const packageId = parseInt(String(params.package_id || "0"), 10);
  const [pkg, setPkg] = useState<CreditPackage | null>(null);
  const [storeProducts, setStoreProducts] = useState<PlayProductInfo[]>([]);
  const [iapProductId, setIapProductId] = useState<string | null>(null);
  const [distanceSalesAccepted, setDistanceSalesAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [completedTxId, setCompletedTxId] = useState<string | null>(null);

  const checkoutPrice = useMemo(() => resolveCheckoutPrice(pkg), [pkg]);

  const showAutoRenewNotice = useMemo(() => isYearlySubscriptionPackage(pkg), [pkg]);

  const loadInitial = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await initializeGooglePlayIAP();
      const [pkgRes, products] = await Promise.all([
        creditService.listPackages(),
        loadPlayProducts(),
      ]);
      setStoreProducts(products);

      if (pkgRes.success && pkgRes.data?.packages) {
        const found = pkgRes.data.packages.find((p) => p.id === packageId);
        if (found) {
          setPkg(found);
          const sku = resolvePlayProductId(found);
          if (!sku) {
            setError("Bu paket uygulama üzerinden satın alınamıyor.");
          } else {
            setIapProductId(sku);
            // StoreKit katalogu sandbox'ta eksik dönebilir; satın alma SKU ile yine çalışır.
            const inStore = products.some((p) => p.productId === sku);
            if (!inStore) {
              console.warn("[BillingCheckoutAndroid] SKU Play katalogunda yok (satın alma denenebilir):", sku);
            }
          }
        } else {
          setError("Paket bulunamadı.");
        }
      } else {
        setError("Paket bilgisi yüklenemedi.");
      }
    } catch (e) {
      setError("Ödeme sayfası yüklenemedi.");
      console.error("[BillingCheckoutAndroid]", e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, packageId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const refreshBalance = useCallback(async () => {
    try {
      await creditService.getBalance();
    } catch {
      /* ignore — pricing ekranı focus'ta yeniler */
    }
  }, []);

  const handlePurchase = async () => {
    if (!distanceSalesAccepted) {
      setError("Mesafeli Satış Sözleşmesini onaylamanız gerekiyor.");
      return;
    }
    if (!iapProductId || !pkg) {
      setError("Ürün bulunamadı.");
      return;
    }

    setPurchasing(true);
    setError("");
    setSuccess("");

    try {
      const result = await purchasePlayProduct(iapProductId, { packageId: pkg.id });
      if (result.success) {
        const tx = result.transaction_id || "";
        setCompletedTxId(tx);
        const successMsg = buildPurchaseSuccessMessage(result, pkg);
        const charged = formatChargedAmount(
          result,
          checkoutPrice.mainPrice,
          checkoutPrice.periodSuffix
        );
        setSuccess(charged ? `${successMsg}\nÇekilen tutar: ${charged}` : successMsg);
        showPurchaseSuccessAlert(
          result,
          pkg,
          tx,
          checkoutPrice.mainPrice,
          checkoutPrice.periodSuffix
        );
        await refreshBalance();
      } else {
        setError(result.error || result.message || "Satın alma doğrulanamadı.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Satın alma başarısız.";
      if (!msg.includes("iptal")) {
        setError(msg);
      }
      console.error("[BillingCheckoutIOS] purchase", e);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError("");
    setSuccess("");
    try {
      const results = await restorePlayPurchases();
      const okCount = results.filter((r) => r.success).length;
      if (okCount > 0) {
        const restoreMsg = `${okCount} satın alma geri yüklendi. Bakiyeniz güncellendi.`;
        setSuccess(restoreMsg);
        Alert.alert("Geri Yükleme Başarılı", restoreMsg);
        await refreshBalance();
      } else if (results.length === 0) {
        setSuccess("Geri yüklenecek satın alma bulunamadı.");
      } else {
        setError("Geri yükleme tamamlanamadı. Lütfen tekrar deneyin.");
      }
    } catch (e) {
      setError("Geri yükleme başarısız.");
      console.error("[BillingCheckoutIOS] restore", e);
    } finally {
      setRestoring(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ödeme</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.mutedText}>Ödeme için giriş yapmanız gerekiyor.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("login")}>
            <Text style={styles.primaryBtnText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const legalUrl = `${DJANGO_API_URL}/hukuki/mesafeli-satis-sozlesmesi/`;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ödeme</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
      >
        <Text style={styles.heroEyebrow}>Güvenli ödeme</Text>
        <Text style={styles.heroText}>
          Tepe Kredi ve abonelik paketlerinizi Google Play üzerinden güvenle satın alabilirsiniz.
        </Text>

        {error ? (
          <View style={styles.alertError}>
            <Text style={styles.alertErrorText}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.alertSuccess}>
            <Ionicons name="checkmark-circle" size={20} color="#047857" style={{ marginBottom: 4 }} />
            <Text style={styles.alertSuccessText}>{success}</Text>
            {completedTxId ? (
              <Text style={styles.txMeta}>İşlem No: {completedTxId}</Text>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 32 }} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Paket özeti</Text>
              {(pkg || params.package_name) && (
                <View style={styles.pkgMeta}>
                  <Text style={styles.pkgName}>{pkg?.name || params.package_name}</Text>
                  {pkg?.monthly_credits && isYearlySubscriptionPackage(pkg) ? (
                    <Text style={styles.pkgCredits}>
                      Aylık {pkg.monthly_credits.toLocaleString("tr-TR")} Tepe Kredi
                    </Text>
                  ) : pkg?.credits ? (
                    <Text style={styles.pkgCredits}>{pkg.credits} Tepe Kredi</Text>
                  ) : null}
                  <View style={styles.priceRow}>
                    <Text style={styles.pkgAmount}>{checkoutPrice.mainPrice}</Text>
                    {checkoutPrice.periodSuffix ? (
                      <Text style={styles.pkgPeriod}>{checkoutPrice.periodSuffix}</Text>
                    ) : null}
                  </View>
                  {checkoutPrice.yearlyTotalLine ? (
                    <Text style={styles.yearlyTotalLine}>{checkoutPrice.yearlyTotalLine}</Text>
                  ) : null}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Özet</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.mutedText}>Ödeme yöntemi</Text>
                <Text style={styles.summaryAmount}>Google Play</Text>
              </View>
              <TouchableOpacity
                style={styles.consentRow}
                onPress={() => setDistanceSalesAccepted((v) => !v)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={distanceSalesAccepted ? "checkbox" : "square-outline"}
                  size={22}
                  color="#1a5fb4"
                />
                <Text style={styles.consentText}>
                  <Text style={styles.linkText} onPress={() => setLegalModalVisible(true)}>
                    Mesafeli Satış Sözleşmesini
                  </Text>
                  {" "}okudum ve kabul ediyorum.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (!distanceSalesAccepted || purchasing || !iapProductId || !!success) && styles.primaryBtnDisabled,
                ]}
                disabled={!distanceSalesAccepted || purchasing || !iapProductId || !!success}
                onPress={handlePurchase}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {success ? "Satın Alındı" : "Satın Al"}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, (restoring || purchasing) && styles.primaryBtnDisabled]}
                disabled={restoring || purchasing}
                onPress={handleRestore}
              >
                {restoring ? (
                  <ActivityIndicator color="#1a5fb4" />
                ) : (
                  <Text style={styles.secondaryBtnText}>Satın Almaları Geri Yükle</Text>
                )}
              </TouchableOpacity>
            </View>

            {showAutoRenewNotice ? (
              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color="#64748b" />
                <Text style={styles.infoText}>
                  Yıllık abonelikler otomatik yenilenir. İptal ve yönetim için Google Play → Abonelikler bölümünü kullanın.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={legalModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.legalHeader}>
            <Text style={styles.modalTitle}>Mesafeli Satış Sözleşmesi</Text>
            <TouchableOpacity onPress={() => setLegalModalVisible(false)}>
              <Ionicons name="close" size={28} color="#64748b" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => Linking.openURL(legalUrl)}>
            <Text style={styles.primaryBtnText}>Sözleşmeyi tarayıcıda aç</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 8, backgroundColor: "#64748b" }]}
            onPress={() => {
              setDistanceSalesAccepted(true);
              setLegalModalVisible(false);
            }}
          >
            <Text style={styles.primaryBtnText}>Okudum, kabul ediyorum</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e293b" },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#fff" },
  headerRight: { width: 36 },
  content: { flex: 1, backgroundColor: "#f1f5f9", padding: 16 },
  heroEyebrow: { fontSize: 12, fontWeight: "700", color: "#1a5fb4", textTransform: "uppercase" },
  heroText: { fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 16, lineHeight: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 12 },
  pkgMeta: { marginTop: 4 },
  pkgName: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  pkgCredits: { fontSize: 13, color: "#64748b", marginTop: 4 },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 8 },
  pkgAmount: { fontSize: 22, fontWeight: "700", color: "#1a5fb4" },
  pkgPeriod: { fontSize: 14, fontWeight: "600", color: "#64748b", marginLeft: 4 },
  yearlyTotalLine: { fontSize: 12, color: "#64748b", marginTop: 6 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  summaryAmount: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 16 },
  consentText: { flex: 1, fontSize: 13, color: "#334155", lineHeight: 18 },
  linkText: { color: "#1a5fb4", fontWeight: "600", fontSize: 13 },
  primaryBtn: {
    flexDirection: "row",
    backgroundColor: "#1a5fb4",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(26, 95, 180, 0.35)",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#1a5fb4", fontWeight: "700", fontSize: 15 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f1f5f9" },
  mutedText: { color: "#64748b", fontSize: 14 },
  alertError: { backgroundColor: "#fef2f2", padding: 12, borderRadius: 8, marginBottom: 12 },
  alertErrorText: { color: "#b91c1c", fontSize: 13 },
  alertSuccess: { backgroundColor: "#ecfdf5", padding: 12, borderRadius: 8, marginBottom: 12 },
  alertSuccessText: { color: "#047857", fontSize: 13, fontWeight: "600" },
  txMeta: { color: "#64748b", fontSize: 11, marginTop: 6, fontFamily: "monospace" },
  infoCard: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  infoText: { flex: 1, fontSize: 12, color: "#64748b", lineHeight: 18 },
  legalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
});
