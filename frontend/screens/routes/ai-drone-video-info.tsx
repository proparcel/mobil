/**
 * AI Drone Video — masaüstü bilgilendirme + ProParcel drone üretim talebi (parsel seçimi + TKGM).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import AdaParselForm, { type AdaParselSubmitPayload } from "../../components/AdaParselForm";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { useScrollInputIntoView } from "../../src/keyboard";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { creditService } from "../../services/creditService";
import { aiDroneProparcelService } from "../../services/aiDroneProparcelService";
import { extractNitelikText } from "../../src/utils/propertyTypeUtils";
import {
  fetchTkgmParcelByAdaParsel,
  formatTkgmResultSummary,
  type TkgmParcelResponse,
} from "../../src/utils/tkgmParcelQuery";

const TepeCoinIcon = require("../../assets/images/TepeCoin.png");
const UserCardExample = require("../../assets/images/ai-drone-user-card-example.png");

/** Sunucu kredi kullanımları tablosu */
const DRONE_SERVICE_ACTION = "ai_drone_proparcel";

const COLORS = {
  headerBg: "#0f172a",
  pageBg: "#f1f5f9",
  cardBg: "#ffffff",
  accent: "#3b82f6",
  text: "#0f172a",
  muted: "#64748b",
} as const;

