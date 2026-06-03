import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../../src/hooks/useNavigation";
import { useAuth } from "../../contexts/AuthContext";
import { AdminScreenHeader } from "../../../components/app/admin/AdminScreenHeader";
import { AdminPendingBadge } from "../../../components/app/admin/AdminPendingBadge";
import { fetchAdminPendingCounts } from "../../../services/adminService";
import type { AdminPendingCounts } from "../../../src/types/admin";
import { adminColors, adminCommonStyles } from "../../../styles/admin/common";
import { isAppAdminUser } from "../../../src/utils/adminAccess";

type HubItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  countKey?: keyof AdminPendingCounts;
  section: "users" | "approvals" | "other";
};

const HUB_ITEMS: HubItem[] = [
  {
    id: "users",
    title: "Kullanıcılar",
    subtitle: "Liste ve kredi ekleme",
    icon: "people-outline",
    route: "admin-users",
    section: "users",
  },
  {
    id: "image",
    title: "Resim Onayları",
    subtitle: "Avatar ve logo",
    icon: "images-outline",
    route: "admin-image-approvals",
    countKey: "pending_image_count",
    section: "approvals",
  },
  {
    id: "graduation",
    title: "Diploma Onayları",
    subtitle: "Mezuniyet belgeleri",
    icon: "school-outline",
    route: "admin-graduation-approvals",
    countKey: "pending_graduation_count",
    section: "approvals",
  },
  {
    id: "havale",
    title: "Havale / Dekont",
    subtitle: "Ödeme onayları",
    icon: "card-outline",
    route: "admin-havale-approvals",
    countKey: "pending_havale_payments_count",
    section: "approvals",
  },
  {
    id: "sales",
    title: "Emsal Satış",
    subtitle: "Satış bildirimi onayları",
    icon: "document-text-outline",
    route: "admin-sales-approvals",
    countKey: "pending_sales_report_count",
    section: "approvals",
  },
  {
    id: "drone",
    title: "AI Drone İstekleri",
    subtitle: "Salt okunur liste",
    icon: "airplane-outline",
    route: "admin-ai-drone-requests",
    countKey: "pending_ai_drone_requests_count",
    section: "approvals",
  },
  {
    id: "web",
    title: "Tam Panel (Web)",
    subtitle: "Tüm admin sekmeleri",
    icon: "globe-outline",
    route: "portal-webview",
    section: "other",
  },
];

export default function AdminHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [counts, setCounts] = useState<AdminPendingCounts>({});
  const [loading, setLoading] = useState(true);

  const isAdmin = isAppAdminUser(user);

  const loadCounts = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminPendingCounts();
    if (res.ok) setCounts(res.data.counts || {});
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadCounts();
    else setLoading(false);
  }, [isAdmin, loadCounts]);

  const onItemPress = (item: HubItem) => {
    if (item.route === "portal-webview") {
      router.push("portal-webview", { path: "/accounts/admin/", title: "Admin Panel" });
      return;
    }
    router.push(item.route as never);
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
        <AdminScreenHeader title="Admin Panel" onBack={() => router.back()} />
        <View style={adminCommonStyles.empty}>
          <Text style={adminCommonStyles.emptyText}>Bu alana erişim yetkiniz yok.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderSection = (title: string, section: HubItem["section"]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {HUB_ITEMS.filter((i) => i.section === section).map((item) => (
        <TouchableOpacity key={item.id} style={styles.row} onPress={() => onItemPress(item)} activeOpacity={0.7}>
          <Ionicons name={item.icon as any} size={22} color={adminColors.accent} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowSub}>{item.subtitle}</Text>
          </View>
          {item.countKey ? <AdminPendingBadge count={counts[item.countKey] || 0} /> : null}
          <Ionicons name="chevron-forward" size={18} color={adminColors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
      <AdminScreenHeader title="Admin Panel" onBack={() => router.back()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={adminColors.accent} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {renderSection("Kullanıcı Yönetimi", "users")}
          {renderSection("Onaylar", "approvals")}
          {renderSection("Diğer", "other")}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: adminColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: adminColors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: adminColors.cardBorder,
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    color: adminColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  rowSub: {
    color: adminColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
