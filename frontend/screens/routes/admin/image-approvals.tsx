import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "../../../src/hooks/useNavigation";
import { AdminScreenHeader } from "../../../components/app/admin/AdminScreenHeader";
import { ApprovalActionBar } from "../../../components/app/admin/ApprovalActionBar";
import { RejectReasonModal } from "../../../components/app/admin/RejectReasonModal";
import { fetchImageApprovals, imageApprovalAction } from "../../../services/adminService";
import type { AdminImageApprovalItem } from "../../../src/types/admin";
import { adminColors, adminCommonStyles } from "../../../styles/admin/common";

export default function AdminImageApprovalsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AdminImageApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminImageApprovalItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchImageApprovals();
    if (res.ok) setItems(res.data.images || []);
    else Alert.alert("Hata", res.error);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (item: AdminImageApprovalItem) => {
    const key = `${item.profile_id}-${item.image_type}`;
    setActingId(key);
    const res = await imageApprovalAction({
      profile_id: item.profile_id,
      image_type: item.image_type,
      action: "approve",
      is_mongo_profile: item.is_mongo_profile,
    });
    setActingId(null);
    if (res.ok) {
      setItems((prev) => prev.filter((x) => !(x.profile_id === item.profile_id && x.image_type === item.image_type)));
    } else Alert.alert("Hata", res.error);
  };

  const handleRejectSubmit = async (reason: string) => {
    if (!rejectTarget) return;
    const item = rejectTarget;
    setRejectTarget(null);
    const key = `${item.profile_id}-${item.image_type}`;
    setActingId(key);
    const res = await imageApprovalAction({
      profile_id: item.profile_id,
      image_type: item.image_type,
      action: "reject",
      rejection_reason: reason,
      is_mongo_profile: item.is_mongo_profile,
    });
    setActingId(null);
    if (res.ok) {
      setItems((prev) => prev.filter((x) => !(x.profile_id === item.profile_id && x.image_type === item.image_type)));
    } else Alert.alert("Hata", res.error);
  };

  return (
    <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
      <AdminScreenHeader title="Resim Onayları" onBack={() => router.back()} />
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={adminColors.accent} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.profile_id}-${item.image_type}`}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={adminColors.accent} />}
          contentContainerStyle={items.length === 0 ? adminCommonStyles.empty : styles.list}
          ListEmptyComponent={<Text style={adminCommonStyles.emptyText}>Bekleyen resim yok.</Text>}
          renderItem={({ item }) => {
            const key = `${item.profile_id}-${item.image_type}`;
            return (
              <View style={adminCommonStyles.card}>
                <Text style={adminCommonStyles.cardTitle}>
                  {item.user_name || item.user_email} · {item.image_type === "logo" ? "Logo" : "Avatar"}
                </Text>
                <Text style={adminCommonStyles.cardSub}>{item.user_email}</Text>
                <Text style={adminCommonStyles.cardSub}>{item.uploaded_at}</Text>
                <View style={styles.thumbs}>
                  {item.pending_image_url ? (
                    <Image source={{ uri: item.pending_image_url }} style={styles.thumb} resizeMode="cover" />
                  ) : null}
                  {item.current_image_url ? (
                    <Image source={{ uri: item.current_image_url }} style={[styles.thumb, styles.thumbDim]} resizeMode="cover" />
                  ) : null}
                </View>
                <ApprovalActionBar
                  loading={actingId === key}
                  onApprove={() => handleApprove(item)}
                  onReject={() => setRejectTarget(item)}
                />
              </View>
            );
          }}
        />
      )}
      <RejectReasonModal
        visible={!!rejectTarget}
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
  thumbs: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: "#0b1220",
  },
  thumbDim: {
    opacity: 0.55,
  },
});
