/**
 * AI Drone / AI Video ekranlarında ortak üst bar (ai-drone-video-info ile aynı).
 */
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export const MOBILE_AI_HEADER_COLORS = {
  statusBar: "#1e293b",
  bar: "#0f172a",
  border: "#3b82f6",
  title: "#ffffff",
  icon: "#f8fafc",
} as const;

type Props = {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  backAccessibilityLabel?: string;
};

export function MobileAiScreenHeader({
  title,
  onBack,
  right,
  backAccessibilityLabel = "Geri",
}: Props) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.headerBtn}
        accessibilityLabel={backAccessibilityLabel}
      >
        <Ionicons name="arrow-back" size={18} color={MOBILE_AI_HEADER_COLORS.icon} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {right ?? <View style={styles.headerBtn} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MOBILE_AI_HEADER_COLORS.bar,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: MOBILE_AI_HEADER_COLORS.border,
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
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: MOBILE_AI_HEADER_COLORS.title,
    marginHorizontal: 8,
  },
});
