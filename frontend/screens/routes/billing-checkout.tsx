/**
 * Havale / EFT ödeme — web BillingCheckoutPage ile aynı akış.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Clipboard,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";
import { useRouter, useLocalSearchParams } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { creditService, type CreditPackage } from "../../services/creditService";
import {
  createPaymentRequest,
  getPaymentRequest,
  listBankAccounts,
  uploadReceipt,
  type HavaleBankAccount,
  type HavalePaymentRequest,
} from "../../services/havalePaymentService";
import { DJANGO_API_URL } from "../../config/api";

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusLabel(status: string, pr?: HavalePaymentRequest | null) {
  const map: Record<string, string> = {
    pending_receipt: "Dekont bekleniyor",
    processing_ai: "Dekont analiz ediliyor",
    receipt_uploaded: pr?.ai_review_required ? "Admin onayı bekleniyor" : "Dekont alındı",
    needs_revision: "Revizyon gerekli",
    approved: pr?.ai_auto_approved ? "Ödeme onaylandı (AI)" : "Ödeme onaylandı",
    rejected: "Reddedildi",
    cancelled: "İptal edildi",
  };
  return map[status] || status;
}

function statusDetail(status: string, pr?: HavalePaymentRequest | null) {
  if (!pr) return "";
  if (status === "pending_receipt") return "Havale yaptıktan sonra dekont yükleyin.";
  if (status === "processing_ai") return "Yapay zeka dekonttaki tutar ve referans kodunu okuyor.";
  if (status === "receipt_uploaded" && pr.ai_review_required) {
    const conf =
      pr.ai_confidence_score != null ? ` Güven: %${Math.round(pr.ai_confidence_score)}.` : "";
    return `Dekont kaydedildi; manuel inceleme sürüyor.${conf}`;
  }
  if (status === "approved") return "Paketiniz aktif edildi.";
  if (status === "needs_revision") return pr.admin_note || "Yeni dekont veya bilgi gerekebilir.";
  return "";
}

export default function BillingCheckoutScreen() {
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
  const [banks, setBanks] = useState<HavaleBankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<HavalePaymentRequest | null>(null);
  const [distanceSalesAccepted, setDistanceSalesAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [qrBank, setQrBank] = useState<HavaleBankAccount | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayAmount = useMemo(() => {
    if (!pkg) return 0;
    const monthly = pkg.duration_months <= 1;
    if (monthly) {
      return Number(pkg.monthly_price ?? pkg.price ?? 0);
    }
    return Number(pkg.price ?? 0);
  }, [pkg]);

  const loadInitial = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [pkgRes, bankList] = await Promise.all([
        creditService.listPackages(),
        listBankAccounts(),
      ]);
      if (pkgRes.success && pkgRes.data?.packages) {
        const found = pkgRes.data.packages.find((p) => p.id === packageId);
        if (found) setPkg(found);
      }
      setBanks(bankList);
      if (bankList.length) setSelectedBankId(bankList[0].id);
    } catch (e) {
      setError("Ödeme sayfası yüklenemedi.");
      console.error("[BillingCheckout]", e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, packageId]);

  useEffect(() => {
    loadInitial();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [loadInitial]);

  const pollPayment = useCallback((id: number) => {
    const tick = async () => {
      try {
        const pr = await getPaymentRequest(id);
        if (!pr) return;
        setPaymentRequest(pr);
        if (["processing_ai", "receipt_uploaded"].includes(pr.payment_status)) {
          pollRef.current = setTimeout(tick, 4000);
        } else if (pr.payment_status === "approved") {
          setSuccess(
            pr.ai_auto_approved
              ? "Ödemeniz otomatik doğrulandı ve paketiniz aktif edildi."
              : "Ödemeniz onaylandı."
          );
        }
      } catch {
        /* ignore */
      }
    };
    tick();
  }, []);

  useEffect(() => {
    if (!paymentRequest?.id) return;
    if (["processing_ai", "receipt_uploaded"].includes(paymentRequest.payment_status)) {
      pollPayment(paymentRequest.id);
    }
  }, [paymentRequest?.id, paymentRequest?.payment_status, pollPayment]);

  useEffect(() => {
    if (loading || !packageId || !selectedBankId || !isAuthenticated) return;
    let cancelled = false;
    createPaymentRequest(packageId, selectedBankId)
      .then(({ data: pr, error: createErr }) => {
        if (cancelled) return;
        if (pr) setPaymentRequest(pr);
        else if (createErr) setError(createErr);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message || "Ödeme talebi oluşturulamadı."));
      });
    return () => {
      cancelled = true;
    };
  }, [loading, packageId, selectedBankId, isAuthenticated]);

  const canUploadReceipt =
    distanceSalesAccepted && selectedBankId && paymentRequest &&
    ["pending_receipt", "needs_revision"].includes(paymentRequest.payment_status);

  const receiptAlreadySent =
    paymentRequest &&
    !["pending_receipt", "needs_revision"].includes(paymentRequest.payment_status);

  const handlePickReceipt = async () => {
    if (!canUploadReceipt || !paymentRequest || !selectedBankId) {
      setError("Banka seçin ve Mesafeli Satış Sözleşmesini onaylayın.");
      return;
    }
    const result = await launchImageLibrary({
      mediaType: "mixed",
      selectionLimit: 1,
    });
    if (result.didCancel || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    if (!uri) return;
    const name = asset.fileName || `receipt.${asset.type?.includes("pdf") ? "pdf" : "jpg"}`;
    const type = asset.type || "image/jpeg";
    setSubmitting(true);
    setError("");
    try {
      const { data: updated, error: uploadErr } = await uploadReceipt(
        paymentRequest.id,
        selectedBankId,
        { uri, name, type }
      );
      if (updated) {
        setPaymentRequest(updated);
        setReceiptModalVisible(false);
        setSuccess("Dekontunuz alındı. Yapay zeka dekontu analiz ediyor.");
        if (updated.payment_status === "processing_ai") pollPayment(updated.id);
      } else {
        setError(uploadErr || "Dekont yüklenemedi.");
      }
    } catch (e) {
      setError("Dekont yüklenemedi. Lütfen tekrar deneyin.");
      console.error("[BillingCheckout] upload", e);
    } finally {
      setSubmitting(false);
    }
  };

  const copyIban = (iban: string) => {
    Clipboard.setString(iban.replace(/\s/g, ""));
    setSuccess("IBAN kopyalandı.");
    setTimeout(() => setSuccess(""), 2000);
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

  const refCode = paymentRequest?.payment_reference || "—";
  const legalUrl = `${DJANGO_API_URL}/hukuki/mesafeli-satis-sozlesmesi/`;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Havale / EFT Ödeme</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
      >
        <Text style={styles.heroEyebrow}>Ödeme bildirimi</Text>
        <Text style={styles.heroText}>
          Banka hesabına havale yapın, açıklamaya referans kodunu yazın ve dekontunuzu yükleyin.
        </Text>

        {error ? (
          <View style={styles.alertError}>
            <Text style={styles.alertErrorText}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.alertSuccess}>
            <Text style={styles.alertSuccessText}>{success}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 32 }} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.refLabel}>ÖDEME REFERANS KODUNUZ</Text>
              <Text style={styles.refCode}>{refCode}</Text>
              <Text style={styles.refHint}>
                Havale açıklamasına bu kodu eksiksiz yazın. Ödeme sonrası dekont yükleyin.
              </Text>
              {(pkg || params.package_name) && (
                <View style={styles.pkgMeta}>
                  <Text style={styles.pkgName}>{pkg?.name || params.package_name}</Text>
                  <Text style={styles.pkgAmount}>{formatMoney(displayAmount)} ₺</Text>
                </View>
              )}
              {paymentRequest ? (
                <View style={styles.statusBlock}>
                  <Text style={styles.statusPill}>{statusLabel(paymentRequest.payment_status, paymentRequest)}</Text>
                  {statusDetail(paymentRequest.payment_status, paymentRequest) ? (
                    <Text style={styles.statusDetail}>
                      {statusDetail(paymentRequest.payment_status, paymentRequest)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Banka hesapları</Text>
              {banks.map((bank) => (
                <TouchableOpacity
                  key={bank.id}
                  style={[styles.bankRow, selectedBankId === bank.id && styles.bankRowSelected]}
                  onPress={() => setSelectedBankId(bank.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.bankRowTop}>
                    <Text style={styles.bankName}>{bank.display_name || bank.bank_name}</Text>
                    {selectedBankId === bank.id ? (
                      <Ionicons name="checkmark-circle" size={22} color="#1a5fb4" />
                    ) : null}
                  </View>
                  <Text style={styles.iban}>{bank.iban}</Text>
                  <Text style={styles.holder}>{bank.account_holder_name}</Text>
                  <View style={styles.bankActions}>
                    <TouchableOpacity onPress={() => copyIban(bank.iban)}>
                      <Text style={styles.linkText}>IBAN kopyala</Text>
                    </TouchableOpacity>
                    {bank.qr_image_url ? (
                      <TouchableOpacity onPress={() => setQrBank(bank)}>
                        <Text style={styles.linkText}>Karekod</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Özet</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.mutedText}>Tutar</Text>
                <Text style={styles.summaryAmount}>{formatMoney(displayAmount)} ₺</Text>
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
                style={[styles.primaryBtn, (!canUploadReceipt || submitting || receiptAlreadySent) && styles.primaryBtnDisabled]}
                disabled={!canUploadReceipt || submitting || !!receiptAlreadySent}
                onPress={() => setReceiptModalVisible(true)}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {receiptAlreadySent ? "Dekont alındı" : "Ödeme Bildir / Dekont Yükle"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={receiptModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Dekont yükle</Text>
            <Text style={styles.modalHint}>
              JPG, PNG, WEBP veya PDF (en fazla 20MB). Tutar ve referans kodu otomatik okunur.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handlePickReceipt} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Dosya seç ve gönder</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setReceiptModalVisible(false)}>
              <Text style={styles.mutedText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!qrBank} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setQrBank(null)}>
          <View style={styles.qrModal}>
            <Text style={styles.modalTitle}>{qrBank?.display_name} — Karekod</Text>
            {qrBank?.qr_image_url ? (
              <Image source={{ uri: qrBank.qr_image_url }} style={styles.qrImage} resizeMode="contain" />
            ) : null}
            <Text style={styles.iban}>{qrBank?.iban}</Text>
          </View>
        </TouchableOpacity>
      </Modal>

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
  heroText: { fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 12 },
  refLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", letterSpacing: 0.5 },
  refCode: { fontSize: 22, fontWeight: "800", color: "#1a5fb4", marginTop: 6 },
  refHint: { fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 18 },
  pkgMeta: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  pkgName: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  pkgAmount: { fontSize: 18, fontWeight: "700", color: "#1a5fb4", marginTop: 4 },
  statusBlock: { marginTop: 12 },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    color: "#1e40af",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: "600",
    overflow: "hidden",
  },
  statusDetail: { fontSize: 12, color: "#64748b", marginTop: 6 },
  bankRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  bankRowSelected: { borderColor: "#1a5fb4", backgroundColor: "#f8fafc" },
  bankRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bankName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  iban: { fontSize: 13, color: "#334155", marginTop: 6, fontFamily: "monospace" },
  holder: { fontSize: 12, color: "#64748b", marginTop: 2 },
  bankActions: { flexDirection: "row", gap: 16, marginTop: 8 },
  linkText: { color: "#1a5fb4", fontWeight: "600", fontSize: 13 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  summaryAmount: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 16 },
  consentText: { flex: 1, fontSize: 13, color: "#334155", lineHeight: 18 },
  primaryBtn: {
    backgroundColor: "#1a5fb4",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f1f5f9" },
  mutedText: { color: "#64748b", fontSize: 14 },
  alertError: { backgroundColor: "#fef2f2", padding: 12, borderRadius: 8, marginBottom: 12 },
  alertErrorText: { color: "#b91c1c", fontSize: 13 },
  alertSuccess: { backgroundColor: "#ecfdf5", padding: 12, borderRadius: 8, marginBottom: 12 },
  alertSuccessText: { color: "#047857", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  modalHint: { fontSize: 13, color: "#64748b", marginVertical: 12, lineHeight: 18 },
  modalCancel: { alignItems: "center", paddingVertical: 12 },
  qrModal: { backgroundColor: "#fff", margin: 24, borderRadius: 12, padding: 20, alignItems: "center" },
  qrImage: { width: 220, height: 220, marginVertical: 12 },
  legalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
});
