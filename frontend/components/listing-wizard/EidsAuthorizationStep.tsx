import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { ListingWizardForm } from "../../src/types/listingWizard";
import { startEidsLogin } from "../../services/listingWizardService";

type Props = {
  listingId: string;
  form: ListingWizardForm;
  updateForm: (patch: Partial<ListingWizardForm>) => void;
  eidsAuthenticated: boolean;
  eidsConfigured: boolean;
  busy: boolean;
  onRefreshEids: () => Promise<unknown>;
  onCancel?: () => void;
  eidsReturnSignal?: string | null;
};

const COLORS = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  accent: "#3b82f6",
  card: "#ffffff",
  err: "#dc2626",
  ok: "#16a34a",
};

export default function EidsAuthorizationStep({
  listingId,
  form,
  updateForm,
  eidsAuthenticated,
  eidsConfigured,
  busy,
  onRefreshEids,
  onCancel,
  eidsReturnSignal,
}: Props) {
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!eidsReturnSignal) return;
    void onRefreshEids();
    if (eidsReturnSignal.includes("error")) {
      Alert.alert("EİDS", "E-Devlet doğrulaması tamamlanamadı.");
    } else if (eidsReturnSignal.includes("ok")) {
      Alert.alert("EİDS", "E-Devlet doğrulaması tamamlandı.");
    }
  }, [eidsReturnSignal, onRefreshEids]);

  const onStartEdevlet = useCallback(async () => {
    setStarting(true);
    try {
      const res = await startEidsLogin({ listingId, mobileRedirect: true });
      if (!res.ok || !res.data?.auth_url) {
        Alert.alert("EİDS", res.ok ? "Yönlendirme adresi alınamadı." : res.error || "Başlatılamadı.");
        return;
      }
      await Linking.openURL(res.data.auth_url);
    } finally {
      setStarting(false);
    }
  }, [listingId]);

  const auth = form.eidsAuthorization;
  const authorized = auth?.status === "authorized";

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>EİDS kullanıcı ve taşınmaz yetkisi</Text>
      <Text style={styles.hint}>
        E-Devlet ile kullanıcı doğrulaması yapın, ardından taşınmaz ID girerek yetkilendirin.
      </Text>

      {!eidsConfigured ? (
        <Text style={styles.err}>EİDS bağlantısı yapılandırılmamış.</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.btn, (!eidsConfigured || busy || starting) && styles.btnDisabled]}
        onPress={() => void onStartEdevlet()}
        disabled={!eidsConfigured || busy || starting}
      >
        {starting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>
              {eidsAuthenticated ? "E-Devlet doğrulamasını yenile" : "E-Devlet ile doğrula"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {eidsAuthenticated ? (
        <Text style={styles.okText}>E-Devlet doğrulaması tamamlandı.</Text>
      ) : null}

      {authorized ? (
        <View style={styles.authBox}>
          <Text style={styles.authTitle}>Taşınmaz yetkisi onaylandı</Text>
          <Text style={styles.authLine}>
            {[auth?.il, auth?.ilce, auth?.mahalle].filter(Boolean).join(" / ")}
          </Text>
          {auth?.ada || auth?.parsel ? (
            <Text style={styles.authLine}>
              Ada: {auth?.ada || "—"} · Parsel: {auth?.parsel || "—"}
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <Text style={styles.lbl}>Taşınmaz ID</Text>
          <TextInput
            style={styles.input}
            value={form.eidsTasinmazId}
            onChangeText={(t) => updateForm({ eidsTasinmazId: t })}
            placeholder="Taşınmaz kimlik numarası"
            keyboardType="number-pad"
            editable={!busy}
          />
          <Text style={styles.microHint}>Test ortamında 0 ile geçiş yapılabilir.</Text>
        </>
      )}

      {onCancel ? (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={busy}>
          <Text style={styles.cancelText}>İptal</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  hint: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  lbl: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  okText: { color: COLORS.ok, fontSize: 14, fontWeight: "600" },
  err: { color: COLORS.err, fontSize: 14 },
  microHint: { fontSize: 12, color: COLORS.muted },
  authBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  authTitle: { fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  authLine: { color: COLORS.muted, fontSize: 14 },
  cancelBtn: { marginTop: 16, alignItems: "center", padding: 12 },
  cancelText: { color: COLORS.muted, fontWeight: "600" },
});
