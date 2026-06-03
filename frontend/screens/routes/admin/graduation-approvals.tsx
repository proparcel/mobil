import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "../../../src/hooks/useNavigation";
import { AdminScreenHeader } from "../../../components/app/admin/AdminScreenHeader";
import { ApprovalActionBar } from "../../../components/app/admin/ApprovalActionBar";
import { RejectReasonModal } from "../../../components/app/admin/RejectReasonModal";
import { DocumentPreview } from "../../../components/app/admin/DocumentPreview";
import { fetchGraduationApprovals, graduationApprovalAction } from "../../../services/adminService";
import type { AdminGraduationItem } from "../../../src/types/admin";
import { adminColors, adminCommonStyles } from "../../../styles/admin/common";

const FILTERS = [
  { key: "pending", label: "Bekleyen" },
  { key: "approved", label: "Onaylı" },
  { key: "rejected", label: "Reddedildi" },
];

export default function AdminGraduationApprovalsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<AdminGraduationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminGraduationItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchGraduationApprovals(status);
    if (res.ok) setItems(res.data.graduations || []);
    else Alert.alert("Hata", res.error);
    setLoading(false);
  }, [status]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (item: AdminGraduationItem) => {
    setActingId(item.id);
    const res = await graduationApprovalAction({ graduation_id: item.id, action: "approve" });
    setActingId(null);
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== item.id));
    else Alert.alert("Hata", res.error);
  };

  const handleRejectSubmit = async (reason: string) => {
    if (!rejectTarget) return;
    const item = rejectTarget;
    setRejectTarget(null);
    setActingId(item.id);
    const res = await graduationApprovalAction({
      graduation_id: item.id,
      action: "reject",
      rejection_reason: reason,
    });
    setActingId(null);
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== item.id));
    else Alert.alert("Hata", res.error);
  };

  return (
    <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
      <AdminScreenHeader title="Diploma Onayları" onBack={() => router.back()} />
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, status === f.key && styles.chipActive]}
            onPress={() => setStatus(f.key)}
          >
            <Text style={[styles.chipText, status === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
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
              <Text style={adminCommonStyles.cardTitle}>{item.user_name || item.user_email}</Text>
              <Text style={adminCommonStyles.cardSub}>{item.university} · {item.department}</Text>
              <Text style={adminCommonStyles.cardSub}>{item.education_level} · {item.created_at}</Text>
              <DocumentPreview url={item.diploma_file_url} label="Diploma" height={180} />
              {status === "pending" ? (
                <ApprovalActionBar
                  loading={actingId === item.id}
                  onApprove={() => handleApprove(item)}
                  onReject={() => setRejectTarget(item)}
                />
              ) : null}
            </View>
          )}
        />
      )}
      <RejectReasonModal
        visible={!!rejectTarget}
        title="Red nedeni (opsiyonel)"
        required={false}
        onCancel={() => setRejectTarget(null)}
        onSubmit={handleRejectSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: adminColors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: adminColors.cardBorder,
  },
  chipActive: {
    backgroundColor: adminColors.accent,
    borderColor: adminColors.accent,
  },
  chipText: {
    color: adminColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
});
