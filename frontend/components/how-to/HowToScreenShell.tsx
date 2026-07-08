import React, { useState } from "react";
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../src/hooks/useNavigation";
import { HowToViewMenuModal } from "./HowToViewMenuModal";
import { howToColors } from "./howToTheme";

export type HowToViewMode = "grid" | "list";

type Props = {
  title: string;
  viewMode: HowToViewMode;
  onViewModeChange: (mode: HowToViewMode) => void;
  showViewMenu?: boolean;
  children: React.ReactNode;
};

export function HowToScreenShell({
  title,
  viewMode,
  onViewModeChange,
  showViewMenu = true,
  children,
}: Props) {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={howToColors.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Kısa eğitim videoları
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Görünüm menüsü"
          disabled={!showViewMenu}
        >
          {showViewMenu ? (
            <Ionicons name="grid-outline" size={20} color="#fff" />
          ) : (
            <View style={styles.headerBtnSpacer} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.body}>{children}</View>

      {showViewMenu ? (
        <HowToViewMenuModal
          visible={menuVisible}
          viewMode={viewMode}
          onClose={() => setMenuVisible(false)}
          onViewModeChange={onViewModeChange}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: howToColors.headerBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: howToColors.headerBg,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 3,
    borderBottomColor: howToColors.accent,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  headerBtnSpacer: {
    width: 22,
    height: 22,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(226, 232, 240, 0.72)",
    letterSpacing: 0.15,
  },
  body: {
    flex: 1,
    backgroundColor: howToColors.pageBg,
  },
});
