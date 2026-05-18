/**
 * 3D Model Editör – Capture Strip (Thumbnail Galerisi + Seçim Modu)
 */

import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { CaptureItem } from "@/src/utils/captureGallery";

type Props = {
  items: CaptureItem[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  bottomInset: number;
  onToggleSelectionMode: () => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onOpenPreview: (id: string) => void;
  onShareSelected: () => void;
  onDeleteSelected: () => void;
};

const THUMB_SIZE = 64;

export const CaptureStrip: React.FC<Props> = ({
  items,
  selectionMode,
  selectedIds,
  bottomInset,
  onToggleSelectionMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onOpenPreview,
  onShareSelected,
  onDeleteSelected,
}) => {
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

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

  return (
    <View style={[styles.strip, { paddingBottom: Math.max(bottomInset, 8) + 8 }]}>
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
              onPress={onShareSelected}
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

      {/* Thumbnails */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbScroll}
      >
        {items.map((item) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.thumbWrap, isSelected && styles.thumbWrapSelected]}
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
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(30, 41, 59, 0.96)",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    zIndex: 1800,
    elevation: 20,
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
  thumbScroll: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
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
});
