import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "../../../src/hooks/useNavigation";
import { AdminScreenHeader } from "../../../components/app/admin/AdminScreenHeader";
import { fetchAiDroneRequests } from "../../../services/adminService";
import type { AdminAiDroneItem, AdminAiDroneStats } from "../../../src/types/admin";
import { adminColors, adminCommonStyles } from "../../../styles/admin/common";

export default function AdminAiDroneRequestsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AdminAiDroneItem[]>([]);
  const [stats, setStats] = useState<AdminAiDroneStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchAiDroneRequests({ q: query, page: 1 });
    if (res.ok) {
      setItems(res.data.items || []);
      setStats(res.data.stats || null);
    }
    setLoading(false);
  }, [query]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
      <AdminScreenHeader title="AI Drone İstekleri" onBack={() => router.back()} />
      {stats ? (
        <View style={styles.statsRow}>
          <StatChip label="Toplam" value={stats.total} />
          <StatChip label="Bekleyen" value={stats.pending_count} />
          <StatChip label="Atanan" value={stats.assigned} />
        </View>
      ) : null}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Id veya not ara..."
          placeholderTextColor={adminColors.textSecondary}
          returnKeyType="search"
          onSubmitEditing={() => setQuery(search.trim())}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => setQuery(search.trim())}>
          <Text style={styles.searchBtnText}>Ara</Text>
        </TouchableOpacity>
      </View>
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={adminColors.accent} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={adminColors.accent} />}
          contentContainerStyle={items.length === 0 ? adminCommonStyles.empty : styles.list}
          ListEmptyComponent={<Text style={adminCommonStyles.emptyText}>Kayıt yok.</Text>}
          renderItem={({ item }) => (
            <View style={adminCommonStyles.card}>
              <Text style={adminCommonStyles.cardTitle}>#{item.id} · {item.status_display}</Text>
              <Text style={adminCommonStyles.cardSub}>
                {item.requester_name || item.requester_email || `Kullanıcı #${item.requester_id}`}
              </Text>
              <Text style={adminCommonStyles.cardSub} numberOfLines={3}>
                {item.tkgm_summary || item.user_note || "—"}
              </Text>
              <Text style={adminCommonStyles.cardSub}>{item.created_at}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 4,
  },
  statChip: {
    flex: 1,
    backgroundColor: adminColors.card,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: adminColors.cardBorder,
  },
  statValue: {
    color: adminColors.textPrimary,
    fontWeight: "700",
    fontSize: 16,
  },
  statLabel: {
    color: adminColors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: adminColors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: adminColors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: adminColors.cardBorder,
  },
  searchBtn: {
    backgroundColor: adminColors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  searchBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
});
