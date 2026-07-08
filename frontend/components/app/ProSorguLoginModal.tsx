import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onLogin: () => void;
};

export function ProSorguLoginModal({ visible, onDismiss, onLogin }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.accentBar} />

          <View style={styles.hero}>
            <View style={styles.iconRing}>
              <Ionicons name="flash" size={40} color="#3b82f6" />
            </View>
          </View>

          <Text style={styles.title}>Pro Sorgu İçin Giriş Yapın</Text>
          <Text style={styles.subtitle}>
            Detaylı mahalle analizi, fiyat tahmini ve raporlar için hesabınıza giriş yapın veya
            ücretsiz kayıt olun.
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <Text style={styles.secondaryButtonText}>Kapat</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={onLogin}
              accessibilityRole="button"
              accessibilityLabel="Giriş yap"
            >
              <Ionicons name="log-in-outline" size={18} color="#fff" style={styles.primaryIcon} />
              <Text style={styles.primaryButtonText}>Giriş Yap</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#111827",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.28)",
    overflow: "hidden",
  },
  accentBar: {
    height: 4,
    marginHorizontal: -22,
    marginBottom: 18,
    backgroundColor: "#3b82f6",
  },
  hero: {
    alignItems: "center",
    marginBottom: 14,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "rgba(59, 130, 246, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  secondaryButton: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  secondaryButtonText: {
    color: "#cbd5e1",
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#2563eb",
  },
  primaryIcon: {
    marginRight: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
