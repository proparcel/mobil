import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type Props = {
  visible: boolean;
  onWatch: () => void;
  onDismiss: () => void;
};

const TOPICS = [
  { icon: "map-outline" as const, label: "Harita ve parsel sorgulama" },
  { icon: "flash-outline" as const, label: "Pro Sorgu adımları" },
  { icon: "bar-chart-outline" as const, label: "Analiz ve raporlar" },
] as const;

export function HowToIntroModal({ visible, onWatch, onDismiss }: Props) {
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
            <View style={styles.playRing}>
              <View style={styles.playCircle}>
                <Ionicons name="play-circle" size={52} color="#3b82f6" />
              </View>
            </View>
            <Text style={styles.badge}>Kısa eğitim videoları</Text>
          </View>

          <Text style={styles.title}>ProjeOlustur</Text>
          <Text style={styles.subtitle}>
            ProParcel&apos;ı birkaç dakikada keşfedin. Adım adım videolarla harita, sorgu ve analiz
            araçlarını öğrenin.
          </Text>

          <View style={styles.topicList}>
            {TOPICS.map((topic) => (
              <View key={topic.label} style={styles.topicRow}>
                <View style={styles.topicIconWrap}>
                  <Ionicons name={topic.icon} size={16} color="#60a5fa" />
                </View>
                <Text style={styles.topicLabel}>{topic.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.previewRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.previewTile}>
                <View style={styles.previewThumb}>
                  <Ionicons name="play" size={14} color="#fff" />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Şimdi değil"
            >
              <Text style={styles.secondaryButtonText}>Şimdi değil</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={onWatch}
              accessibilityRole="button"
              accessibilityLabel="Videoları izle"
            >
              <Ionicons name="play-outline" size={18} color="#fff" style={styles.primaryIcon} />
              <Text style={styles.primaryButtonText}>Videoları İzle</Text>
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
  playRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "rgba(59, 130, 246, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    marginBottom: 10,
  },
  playCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#93c5fd",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 18,
  },
  topicList: {
    gap: 8,
    marginBottom: 16,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  topicIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  topicLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#e2e8f0",
  },
  previewRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  previewTile: {
    flex: 1,
    aspectRatio: 16 / 10,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(59, 130, 246, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
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
