import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "../../../src/hooks/useNavigation";
import { AdminScreenHeader } from "../../../components/app/admin/AdminScreenHeader";
import { DocumentPreview } from "../../../components/app/admin/DocumentPreview";
import {
  fetchHavalePaymentDetail,
  havalePaymentAction,
} from "../../../services/adminService";
import type { AdminHavalePaymentItem } from "../../../src/types/admin";
import { adminColors, adminCommonStyles } from "../../../styles/admin/common";

export default function AdminHavaleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ paymentRequestId?: string }>();
  const paymentRequestId = Number(params.paymentRequestId || 0);

  const [payment, setPayment] = useState<AdminHavalePaymentItem | null>(null);
  const [logs, setLogs] = useState<Array<{ created_at: string; action: string; note: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [adminNote, setAdminNote] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!paymentRequestId) return;
    setLoading(true);
    const res = await fetchHavalePaymentDetail(paymentRequestId);
    if (res.ok) {
      setPayment(res.data.payment);
      setLogs(res.data.audit_logs || []);
      setAdminNote(res.data.payment?.admin_note || "");
    } else Alert.alert("Hata", res.error);
    setLoading(false);
  }, [paymentRequestId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const runAction = async (action: "approve" | "reject" | "revision") => {
    if ((action === "reject" || action === "revision") && !adminNote.trim()) {
      Alert.alert("Eksik", "Red ve revizyon için admin notu zorunludur.");
      return;
    }
    setActing(true);
    const res = await havalePaymentAction(paymentRequestId, action, adminNote.trim());
    setActing(false);
    if (res.ok) {
      Alert.alert("Tamam", res.data.message || "İşlem kaydedildi.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } else Alert.alert("Hata", res.error);
  };

  const canAct =
    payment &&
    payment.payment_status !== "approved" &&
    payment.payment_status !== "rejected";

  return (
    <SafeAreaView style={adminCommonStyles.container} edges={["top"]}>
      <AdminScreenHeader title="Ödeme Detayı" onBack={() => router.back()} />
      {loading || !payment ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={adminColors.accent} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={adminCommonStyles.card}>
            <Text style={adminCommonStyles.cardTitle}>{payment.payment_reference}</Text>
            <Text style={adminCommonStyles.cardSub}>{payment.user_email}</Text>
            <Text style={styles.line}>Paket: {payment.package_code}</Text>
            <Text style={styles.line}>Beklenen: {payment.amount} ₺</Text>
            <Text style={styles.line}>Durum: {payment.payment_status}</Text>
          </View>

          <View style={adminCommonStyles.card}>
            <Text style={adminCommonStyles.cardTitle}>AI Özeti</Text>
            <Text style={styles.line}>Güven: {payment.ai_confidence_score ?? "—"}</Text>
            <Text style={styles.line}>
              {payment.ai_auto_approved ? "AI otomatik onayladı" : payment.ai_review_required ? "Manuel inceleme" : "—"}
            </Text>
          </View>

          <View style={adminCommonStyles.card}>
            <Text style={adminCommonStyles.cardTitle}>Dekont</Text>
            <DocumentPreview url={payment.receipt_url} label="Dekont" height={260} />
          </View>

          {canAct ? (
            <View style={adminCommonStyles.card}>
              <Text style={adminCommonStyles.cardTitle}>Admin İşlemi</Text>
              <TextInput
                style={styles.noteInput}
                value={adminNote}
                onChangeText={setAdminNote}
                placeholder="Admin notu"
                placeholderTextColor={adminColors.textSecondary}
                multiline
              />
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approve]}
                  onPress={() => runAction("approve")}
                  disabled={acting}
                >
                  <Text style={styles.actionText}>Onayla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.reject]}
                  onPress={() => runAction("reject")}
                  disabled={acting}
                >
                  <Text style={styles.actionText}>Reddet</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.revision]}
                  onPress={() => runAction("revision")}
                  disabled={acting}
                >
                  <Text style={styles.actionText}>Revizyon</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {logs.length > 0 ? (
            <View style={adminCommonStyles.card}>
              <Text style={adminCommonStyles.cardTitle}>Log</Text>
              {logs.slice(0, 10).map((log, idx) => (
                <Text key={idx} style={adminCommonStyles.cardSub}>
                  {log.created_at} · {log.action} {log.note ? `— ${log.note}` : ""}
                </Text>
              ))}
            </View>
          ) : null}
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
  line: {
    color: adminColors.textSecondary,
    fontSize: 14,
    marginTop: 6,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: adminColors.cardBorder,
    borderRadius: 8,
    padding: 10,
    color: adminColors.textPrimary,
    minHeight: 72,
    textAlignVertical: "top",
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  approve: { backgroundColor: adminColors.success },
  reject: { backgroundColor: adminColors.danger },
  revision: { backgroundColor: adminColors.warning },
  actionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
