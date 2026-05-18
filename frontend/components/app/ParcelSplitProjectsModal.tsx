/**
 * Hisseli Parsel Projelerim modalı.
 * Hem yerel depolamadan hem de backend API'den projeleri listeler.
 * Yerel projeler: PDF aç/paylaş
 * Backend projeleri: Editörde aç (parcel-split ekranına git)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Share from "react-native-share";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import RNFS from "react-native-fs";
import {
  loadSavedParcelSplitProjects,
  removeSavedParcelSplitProject,
  type SavedParcelSplitProject,
} from "../../src/utils/savedParcelSplitProjects";
import AppBottomSheetModal from "./AppBottomSheetModal";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { API_URL } from "../../config/api";
import { storageService } from "../../services/storageService";
import { useRouter } from "../../src/hooks/useNavigation";

type BackendProject = {
  id: number;
  mahalle: string;
  ada: string;
  parsel: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
};

type BackendProjectDetail = BackendProject & {
  geometry_json: string;
  state_json: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ParcelSplitProjectsModal({ visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [localItems, setLocalItems] = useState<SavedParcelSplitProject[]>([]);
  const [backendItems, setBackendItems] = useState<BackendProject[]>([]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const listBottomPadding = useMemo(() => (insets.bottom || 0) + 24, [insets.bottom]);
  const snapPoints = useMemo(() => ["70%", "88%"], []);

  const getDjangoUrl = useCallback(() => {
    let url = API_URL;
    if (url.includes(":7001")) url = url.replace(":7001", ":7000");
    url = url.replace("/api", "").replace(/\/$/, "");
    return url;
  }, []);

  const fetchBackendProjects = useCallback(async () => {
    try {
      const djangoUrl = getDjangoUrl();
      const accessToken = await storageService.getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const resp = await fetch(`${djangoUrl}/api/user/parcel-split-projects/`, { headers });
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.results || []) as BackendProject[];
    } catch {
      return [];
    }
  }, [getDjangoUrl]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [local, backend] = await Promise.all([
        loadSavedParcelSplitProjects().catch(() => []),
        fetchBackendProjects(),
      ]);
      setLocalItems(Array.isArray(local) ? local : []);
      setBackendItems(Array.isArray(backend) ? backend : []);
    } catch {
      setLocalItems([]);
      setBackendItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchBackendProjects]);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const empty = useMemo(
    () => !loading && localItems.length === 0 && backendItems.length === 0,
    [loading, localItems.length, backendItems.length]
  );

  /* ─── Local PDF açma ─── */
  const handleLocalItemPress = useCallback(async (p: SavedParcelSplitProject) => {
    const rawPath = p.filePath.replace(/^file:\/\//, "");
    const fileUrl = rawPath === p.filePath ? `file://${p.filePath}` : p.filePath;
    try {
      const exists = await RNFS.exists(rawPath);
      if (!exists) {
        Alert.alert("Dosya bulunamadı", "PDF dosyası cihazda bulunamadı.");
        return;
      }
      try {
        await Linking.openURL(fileUrl);
        return;
      } catch {
        /* fallback to share */
      }
      await Share.open({
        url: fileUrl,
        type: "application/pdf",
        title: p.fileName,
      });
    } catch (e: any) {
      if (e?.message === "User did not share") return;
      Alert.alert("Hata", e?.message || "PDF açılamadı.");
    }
  }, []);

  /* ─── Local silme ─── */
  const handleLocalDelete = useCallback(async (id: string) => {
    Alert.alert("Projeyi Sil", "Bu projeyi listeden kaldırmak istiyor musunuz? (Dosya silinmez)", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            const next = await removeSavedParcelSplitProject(id);
            setLocalItems(next);
          } catch (e: any) {
            Alert.alert("Hata", e?.message || "Silme işlemi başarısız oldu.");
          }
        },
      },
    ]);
  }, []);

  /* ─── Backend proje detayını yükle ve editöre git ─── */
  const handleBackendItemPress = useCallback(async (proj: BackendProject) => {
    try {
      const djangoUrl = getDjangoUrl();
      const accessToken = await storageService.getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const resp = await fetch(`${djangoUrl}/api/user/parcel-split-projects/${proj.id}/`, { headers });
      if (!resp.ok) {
        Alert.alert("Hata", "Proje detayı yüklenemedi.");
        return;
      }
      const detail: BackendProjectDetail = await resp.json();

      onClose();

      // state_json içinden originMeters ve diğer ayarları parse et
      let savedState: Record<string, any> = {};
      try {
        savedState = JSON.parse(detail.state_json || "{}");
      } catch { /* ignore */ }

      router.push({
        pathname: "parcel-split",
        params: {
          parentPolygon: detail.geometry_json || "",
          mahalle: detail.mahalle || "",
          ada: detail.ada || "",
          parsel: detail.parsel || "",
          // state_json'u parametre olarak geçir (editör orada parse eder)
          savedStateJson: detail.state_json || "",
        },
      });
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Proje açılamadı.");
    }
  }, [getDjangoUrl, onClose, router]);

  /* ─── Backend silme ─── */
  const handleBackendDelete = useCallback(async (id: number) => {
    Alert.alert("Projeyi Sil", "Bu projeyi kalıcı olarak silmek istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            const djangoUrl = getDjangoUrl();
            const accessToken = await storageService.getAccessToken();
            const headers: Record<string, string> = {
              "ngrok-skip-browser-warning": "true",
            };
            if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
            await fetch(`${djangoUrl}/api/user/parcel-split-projects/${id}/delete/`, {
              method: "DELETE",
              headers,
            });
            setBackendItems((prev) => prev.filter((p) => p.id !== id));
          } catch (e: any) {
            Alert.alert("Hata", e?.message || "Silme işlemi başarısız oldu.");
          }
        },
      },
    ]);
  }, [getDjangoUrl]);

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={snapPoints}
      initialIndex={0}
      modalProps={{ containerStyle: styles.backdrop }}
    >
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>Hisseli Parsel Projelerim</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity onPress={refresh} style={styles.iconBtn} accessibilityLabel="Yenile">
              <Ionicons name="refresh" size={18} color="#334155" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Kapat">
              <Ionicons name="close" size={20} color="#334155" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#93c5fd" />
          <Text style={styles.muted}>Yükleniyor…</Text>
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Kayıtlı hisseli parsel projesi yok.</Text>
        </View>
      ) : (
        <BottomSheetScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          scrollEventThrottle={16}
        >
          {/* ── Backend projeleri (Editörde açılabilir) ── */}
          {backendItems.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Editör Projeleri</Text>
              {backendItems.map((p) => (
                <View key={`b-${p.id}`} style={styles.card}>
                  <TouchableOpacity onPress={() => handleBackendItemPress(p)} style={styles.cardMain} activeOpacity={0.8}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons name="create-outline" size={14} color="#3b82f6" style={{ marginRight: 6 }} />
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {p.title || `${p.ada}/${p.parsel}` || "Proje"}
                      </Text>
                    </View>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {p.updated_at ? new Date(p.updated_at).toLocaleString("tr-TR") : ""}
                      {p.mahalle ? ` • ${p.mahalle}` : ""}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleBackendDelete(p.id)} style={styles.delBtn} accessibilityLabel="Sil">
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* ── Yerel PDF projeleri ── */}
          {localItems.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Yerel PDF Dosyaları</Text>
              {localItems.map((p) => (
                <View key={p.id} style={styles.card}>
                  <TouchableOpacity onPress={() => handleLocalItemPress(p)} style={styles.cardMain} activeOpacity={0.8}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons name="document-text-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {p.fileName}
                      </Text>
                    </View>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {new Date(p.createdAt).toLocaleString("tr-TR")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleLocalDelete(p.id)} style={styles.delBtn} accessibilityLabel="Sil">
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </BottomSheetScrollView>
      )}
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "transparent" },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.08)",
    flexDirection: "row",
    alignItems: "center",
  },
  title: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  headerBtns: { marginLeft: "auto", flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  center: { padding: 18, alignItems: "center", gap: 10 },
  muted: { color: "rgba(15,23,42,0.65)", fontSize: 12, fontWeight: "600" },
  list: { flex: 1, paddingHorizontal: 12 },
  listContent: { paddingVertical: 10, gap: 10 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
  },
  cardMain: { flex: 1 },
  cardTitleRow: { flexDirection: "row", alignItems: "center" },
  cardTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800", flex: 1 },
  cardMeta: { color: "rgba(15,23,42,0.45)", fontSize: 11, marginTop: 6, fontWeight: "600" },
  delBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
});
