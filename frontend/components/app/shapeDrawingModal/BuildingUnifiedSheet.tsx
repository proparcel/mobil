import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { BuildingCreateFormBody, type BuildingCreateFormBodyProps } from "./BuildingCreateSheet";
import { BuildingEditPanel, type BuildingEditPanelProps } from "./BuildingEditPanel";

export type BuildingSheetTab = "create" | "edit";

export type BuildingUnifiedSheetProps = {
  visible: boolean;
  onClose: () => void;
  tab: BuildingSheetTab;
  onTabChange: (t: BuildingSheetTab) => void;
  insetsBottom: number;
  /** Düzenle sekmesinde seçili bina yoksa boş durum */
  hasSelectedBuilding: boolean;
  createForm: Omit<BuildingCreateFormBodyProps, "active">;
  editPanel: BuildingEditPanelProps | null;
};

export const BuildingUnifiedSheet: React.FC<BuildingUnifiedSheetProps> = ({
  visible,
  onClose,
  tab,
  onTabChange,
  insetsBottom,
  hasSelectedBuilding,
  createForm,
  editPanel,
}) => {
  const createActive = tab === "create";

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      variant="dark"
      snapPoints={["75%", "92%"]}
      initialIndex={0}
      enablePanDownToClose
      backdropOpacity={0.45}
      backdropPressBehavior="close"
      backgroundStyle={styles.sheetBackground}
      modalProps={{
        /** extend: klavye açıkken içerik yüksekliği klavyeye göre küçülür; interactive ile çift snap çakışması titremeyi artırabilir. */
        keyboardBehavior: "extend",
        keyboardBlurBehavior: "restore",
        android_keyboardInputMode: "adjustResize",
        enableBlurKeyboardOnGesture: true,
      }}
    >
      <View style={{ flex: 1, paddingBottom: Math.max(12, insetsBottom) }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Bina</Text>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Kapat">
            <Ionicons name="close" size={22} color="#e2e8f0" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "create" && styles.tabBtnActive]}
            onPress={() => onTabChange("create")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "create" }}
          >
            <Text style={[styles.tabBtnText, tab === "create" && styles.tabBtnTextActive]}>Oluştur</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "edit" && styles.tabBtnActive]}
            onPress={() => onTabChange("edit")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "edit" }}
          >
            <Text style={[styles.tabBtnText, tab === "edit" && styles.tabBtnTextActive]}>Düzenle</Text>
          </TouchableOpacity>
        </View>

        {tab === "create" ? (
          <BuildingCreateFormBody {...createForm} active={createActive} />
        ) : (
          <BottomSheetScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + Math.max(0, insetsBottom) }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {!hasSelectedBuilding || !editPanel ? (
              <View style={styles.emptyEdit}>
                <Ionicons name="hand-left-outline" size={40} color="#64748b" />
                <Text style={styles.emptyEditText}>Haritada bir bina seçin veya Oluştur sekmesinden yeni bina ekleyin.</Text>
              </View>
            ) : (
              <BuildingEditPanel {...editPanel} />
            )}
          </BottomSheetScrollView>
        )}
      </View>
    </AppBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "rgba(30, 41, 59, 0.58)",
    borderTopWidth: 4,
    borderTopColor: "rgba(59, 130, 246, 0.55)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#f1f5f9" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#334155",
  },
  tabBtnText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: "#e2e8f0",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 10 },
  emptyEdit: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyEditText: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
});
