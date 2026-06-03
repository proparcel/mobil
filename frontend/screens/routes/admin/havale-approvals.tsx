import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "../../../src/hooks/useNavigation";
import { AdminScreenHeader } from "../../../components/app/admin/AdminScreenHeader";
import { fetchHavalePayments } from "../../../services/adminService";
import type { AdminHavalePaymentItem } from "../../../src/types/admin";
import { adminColors, adminCommonStyles } from "../../../styles/admin/common";

export default function AdminHavaleApprovalsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AdminHavalePaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchHavalePayments({ page: 1 });
    if (res.ok) setItems(res.data.items || []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending_review: "İnceleme bekliyor",
      approved: "Onaylandı",
      rejected: "Reddedildi",
      needs_revision: "Revizyon",
      receipt_uploaded: "Dekont yüklendi",
      created: "Oluşturuldu",
    };
    return map[status] || status;
  };

  return (
    <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
      <AdminScreenHeader title="Havale Onayları" onBack={() => router.back()} />
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={adminColors.accent} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={adminColors.accent} />}
          contentContainerStyle={items.length === 0 ? adminCommonStyles.empty : styles.list}
          ListEmptyComponent={<Text style={adminCommonStyles.emptyText}>Ödeme kaydı yok.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={adminCommonStyles.card}
              onPress={() => router.push("admin-havale-detail", { paymentRequestId: String(item.id) })}
              activeOpacity={0.75}
            >
              <Text style={adminCommonStyles.cardTitle}>{item.payment_reference}</Text>
              <Text style={adminCommonStyles.cardSub}>{item.user_email}</Text>
              <Text style={adminCommonStyles.cardSub}>
                {item.package_code} · {item.amount} ₺ · {statusLabel(item.payment_status)}
              </Text>
              {item.ai_auto_approved ? (
                <Text style={styles.aiBadge}>AI onaylı</Text>
              ) : item.ai_review_required ? (
                <Text style={styles.reviewBadge}>Manuel inceleme</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  aiBadge: {
    color: adminColors.success,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  reviewBadge: {
    color: adminColors.warning,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
});
