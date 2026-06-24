import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "../../../src/hooks/useNavigation";
import { AdminScreenHeader } from "../../../components/app/admin/AdminScreenHeader";
import { ApprovalActionBar } from "../../../components/app/admin/ApprovalActionBar";
import { RejectReasonModal } from "../../../components/app/admin/RejectReasonModal";
import { DocumentPreview } from "../../../components/app/admin/DocumentPreview";
import { fetchSalesReports, approveSalesReport, rejectSalesReport } from "../../../services/adminService";
import type { AdminSalesReportItem } from "../../../src/types/admin";
import { adminColors, adminCommonStyles } from "../../../styles/admin/common";

export default function AdminSalesApprovalsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AdminSalesReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminSalesReportItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchSalesReports("submitted");
    if (res.ok) setItems(res.data.items || []);
    else Alert.alert("Hata", res.error);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (item: AdminSalesReportItem) => {
    setActingId(item.id);
    const res = await approveSalesReport(item.id);
    setActingId(null);
    if (res.ok) {
      Alert.alert("Onaylandı", "Tepe Kredi ödülü kullanıcıya tanımlandı.");
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } else Alert.alert("Hata", res.error);
  };

  const handleRejectSubmit = async (reason: string) => {
    if (!rejectTarget) return;
    const item = rejectTarget;
    setRejectTarget(null);
    setActingId(item.id);
    const res = await rejectSalesReport(item.id, reason);
    setActingId(null);
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== item.id));
    else Alert.alert("Hata", res.error);
  };

  return (
    <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
      <AdminScreenHeader title="Emsal Satış Onayları" onBack={() => router.back()} />
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={adminColors.accent} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={adminColors.accent} />}
          contentContainerStyle={items.length === 0 ? adminCommonStyles.empty : styles.list}
          ListEmptyComponent={<Text style={adminCommonStyles.emptyText}>Bekleyen emsal bildirimi yok.</Text>}
          renderItem={({ item }) => (
            <View style={adminCommonStyles.card}>
              <Text style={adminCommonStyles.cardTitle}>
                {item.mahalle} · Ada {item.ada} Parsel {item.parsel}
              </Text>
              <Text style={adminCommonStyles.cardSub}>
                {[item.city_name, item.town_name, item.quarter_name].filter(Boolean).join(" / ")}
              </Text>
              <Text style={adminCommonStyles.cardSub}>Kullanıcı #{item.user_id} · {item.created_at}</Text>
              <DocumentPreview url={item.deed_fee_receipt_url} label="Dekont" height={200} />
              <ApprovalActionBar
                loading={actingId === item.id}
                onApprove={() => handleApprove(item)}
                onReject={() => setRejectTarget(item)}
              />
            </View>
          )}
        />
      )}
      <RejectReasonModal
        visible={!!rejectTarget}
        title="Red notu (opsiyonel)"
        required={false}
        onCancel={() => setRejectTarget(null)}
        onSubmit={handleRejectSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32,
  },
});
