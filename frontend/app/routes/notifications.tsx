import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../src/hooks/useNavigation";
import { listNotifications, markNotificationRead, type NotificationItem } from "../../services/notificationService";

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await listNotifications(50, 0);
    if (!res.ok) return;
    setItems(res.items);
    setUnread(res.unread_count);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onOpen = useCallback(
    async (n: NotificationItem) => {
      if (!n.is_read) {
        await markNotificationRead(n.id);
        await load();
      }
    },
    [load]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirimler</Text>
        <View style={styles.headerRight}>
          {unread > 0 ? (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadText}>{unread}</Text>
            </View>
          ) : null}
        </View>
      </View>

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
              onPress={() => onOpen(n)}
            >
              <View style={styles.itemRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="notifications" size={18} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{n.title}</Text>
                  <Text style={styles.itemMessage}>{n.message}</Text>
                </View>
              </View>
              {!n.is_read ? <Text style={styles.badgeText}>Yeni</Text> : null}
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
  headerRight: { width: 36, height: 36, alignItems: "flex-end", justifyContent: "center" },
  unreadPill: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  unreadText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  content: { flex: 1, backgroundColor: "#f5f5f5" },
  empty: { padding: 24, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: "#64748b", fontWeight: "700" },
  item: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 10 },
  itemUnread: { borderColor: "rgba(59,130,246,0.6)" },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(59,130,246,0.08)", alignItems: "center", justifyContent: "center" },
  itemTitle: { color: "#1e293b", fontWeight: "900" },
  itemMessage: { color: "#64748b", marginTop: 4, fontWeight: "600" },
  badgeText: { marginTop: 10, color: "#3b82f6", fontWeight: "900" },
});

