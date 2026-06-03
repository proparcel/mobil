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
import { fetchAdminUsers } from "../../../services/adminService";
import type { AdminUserListItem } from "../../../src/types/admin";
import { adminColors, adminCommonStyles } from "../../../styles/admin/common";

export default function AdminUsersScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchAdminUsers({ search: query, page: 1, page_size: 50 });
    if (res.ok) {
      const payload = res.data as { success?: boolean; items?: AdminUserListItem[]; error?: string };
      if (payload.success === false) {
        setError(payload.error || "Liste alınamadı");
        setItems([]);
      } else {
        setItems(payload.items || []);
      }
    } else {
      setError(res.error || "Liste alınamadı");
      setItems([]);
    }
    setLoading(false);
  }, [query]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
      <AdminScreenHeader title="Kullanıcılar" onBack={() => router.back()} />
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="E-posta veya telefon ara..."
          placeholderTextColor={adminColors.textSecondary}
          autoCapitalize="none"
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
          ListEmptyComponent={
            <Text style={adminCommonStyles.emptyText}>
              {error || (query ? "Arama sonucu yok." : "Kayıtlı kullanıcı yok.")}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={adminCommonStyles.card}
              onPress={() => router.push("admin-user-detail", { userId: String(item.id) })}
              activeOpacity={0.75}
            >
              <Text style={adminCommonStyles.cardTitle}>{item.email}</Text>
              <Text style={adminCommonStyles.cardSub}>
                {item.role_display} · {item.customer_type_display}
              </Text>
              <Text style={styles.balance}>Bakiye: {item.balance} Tepe Coin</Text>
              <Text style={adminCommonStyles.cardSub}>{item.created_at}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  balance: {
    color: adminColors.warning,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
});
