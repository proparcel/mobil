import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Image, Linking, Share, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { getReferralCode } from "../../services/referralService";

const TepeCoinIcon = require("../../assets/images/TepeCoin.png");

export default function TepeCoinEarnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const qrUrl = useMemo(() => {
    if (!referralLink) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(referralLink)}`;
  }, [referralLink]);

  const loadReferral = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await getReferralCode();
    if (!res.ok) return;
    setReferralLink(`https://proparcel.com/r/${res.code}`);
  }, [isAuthenticated]);

  useEffect(() => {
    loadReferral();
  }, [loadReferral]);

  const shareWhatsApp = useCallback(async () => {
    if (!referralLink) return;
    const text = `ProParcel davet linkim: ${referralLink}`;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }
      await Share.share({ message: text });
    } catch {
      await Share.share({ message: text });
    }
  }, [referralLink]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tepe Coin Kazan</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}>
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Image source={TepeCoinIcon} style={styles.cardIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Bizi Öner</Text>
              <Text style={styles.cardSubtitle}>Arkadaşın linkinle kayıt olursa 5 coin.</Text>
            </View>
          </View>
          {!isAuthenticated ? (
            <Text style={styles.muted}>Davet linki için giriş yapmanız gerekir.</Text>
          ) : (
            <>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, !referralLink && styles.actionBtnDisabled]}
                  disabled={!referralLink}
                  onPress={shareWhatsApp}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary, !referralLink && styles.actionBtnDisabled]}
                  disabled={!referralLink}
                  onPress={() => setQrVisible(true)}
                >
                  <Ionicons name="qr-code" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>QR</Text>
                </TouchableOpacity>
              </View>
              {referralLink ? <Text style={styles.muted}>{referralLink}</Text> : <Text style={styles.muted}>Yükleniyor…</Text>}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ekran Görüntüsü Paylaş</Text>
          <Text style={styles.cardSubtitle}>Paylaşım tamamlanınca 1 coin.</Text>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => {
              Alert.alert("Bilgi", "Ekran görüntüsü paylaşımı ana sayfadaki paylaşım modülünden yapılır.");
              router.push("index");
            }}
          >
            <Text style={styles.linkBtnText}>Ana sayfaya git</Text>
            <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Değerlendirme Yap</Text>
          <Text style={styles.cardSubtitle}>Yakında (10 coin).</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rapor İçin 3 Güncel Fotoğraf Yükle</Text>
          <Text style={styles.cardSubtitle}>Yakında (20 coin).</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Satış Bilgisi Gir</Text>
          <Text style={styles.cardSubtitle}>Dekont onaylanınca 30 coin.</Text>
          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push("sales-report")}>
            <Text style={styles.linkBtnText}>Formu aç</Text>
            <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bildirimler</Text>
          <Text style={styles.cardSubtitle}>Kazanç ve inceleme durumlarını buradan takip et.</Text>
          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push("notifications")}>
            <Text style={styles.linkBtnText}>Bildirimlere git</Text>
            <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>QR Kod</Text>
              <TouchableOpacity onPress={() => setQrVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            {qrUrl ? (
              <Image source={{ uri: qrUrl }} style={styles.qrImg} resizeMode="contain" />
            ) : (
              <Text style={styles.muted}>QR hazırlanıyor…</Text>
            )}
            {referralLink ? <Text style={styles.muted}>{referralLink}</Text> : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e293b" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "#3b82f6",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff", flex: 1, textAlign: "center" },
  headerRight: { width: 36, height: 36 },
  content: { flex: 1, backgroundColor: "#f5f5f5" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  cardIcon: { width: 28, height: 28 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  cardSubtitle: { fontSize: 13, color: "#64748b", fontWeight: "600", marginTop: 4 },
  muted: { marginTop: 10, color: "#64748b", fontSize: 12 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionBtnSecondary: { backgroundColor: "#0f172a" },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: "#fff", fontWeight: "800" },

  linkBtn: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  linkBtnText: { color: "#3b82f6", fontWeight: "800" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 18 },
  modalContent: { backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#1e293b" },
  qrImg: { width: "100%", height: 260, marginTop: 12 },
});

