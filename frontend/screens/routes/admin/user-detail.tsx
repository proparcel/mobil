import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "../../../src/hooks/useNavigation";
import { AdminScreenHeader } from "../../../components/app/admin/AdminScreenHeader";
import { addAdminUserCredit, fetchAdminUserDetail } from "../../../services/adminService";
import type { AdminUserDetail } from "../../../src/types/admin";
import { adminColors, adminCommonStyles } from "../../../styles/admin/common";

export default function AdminUserDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = Number(params.userId || 0);

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditOpen, setCreditOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const res = await fetchAdminUserDetail(userId);
    if (res.ok) setUser(res.data.user);
    else Alert.alert("Hata", res.error);
    setLoading(false);
  }, [userId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const submitCredit = async () => {
    const value = parseInt(amount, 10);
    if (!value || value <= 0) {
      Alert.alert("Hata", "Geçerli bir miktar girin.");
      return;
    }
    setSubmitting(true);
    const res = await addAdminUserCredit(userId, value, notes);
    setSubmitting(false);
    if (res.ok) {
      Alert.alert("Başarılı", `Yeni bakiye: ${res.data.new_balance}`);
      setCreditOpen(false);
      setAmount("");
      setNotes("");
      load();
    } else Alert.alert("Hata", res.error);
  };

  return (
    <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
      <AdminScreenHeader title="Kullanıcı Detayı" onBack={() => router.back()} />
      {loading || !user ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={adminColors.accent} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={adminCommonStyles.card}>
            <Text style={adminCommonStyles.cardTitle}>{user.email}</Text>
            <Text style={adminCommonStyles.cardSub}>{user.phone_number || "—"}</Text>
            <Text style={adminCommonStyles.cardSub}>
              {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.company_name || "—"}
            </Text>
            <Text style={styles.line}>Rol: {user.role_display}</Text>
            <Text style={styles.line}>Müşteri tipi: {user.customer_type_display}</Text>
            <Text style={styles.line}>Durum: {user.is_active ? "Aktif" : "Pasif"}</Text>
            <Text style={styles.line}>Kayıt: {user.created_at}</Text>
          </View>
          <View style={adminCommonStyles.card}>
            <Text style={adminCommonStyles.cardTitle}>Tepe Coin</Text>
            <Text style={styles.balance}>Bakiye: {user.balance}</Text>
            <Text style={adminCommonStyles.cardSub}>Toplam alınan: {user.total_purchased}</Text>
            <Text style={adminCommonStyles.cardSub}>Toplam kullanılan: {user.total_used}</Text>
            <TouchableOpacity style={styles.creditBtn} onPress={() => setCreditOpen(true)}>
              <Text style={styles.creditBtnText}>Kredi Ekle</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <Modal visible={creditOpen} transparent animationType="fade" onRequestClose={() => setCreditOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Kredi Ekle</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Miktar"
              placeholderTextColor={adminColors.textSecondary}
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Not (opsiyonel)"
              placeholderTextColor={adminColors.textSecondary}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setCreditOpen(false)}>
                <Text style={adminCommonStyles.cardSub}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.creditBtn} onPress={submitCredit} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.creditBtnText}>Ekle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  line: {
    color: adminColors.textSecondary,
    fontSize: 14,
    marginTop: 6,
  },
  balance: {
    color: adminColors.warning,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  creditBtn: {
    marginTop: 14,
    backgroundColor: adminColors.success,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  creditBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalSheet: {
    backgroundColor: adminColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: adminColors.cardBorder,
  },
  modalTitle: {
    color: adminColors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: adminColors.cardBorder,
    borderRadius: 8,
    padding: 10,
    color: adminColors.textPrimary,
    marginBottom: 10,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
});
