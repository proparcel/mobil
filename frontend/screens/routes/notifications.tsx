import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "../../src/hooks/useNavigation";
import {
  bulkDeleteNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../../services/notificationService";

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await listNotifications(50, 0);
    if (!res.ok) return;
    setItems(res.items);
    setUnread(res.unread_count);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onMarkAllRead = useCallback(async () => {
    if (unread <= 0) return;
    setMarkingAll(true);
    try {
      const res = await markAllNotificationsRead();
      if (!res.ok) {
        Alert.alert("Hata", res.error || "Bildirimler okundu işaretlenemedi.");
        return;
      }
      await load();
    } finally {
      setMarkingAll(false);
    }
  }, [unread, load]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const onToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => (prev.length === items.length ? [] : items.map((item) => item.id)));
  }, [items]);

  const onOpen = useCallback(
    async (n: NotificationItem) => {
      if (!n.is_read) {
        const res = await markNotificationRead(n.id);
        if (res.ok) {
          setItems((prev) =>
            prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)),
          );
          setUnread((c) => Math.max(0, c - 1));
        } else {
          await load();
        }
      }
      if (n.type === "listing_ai_video_ready") {
        const data = (n.data_json || {}) as { job_id?: string; video_id?: string; source?: string };
        const jobId = String(data.job_id || data.video_id || "").trim();
        if (jobId) {
          router.push("ai-video-studio", { tab: "videos", jobId });
          return;
        }
      }
      if (n.type === "ai_drone_request_ready" || n.type === "ai_drone_request_reopened") {
        const data = (n.data_json || {}) as { delivery_url?: string; request_id?: number | string };
        const requestId = String(data.request_id || "").trim();
        if (requestId) {
          router.push("ai-drone-job-detail", { requestId });
          return;
        }
        if (n.type === "ai_drone_request_reopened") {
          router.push("ai-drone-jobs");
          return;
        }
        const url = String(data.delivery_url || "").trim();
        if (url) {
          const can = await Linking.canOpenURL(url);
          if (can) {
            await Linking.openURL(url);
            return;
          }
          Alert.alert("Video linki", url);
          return;
        }
      }
    },
    [load, router],
  );

  const onDelete = useCallback(
    (n: NotificationItem) => {
      Alert.alert("Bildirimi sil", "Bu bildirimi silmek istiyor musunuz?", [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            setDeletingId(n.id);
            try {
              const res = await deleteNotification(n.id);
              if (!res.ok) {
                Alert.alert("Hata", res.error || "Bildirim silinemedi.");
                return;
              }
              setItems((prev) => prev.filter((item) => item.id !== n.id));
              if (!n.is_read) setUnread((c) => Math.max(0, c - 1));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [],
  );

  const onBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    Alert.alert("Bildirimleri sil", `${selectedIds.length} bildirimi silmek istiyor musunuz?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setBulkDeleting(true);
          try {
            const res = await bulkDeleteNotifications(selectedIds);
            if (!res.ok) {
              Alert.alert("Hata", res.error || "Bildirimler silinemedi.");
              return;
            }
            const selected = new Set(selectedIds);
            const unreadDeleted = items.filter((item) => selected.has(item.id) && !item.is_read).length;
            setItems((prev) => prev.filter((item) => !selected.has(item.id)));
            setUnread((c) => Math.max(0, c - unreadDeleted));
            exitSelectionMode();
          } finally {
            setBulkDeleting(false);
          }
        },
      },
    ]);
  }, [exitSelectionMode, items, selectedIds]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirimler</Text>
        <View style={styles.headerRight}>
          {selectionMode ? (
            <TouchableOpacity style={styles.selectBtn} onPress={exitSelectionMode} accessibilityLabel="Seçimi iptal et">
              <Text style={styles.selectText}>İptal</Text>
            </TouchableOpacity>
          ) : (
            <>
              {unread > 0 ? (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={onMarkAllRead}
              disabled={markingAll}
              accessibilityLabel="Tümünü okundu işaretle"
            >
              {markingAll ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={16} color="#fff" />
                  <Text style={styles.markAllText}>Okundu</Text>
                </>
              )}
            </TouchableOpacity>
              ) : null}
              {items.length > 0 ? (
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => setSelectionMode(true)}
                  accessibilityLabel="Bildirim seç"
                >
                  <Text style={styles.selectText}>Seç</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>

      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{selectedIds.length} seçildi</Text>
          <TouchableOpacity style={styles.selectionAction} onPress={onToggleSelectAll}>
            <Text style={styles.selectionActionText}>
              {selectedIds.length === items.length ? "Seçimi kaldır" : "Tümünü seç"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteSelectedBtn, selectedIds.length === 0 && styles.disabledBtn]}
            onPress={onBulkDelete}
            disabled={selectedIds.length === 0 || bulkDeleting}
          >
            {bulkDeleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.deleteSelectedText}>Sil</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={44} color="#cbd5e1" />
            <Text style={styles.emptyText}>Henüz bildirim yok.</Text>
          </View>
        ) : (
          items.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.item, !n.is_read && styles.itemUnread]}
              activeOpacity={0.85}
              onPress={() => (selectionMode ? toggleSelected(n.id) : onOpen(n))}
              onLongPress={() => {
                setSelectionMode(true);
                toggleSelected(n.id);
              }}
            >
              <View style={styles.itemRow}>
                {selectionMode ? (
                  <View style={[styles.checkbox, selectedIds.includes(n.id) && styles.checkboxSelected]}>
                    {selectedIds.includes(n.id) ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                ) : null}
                <View style={styles.iconCircle}>
                  <Ionicons name="notifications" size={18} color="#3b82f6" />
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle}>{n.title}</Text>
                  <Text style={styles.itemMessage}>{n.message}</Text>
                  {!n.is_read ? <Text style={styles.badgeText}>Yeni</Text> : null}
                </View>
                {!selectionMode ? (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onDelete(n)}
                    disabled={deletingId === n.id}
                    accessibilityLabel="Bildirimi sil"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {deletingId === n.id ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  headerRight: { minWidth: 104, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.5)",
  },
  markAllText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  selectBtn: {
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  selectText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.25)",
  },
  selectionText: { flex: 1, color: "#fff", fontWeight: "900" },
  selectionAction: {
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.14)",
  },
  selectionActionText: { color: "#bfdbfe", fontWeight: "900", fontSize: 12 },
  deleteSelectedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#ef4444",
  },
  deleteSelectedText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  disabledBtn: { opacity: 0.45 },
  content: { flex: 1, backgroundColor: "#f5f5f5" },
  empty: { padding: 24, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: "#64748b", fontWeight: "700" },
  item: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 10 },
  itemUnread: { borderColor: "rgba(59,130,246,0.6)" },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  checkboxSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  iconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(59,130,246,0.08)", alignItems: "center", justifyContent: "center" },
  itemBody: { flex: 1 },
  itemTitle: { color: "#1e293b", fontWeight: "900" },
  itemMessage: { color: "#64748b", marginTop: 4, fontWeight: "600" },
  badgeText: { marginTop: 8, color: "#3b82f6", fontWeight: "900" },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
});
