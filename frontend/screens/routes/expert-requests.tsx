import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { KeyboardAwareModal } from "../../components/app/KeyboardAwareModal";
import Ionicons from "react-native-vector-icons/Ionicons";
import { WebView } from "react-native-webview";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { ExpertRequestCard } from "../../components/app/ExpertRequestCard";
import type { ExpertRequestDetail, ExpertRequestListItem } from "../../src/types/expertRequests";
import {
  claimExpertRequest,
  getExpertRequestDetail,
  getExpertRequestsIncoming,
  getExpertRequestsMine,
  markExpertRequestSeen,
  respondExpertRequest,
} from "../../services/expertRequestService";
import { API_URL } from "../../config/api";

export default function ExpertRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();

  const isExpert = user?.role === "consultant" || user?.role === "broker";

  const [tab, setTab] = useState<"mine" | "incoming">("mine");
  const [incomingTab, setIncomingTab] = useState<"pending" | "closed">("pending");

  const [items, setItems] = useState<ExpertRequestListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ExpertRequestDetail | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const canShowIncoming = isAuthenticated && isExpert;

  const loadList = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      if (tab === "mine") {
        const res = await getExpertRequestsMine();
        if (res.ok) setItems(res.items);
      } else {
        const res = await getExpertRequestsIncoming(incomingTab);
        if (res.ok) setItems(res.items);
      }
    } finally {
      setLoading(false);
    }
  }, [incomingTab, isAuthenticated, tab]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadList();
    } finally {
      setRefreshing(false);
    }
  }, [loadList]);

  const openDetail = useCallback(async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setResponseDraft("");
    try {
      const r = await getExpertRequestDetail(id);
      if (!r.ok) {
        Alert.alert("Hata", r.error);
        setDetailOpen(false);
        return;
      }
      setDetail(r.data);
      // mark seen best-effort
      markExpertRequestSeen(id).catch(() => {});
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const canClaim = !!detail?.permissions?.canClaim;
  const canRespond = !!detail?.permissions?.canRespond;
  const canViewPdf = !!detail?.permissions?.canViewPdf;

  const headerRight = useMemo(() => {
    if (tab === "incoming") {
      return (
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.smallPill, incomingTab === "pending" && styles.smallPillActive]}
            onPress={() => setIncomingTab("pending")}
          >
            <Text style={[styles.smallPillText, incomingTab === "pending" && styles.smallPillTextActive]}>Bekleyen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallPill, incomingTab === "closed" && styles.smallPillActive]}
            onPress={() => setIncomingTab("closed")}
          >
            <Text style={[styles.smallPillText, incomingTab === "closed" && styles.smallPillTextActive]}>Kapalı</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <View style={styles.headerRight} />;
  }, [incomingTab, tab]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Uzman Görüşü</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={[styles.empty, { paddingBottom: 24 + insets.bottom }]}>
          <Ionicons name="lock-closed-outline" size={44} color="#cbd5e1" />
          <Text style={styles.emptyText}>Uzman görüşü taleplerini görmek için giriş yapın.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("login")}>
            <Text style={styles.primaryBtnText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Uzman Görüşü</Text>
        {headerRight}
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tabPill, tab === "mine" && styles.tabPillActive]} onPress={() => setTab("mine")}>
          <Text style={[styles.tabText, tab === "mine" && styles.tabTextActive]}>İsteklerim</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, tab === "incoming" && styles.tabPillActive, !canShowIncoming && styles.tabPillDisabled]}
          onPress={() => {
            if (!canShowIncoming) {
              Alert.alert("Uzman gerekli", "Gelen talepler sadece Danışman/Kurumsal hesaplarda görünür.");
              return;
            }
            setTab("incoming");
          }}
        >
          <Text style={[styles.tabText, tab === "incoming" && styles.tabTextActive, !canShowIncoming && styles.tabTextDisabled]}>
            Gelen Talepler
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollScreen
        headerHeight={56}
        backgroundColor="#f8fafc"
        style={styles.content}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.emptyText}>Yükleniyor...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={44} color="#cbd5e1" />
            <Text style={styles.emptyText}>Henüz kayıt yok.</Text>
          </View>
        ) : (
          items.map((it) => (
            <ExpertRequestCard
              key={it.id}
              item={it}
              mode={tab === "incoming" ? "incoming" : "mine"}
              onPress={() => openDetail(it.id)}
            />
          ))
        )}
      </KeyboardAwareScrollScreen>

      {/* Detail modal */}
      <KeyboardAwareModal visible={detailOpen} animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <SafeAreaView style={[styles.modalWrap, { paddingBottom: insets.bottom }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDetailOpen(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={26} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Talep Detayı</Text>
            <View style={{ width: 40 }} />
          </View>

          {detailLoading || !detail ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.emptyText}>Yükleniyor...</Text>
            </View>
          ) : (
            <KeyboardAwareScrollScreen
              headerHeight={56}
              backgroundColor="#fff"
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
            >
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Durum</Text>
                <Text style={styles.detailValue}>{detail.status}</Text>
                <View style={styles.hr} />
                <Text style={styles.detailLabel}>Konum</Text>
                <Text style={styles.detailValue}>
                  {[detail.location.cityName, detail.location.districtName, detail.location.neighborhoodName].filter(Boolean).join(" / ")}
                  {detail.location.ada || detail.location.parsel
                    ? ` • ${detail.location.ada ? `Ada ${detail.location.ada}` : ""}${detail.location.ada && detail.location.parsel ? " / " : ""}${
                        detail.location.parsel ? `Parsel ${detail.location.parsel}` : ""
                      }`
                    : ""}
                </Text>
                <View style={styles.hr} />
                <Text style={styles.detailLabel}>Not</Text>
                <Text style={styles.detailValue}>{(detail.note || "").trim() || "-"}</Text>
              </View>

              {detail.response?.approvedAt ? (
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Uzman Yanıtı</Text>
                  <Text style={[styles.detailValue, { marginTop: 8 }]}>{detail.response.responseText}</Text>
                  {canViewPdf && detail.response.pdfUrl ? (
                    <TouchableOpacity
                      style={[styles.primaryBtn, { marginTop: 12 }]}
                      onPress={() => {
                        const full = `${(API_URL || "").replace(/\/$/, "")}${detail.response?.pdfUrl}`;
                        setPdfUrl(full);
                        setPdfOpen(true);
                      }}
                    >
                      <Text style={styles.primaryBtnText}>PDF Aç</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {canClaim ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 12 }]}
                  onPress={async () => {
                    try {
                      const r = await claimExpertRequest(detail.id);
                      if (!r.ok) {
                        Alert.alert("Hata", r.error);
                        return;
                      }
                      const d = await getExpertRequestDetail(detail.id);
                      if (d.ok) setDetail(d.data);
                      await loadList();
                    } catch (e: any) {
                      Alert.alert("Hata", e?.message || "İşlem başarısız");
                    }
                  }}
                >
                  <Text style={styles.primaryBtnText}>Üstlen (Claim)</Text>
                </TouchableOpacity>
              ) : null}

              {canRespond ? (
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Yanıt Yaz</Text>
                  <TextInput
                    style={styles.textarea}
                    value={responseDraft}
                    onChangeText={setResponseDraft}
                    placeholder="Uzman görüşünüz..."
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginTop: 12 }]}
                    onPress={async () => {
                      if (!responseDraft.trim()) {
                        Alert.alert("Uyarı", "Yanıt metni gerekli.");
                        return;
                      }
                      try {
                        const r = await respondExpertRequest(detail.id, responseDraft.trim());
                        if (!r.ok) {
                          Alert.alert("Hata", r.error);
                          return;
                        }
                        const d = await getExpertRequestDetail(detail.id);
                        if (d.ok) setDetail(d.data);
                        await loadList();
                        Alert.alert("Başarılı", "Yanıt gönderildi.");
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "İşlem başarısız");
                      }
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Onayla ve Gönder</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </KeyboardAwareScrollScreen>
          )}
        </SafeAreaView>
      </KeyboardAwareModal>

      {/* PDF modal */}
      <Modal visible={pdfOpen} animationType="fade" onRequestClose={() => setPdfOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={styles.pdfHeader}>
            <TouchableOpacity onPress={() => setPdfOpen(false)} style={styles.pdfCloseBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.pdfTitle}>PDF</Text>
            <View style={{ width: 40 }} />
          </View>
          {pdfUrl ? <WebView source={{ uri: pdfUrl }} style={{ flex: 1 }} /> : null}
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
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "#3b82f6",
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff", flex: 1, textAlign: "center" },
  headerRight: { width: 120, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  smallPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  smallPillActive: { backgroundColor: "rgba(59,130,246,0.35)" },
  smallPillText: { color: "rgba(255,255,255,0.85)", fontWeight: "900", fontSize: 11 },
  smallPillTextActive: { color: "#fff" },
  tabsRow: { flexDirection: "row", gap: 10, padding: 12, backgroundColor: "#0f172a" },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  tabPillActive: { backgroundColor: "rgba(59,130,246,0.28)", borderColor: "rgba(59,130,246,0.45)" },
  tabPillDisabled: { opacity: 0.6 },
  tabText: { color: "rgba(255,255,255,0.85)", fontWeight: "900" },
  tabTextActive: { color: "#fff" },
  tabTextDisabled: { color: "rgba(255,255,255,0.65)" },
  content: { flex: 1, backgroundColor: "#f5f5f5" },
  empty: { padding: 24, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: "#64748b", fontWeight: "800", textAlign: "center" },
  primaryBtn: { backgroundColor: "#3b82f6", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  modalWrap: { flex: 1, backgroundColor: "#f5f5f5" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalCloseBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  detailCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 12 },
  detailLabel: { color: "#64748b", fontWeight: "900", fontSize: 12 },
  detailValue: { color: "#0f172a", fontWeight: "800", fontSize: 13, marginTop: 6, lineHeight: 18 },
  hr: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 12 },
  textarea: {
    marginTop: 10,
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    color: "#0f172a",
    backgroundColor: "#fff",
    textAlignVertical: "top",
    fontWeight: "700",
  },

  pdfHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#0b1220",
  },
  pdfCloseBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pdfTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
});

