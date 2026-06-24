/**
 * AI Drone / AI Video ekranlarında ortak üst bar (ana harita ekranı ile aynı).
 */
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { AppStatusBar, APP_CHROME_NAVY } from "./AppStatusBar";

/** Ana uygulama `index.tsx` header ile uyumlu renkler */
export const MOBILE_AI_HEADER_COLORS = {
  statusBar: APP_CHROME_NAVY,
  bar: APP_CHROME_NAVY,
  border: "#3b82f6",
  title: "#ffffff",
  subtitle: "#94a3b8",
  icon: "#f8fafc",
} as const;

type HeaderProps = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
  backAccessibilityLabel?: string;
};

export function MobileAiScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  backAccessibilityLabel = "Geri",
}: HeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.headerBtn}
        accessibilityLabel={backAccessibilityLabel}
      >
        <Ionicons name="arrow-back" size={18} color={MOBILE_AI_HEADER_COLORS.icon} />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <View style={styles.headerBtn} />}
    </View>
  );
}

type ShellProps = HeaderProps & {
  children: React.ReactNode;
  /** İçerik alanı arka planı (header altı) */
  pageBackgroundColor?: string;
};

/** Status bar + header — üst safe area lacivert; içerik ayrı arka plan */
export function MobileAiScreenShell({
  children,
  pageBackgroundColor = "#f8fafc",
  ...headerProps
}: ShellProps) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AppStatusBar />
      <MobileAiScreenHeader {...headerProps} />
      <View style={[styles.page, { backgroundColor: pageBackgroundColor }]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: MOBILE_AI_HEADER_COLORS.bar,
  },
  page: {
    flex: 1,
  },
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
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: MOBILE_AI_HEADER_COLORS.title,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 12,
    color: MOBILE_AI_HEADER_COLORS.subtitle,
    marginTop: 2,
    textAlign: "center",
  },
});
