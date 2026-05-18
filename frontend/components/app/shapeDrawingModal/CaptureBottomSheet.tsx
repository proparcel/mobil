/**
 * 3D Model Editör – Capture Bottom Sheet
 * Thumbnail galerisi + seçim modu. Sürükle bırak ile açılır/kapatılır.
 * snapPoints: ["10%", "55%", "90%"] - minimize, yarım, tam
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AppBottomSheetModal from "../AppBottomSheetModal";
import type { CaptureItem } from "@/src/utils/captureGallery";

type Props = {
  visible: boolean;
  onClose: () => void;
  items: CaptureItem[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  initialSnapIndex?: number;
  onToggleSelectionMode: () => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onOpenPreview: (id: string) => void;
  /** Seçilen görselleri telefon galerisine kaydet (Tasarımlarım listesine yazılmaz) */
  onSaveSelected: () => void;
  onShareSelected: () => void;
  onDeleteSelected: () => void;
};

const COLS = 4;
const GAP = 8;
const HORIZONTAL_PADDING = 24;

export const CaptureBottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  items,
  selectionMode,
  selectedIds,
  initialSnapIndex = 0,
  onToggleSelectionMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onOpenPreview,
  onSaveSelected,
  onShareSelected,
  onDeleteSelected,
}) => {
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  const thumbSize = useMemo(() => {
    const { width } = Dimensions.get("window");
    return Math.floor((width - HORIZONTAL_PADDING - (COLS - 1) * GAP) / COLS);
  }, []);

  const handleThumbPress = (id: string) => {
    if (selectionMode) {
      onToggleSelect(id);
    } else {
      onOpenPreview(id);
    }
  };

  const handleDelete = () => {
    if (!hasSelection) return;
    Alert.alert(
      "Seçilenleri Sil",
      `${selectedCount} görsel silinecek. Emin misiniz?`,
      [
        { text: "İptal", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: onDeleteSelected },
      ]
    );
  };

  const renderContent = () => (
    <>
      {/* Kontrol bar */}
      <View style={styles.controlBar}>
        <TouchableOpacity style={styles.controlButton} onPress={onToggleSelectionMode}>
          <Ionicons
            name={selectionMode ? "close-circle" : "checkbox-outline"}
            size={18}
            color={selectionMode ? "#94a3b8" : "#3b82f6"}
          />
          <Text style={[styles.controlText, selectionMode && styles.controlTextInactive]}>
            {selectionMode ? "Seçimi Kapat" : "Seç"}
          </Text>
        </TouchableOpacity>

        {selectionMode && (
          <>
            <View style={styles.selectionInfo}>
              <Text style={styles.selectionCount}>Seçim: {selectedCount}</Text>
            </View>
            <TouchableOpacity style={styles.controlButton} onPress={onSelectAll}>
              <Text style={styles.controlText}>Hepsini Seç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={onClearSelection}>
              <Text style={styles.controlText}>Temizle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, !hasSelection && styles.actionButtonDisabled]}
              onPress={() => {
                console.log("[ShapeDrawingModal:CAPTURE] CaptureBottomSheet: Kaydet basıldı, selectedCount=", selectedCount);
                onSaveSelected();
              }}
              disabled={!hasSelection}
            >
              <Ionicons name="save-outline" size={16} color="#fff" />
              <Text style={styles.actionText}>Kaydet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, !hasSelection && styles.actionButtonDisabled]}
              onPress={() => {
                console.log("[ShapeDrawingModal:CAPTURE] CaptureBottomSheet: Paylaş basıldı, selectedCount=", selectedCount);
                onShareSelected();
              }}
              disabled={!hasSelection}
            >
              <Ionicons name="share-outline" size={16} color="#fff" />
              <Text style={styles.actionText}>Paylaş</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton, !hasSelection && styles.actionButtonDisabled]}
              onPress={handleDelete}
              disabled={!hasSelection}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={styles.actionText}>Sil</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Thumbnails - grid (satırlara sarılır) */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={48} color="#64748b" />
          <Text style={styles.emptyStateText}>Henüz resim yok</Text>
        </View>
      ) : (
        <View style={styles.thumbGrid}>
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.thumbWrap,
                  { width: thumbSize, height: thumbSize },
                  isSelected && styles.thumbWrapSelected,
                ]}
                onPress={() => handleThumbPress(item.id)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: item.fileUri }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
                {selectionMode && (
                  <View style={[styles.checkOverlay, isSelected && styles.checkOverlaySelected]}>
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </>
  );

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["10%", "55%", "90%"]}
      initialIndex={Math.min(initialSnapIndex ?? 0, 2)}
      enablePanDownToClose={true}
      backdropPressBehavior="collapse"
      backdropOpacity={0}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "rgba(30, 41, 59, 0.98)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handleIndicator: {
    backgroundColor: "rgba(148, 163, 184, 0.6)",
    width: 42,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
    flexWrap: "wrap",
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  controlText: {
    color: "#3b82f6",
    fontSize: 12,
    fontWeight: "600",
  },
  controlTextInactive: {
    color: "#94a3b8",
  },
  selectionInfo: {
    flex: 1,
  },
  selectionCount: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#3b82f6",
    borderRadius: 6,
  },
  actionButtonDisabled: {
    backgroundColor: "#475569",
    opacity: 0.6,
  },
  deleteButton: {
    backgroundColor: "#ef4444",
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  thumbGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: GAP,
  },
  thumbWrap: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbWrapSelected: {
    borderColor: "#3b82f6",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkOverlaySelected: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptyStateText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 8,
  },
});