export default function AiDroneVideoInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const noteInputWrapRef = useRef<View>(null);
  const { handleFocus: scrollNoteIntoView, handleBlur: scrollNoteBlur } = useScrollInputIntoView({
    scrollRef,
    inputWrapRef: noteInputWrapRef,
  });
  const { isAuthenticated } = useAuth();
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [costLoading, setCostLoading] = useState(true);
  const [queryLoading, setQueryLoading] = useState(false);
  const [parcelPayload, setParcelPayload] = useState<AdaParselSubmitPayload | null>(null);
  const [tkgmData, setTkgmData] = useState<TkgmParcelResponse | null>(null);
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [userNote, setUserNote] = useState("");
  const [showUserCard, setShowUserCard] = useState(false);
  const [userCardConfirmed, setUserCardConfirmed] = useState(false);

  const loadCreditCost = useCallback(async () => {
    setCostLoading(true);
    const cost = await creditService.getCreditCostForActionTypes([DRONE_SERVICE_ACTION, "drone_video"]);
    setCreditCost(cost);
    setCostLoading(false);
  }, []);

  useEffect(() => {
    void loadCreditCost();
  }, [loadCreditCost]);

  const handleParcelQuery = useCallback(async (payload: AdaParselSubmitPayload) => {
    setQueryLoading(true);
    setTkgmData(null);
    setResultSummary(null);
    setParcelPayload(payload);

    const res = await fetchTkgmParcelByAdaParsel(payload);
    setQueryLoading(false);

    if (!res.ok) {
      Alert.alert("Parsel sorgusu", res.error);
      setParcelPayload(null);
      return;
    }

    const nitelik = extractNitelikText(res.data);
    setTkgmData(res.data);
    setResultSummary(formatTkgmResultSummary(payload, res.data, nitelik || undefined));
  }, []);

  const canSubmitOrder = Boolean(parcelPayload && tkgmData?.geometry && resultSummary);

  const onToggleUserCard = useCallback((value: boolean) => {
    if (!value) {
      setShowUserCard(false);
      setUserCardConfirmed(false);
      return;
    }
    Alert.alert(
      "Kullanıcı kartı",
      "Videoda profil fotoğrafınız ve firma bilginiz alt bant (lower-third) olarak görünsün mü? Örnek görsel aşağıda gösterilmiştir.",
      [
        { text: "Hayır", style: "cancel", onPress: () => { setShowUserCard(false); setUserCardConfirmed(false); } },
        {
          text: "Evet, gösterilsin",
          onPress: () => {
            setShowUserCard(true);
            setUserCardConfirmed(true);
          },
        },
      ],
    );
  }, []);

  const handleWeDoItForYou = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert("Giriş gerekli", "Talep oluşturmak için giriş yapın.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş", onPress: () => router.push("login") },
      ]);
      return;
    }
    if (!canSubmitOrder || !parcelPayload || !tkgmData) {
      Alert.alert("Parsel seçin", "Önce il, ilçe, mahalle, ada ve parsel girip Sorgula deyin.");
      return;
    }
    if (creditCost == null) {
      Alert.alert("Kredi bilgisi", "Kredi maliyeti yüklenemedi. Lütfen tekrar deneyin.", [
        { text: "Tamam", onPress: () => void loadCreditCost() },
      ]);
      return;
    }

    const summaryLine = resultSummary || "";
    const cardLine = showUserCard && userCardConfirmed
      ? "Videoda kullanıcı kartı gösterilecek."
      : "Videoda kullanıcı kartı gösterilmeyecek.";
    const noteLine = userNote.trim() ? `\n\nNotunuz:\n${userNote.trim().slice(0, 200)}` : "";
    Alert.alert(
      "Onay",
      `${creditCost} Tepe Coin harcanacak.\n\n${summaryLine}\n\n${cardLine}${noteLine}\n\nDevam edilsin mi?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Onayla",
          onPress: async () => {
            setPurchaseBusy(true);
            try {
              const idempotencyKey =
                typeof globalThis.crypto?.randomUUID === "function"
                  ? globalThis.crypto.randomUUID()
                  : `aidrone-${Date.now()}-${Math.random().toString(36).slice(2)}`;
              const res = await aiDroneProparcelService.createRequest({
                parcel: {
                  mahalleTkgmValue: parcelPayload.mahalleTkgmValue,
                  mahalle: parcelPayload.mahalle,
                  ada: parcelPayload.ada,
                  parsel: parcelPayload.parsel,
                  city: parcelPayload.city,
                  town: parcelPayload.town,
                  proparcelValue: parcelPayload.proparcelValue ?? null,
                },
                tkgmSummary: summaryLine,
                userNote: userNote.trim(),
                showUserCard: showUserCard && userCardConfirmed,
                idempotencyKey,
              });
              if (res.success) {
                const used = res.creditsUsed ?? creditCost;
                const balance = res.newBalance;
                const newId = res.requestId;
                Alert.alert(
                  "Talep alındı",
                  `${used} Tepe Coin kullanıldı.${balance != null ? ` Kalan bakiye: ${balance}` : ""}\n\nDrone videonuz hazırlandığında bildirim ile link paylaşılacaktır.`,
                  [
                    ...(newId
                      ? [{ text: "İş detayı", onPress: () => router.push("ai-drone-job-detail", { requestId: String(newId) }) }]
                      : []),
                    { text: "İşlerim", onPress: () => router.push("ai-drone-jobs") },
                    { text: "Tamam", onPress: () => router.back() },
                  ],
                );
              } else {
                Alert.alert("İşlem başarısız", res.error || "Talep oluşturulamadı.");
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
  }, [
    isAuthenticated,
    canSubmitOrder,
    parcelPayload,
    tkgmData,
    creditCost,
    resultSummary,
    userNote,
    showUserCard,
    userCardConfirmed,
    router,
    loadCreditCost,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Drone Video</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAwareScrollScreen
        ref={scrollRef}
        headerHeight={56}
        backgroundColor={COLORS.pageBg}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        nestedScrollEnabled={false}
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="desktop-outline" size={36} color={COLORS.accent} />
          </View>
          <Text style={styles.leadTitle}>Masaüstü bilgisayarınızdan kullanabilirsiniz</Text>
          <Text style={styles.leadBody}>
            AI Drone Video editörü web tarayıcısında (Chrome / Edge / Firefox) en iyi deneyimi sunar. Aşağıdan
            parsel seçip sorgulayarak videonuzu bizim üretmemizi talep edebilirsiniz.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.jobsLinkCard}
          onPress={() => {
            if (!isAuthenticated) {
              Alert.alert("Giriş gerekli", "İşlerinizi görmek için giriş yapın.", [
                { text: "İptal", style: "cancel" },
                { text: "Giriş", onPress: () => router.push("login") },
              ]);
              return;
            }
            router.push("ai-drone-jobs");
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="briefcase-outline" size={22} color={COLORS.accent} />
          <View style={styles.jobsLinkTextWrap}>
            <Text style={styles.jobsLinkTitle}>İşlerim</Text>
            <Text style={styles.jobsLinkHint}>Taleplerinizin durumu, indirme ve geri bildirim</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </TouchableOpacity>

        <View style={styles.creditCard}>
          <Image source={TepeCoinIcon} style={styles.coinIcon} resizeMode="contain" />
          <View style={styles.creditTextWrap}>
            <Text style={styles.creditLabel}>Sizin yerinize üretim hizmeti</Text>
            {costLoading ? (
              <ActivityIndicator color="#b45309" style={{ marginTop: 6, alignSelf: "flex-start" }} />
            ) : creditCost != null ? (
              <Text style={styles.creditValue}>{creditCost} Tepe Coin</Text>
            ) : (
              <TouchableOpacity onPress={() => void loadCreditCost()} activeOpacity={0.7}>
                <Text style={styles.creditRetry}>Maliyet yüklenemedi — yenile</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parsel bilgileri</Text>
          <Text style={styles.sectionHint}>Ana sayfadaki parsel sorgu formu ile aynı alanlar.</Text>
          <AdaParselForm
            embedded
            scrollRef={scrollRef}
            onClose={() => {}}
            onSubmit={handleParcelQuery}
            variant="light"
          />
          {queryLoading ? (
            <View style={styles.queryLoadingRow}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={styles.queryLoadingText}>TKGM sorgulanıyor…</Text>
            </View>
          ) : null}
        </View>

        {resultSummary ? (
          <View style={styles.resultCard}>
            <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            <View style={styles.resultTextWrap}>
              <Text style={styles.resultTitle}>TKGM sonucu</Text>
              <Text style={styles.resultBody}>{resultSummary}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Açıklama (isteğe bağlı)</Text>
          <Text style={styles.sectionHint}>
            Videoda vurgulanmasını istediğiniz noktalar, müzik tercihi veya özel notlarınızı yazabilirsiniz.
          </Text>
          <View ref={noteInputWrapRef} collapsable={false}>
            <TextInput
              style={styles.noteInput}
              placeholder="Örn: Parselin güney cephesini öne çıkarın…"
              placeholderTextColor="#94a3b8"
              value={userNote}
              onChangeText={setUserNote}
              multiline
              maxLength={4000}
              textAlignVertical="top"
              onFocus={scrollNoteIntoView}
              onBlur={scrollNoteBlur}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.userCardRow}>
            <View style={styles.userCardTextWrap}>
              <Text style={styles.sectionTitle}>Kullanıcı kartı videoda görünsün mü?</Text>
              <Text style={styles.sectionHint}>
                Profil ve firma bilginiz videoda alt bant olarak yer alır (örnek aşağıda).
              </Text>
            </View>
            <Switch
              value={showUserCard && userCardConfirmed}
              onValueChange={onToggleUserCard}
              trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
              thumbColor={showUserCard && userCardConfirmed ? COLORS.accent : "#f1f5f9"}
            />
          </View>
          <Text style={styles.exampleLabel}>Örnek kullanıcı kartı</Text>
          <Image source={UserCardExample} style={styles.userCardExample} resizeMode="contain" accessibilityLabel="Kullanıcı kartı örneği" />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sizin Yerinize Biz Yapalım</Text>
          <Text style={styles.sectionBody}>
            İsterseniz sizin yerinize ultra gerçekçi drone videonuzu biz üretip size gönderebiliriz. Önce yukarıdan
            parsel sorgusu yapın; ardından onaylayarak talebi iletin.
          </Text>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!canSubmitOrder || purchaseBusy || creditCost == null) && styles.primaryBtnDisabled,
            ]}
            onPress={handleWeDoItForYou}
            activeOpacity={0.85}
            disabled={!canSubmitOrder || purchaseBusy || creditCost == null}
          >
            {purchaseBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="airplane" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Sizin Yerinize Biz Yapalım</Text>
              </>
            )}
          </TouchableOpacity>
          {!canSubmitOrder ? (
            <Text style={styles.hint}>Aktif olması için önce parsel sorgusu tamamlanmalıdır.</Text>
          ) : null}
        </View>
      </KeyboardAwareScrollScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.headerBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: COLORS.headerBg,
  },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#f8fafc" },
  scroll: { flex: 1, backgroundColor: COLORS.pageBg },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  leadTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, marginBottom: 8 },
  leadBody: { fontSize: 14, color: COLORS.muted, lineHeight: 21 },
  jobsLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.35)",
  },
  jobsLinkTextWrap: { flex: 1 },
  jobsLinkTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  jobsLinkHint: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  creditCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fffbeb",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  coinIcon: { width: 36, height: 36 },
  creditTextWrap: { flex: 1 },
  creditLabel: { fontSize: 13, color: "#92400e", fontWeight: "600" },
  creditValue: { fontSize: 20, fontWeight: "800", color: "#b45309", marginTop: 2 },
  creditRetry: { fontSize: 13, color: "#b45309", marginTop: 4, textDecorationLine: "underline" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  sectionHint: { fontSize: 13, color: COLORS.muted, marginBottom: 8 },
  sectionBody: { fontSize: 14, color: COLORS.muted, lineHeight: 21, marginBottom: 14 },
  queryLoadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  queryLoadingText: { fontSize: 14, color: COLORS.muted },
  resultCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  resultTextWrap: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: "800", color: "#166534", marginBottom: 4 },
  resultBody: { fontSize: 14, color: "#15803d", lineHeight: 20 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  hint: { fontSize: 12, color: COLORS.muted, marginTop: 10, textAlign: "center" },
  noteInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.5)",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: "#f8fafc",
  },
  userCardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  userCardTextWrap: { flex: 1 },
  exampleLabel: { fontSize: 12, fontWeight: "600", color: COLORS.muted, marginBottom: 8 },
  userCardExample: { width: "100%", height: 120, borderRadius: 10, backgroundColor: "#e2e8f0" },
});
