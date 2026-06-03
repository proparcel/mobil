/**
 * 3D Model Editör – Capture Önizleme Modal
 * Thumbnail tıklandığında büyük görüntü; yatay kaydırma ile diğer görseller
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { CaptureItem } from "@/src/utils/captureGallery";
import { shareManyImages } from "@/src/utils/handlers/modelEditorShareHandler";

type Props = {
  visible: boolean;
  items: CaptureItem[];
  activeId: string | null;
  onActiveIdChange: (id: string) => void;
  onClose: () => void;
  onDelete: () => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const CapturePreviewModal: React.FC<Props> = ({
  visible,
  items,
  activeId,
  onActiveIdChange,
  onClose,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<CaptureItem>>(null);

  const activeIndex = useMemo(() => {
    if (!activeId) return 0;
    const idx = items.findIndex((x) => x.id === activeId);
    return idx >= 0 ? idx : 0;
  }, [items, activeId]);

  const activeItem = items[activeIndex] ?? null;

  useEffect(() => {
    if (!visible || items.length === 0) return;
    const idx = activeId ? items.findIndex((x) => x.id === activeId) : 0;
    if (idx < 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: idx, animated: false });
    });
  }, [visible, activeId, items]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      const next = items[idx];
      if (next && next.id !== activeId) {
        onActiveIdChange(next.id);
      }
    },
    [items, activeId, onActiveIdChange],
  );

  const handleShare = useCallback(async () => {
    if (!activeItem) return;
    const uri = activeItem.fileUri;
    onClose();
    await new Promise((r) => setTimeout(r, 320));
    const res = await shareManyImages([uri]);
    if (!res.ok && res.error) {
      Alert.alert("Paylaşım Hatası", res.error);
    }
  }, [activeItem, onClose]);

  const getItemLayout = useCallback(
    (_: CaptureItem[] | null | undefined, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  if (!visible || items.length === 0 || !activeItem) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) + 4 }]}>
          <Text style={styles.counter}>
            {activeIndex + 1} / {items.length}
          </Text>
          <TouchableOpacity
            style={styles.closeTopBtn}
            onPress={onClose}
            accessibilityLabel="Önizlemeyi kapat"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#f8fafc" />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={items}
          horizontal
          pagingEnabled
          bounces={items.length > 1}
          showsHorizontalScrollIndicator={false}
          style={styles.list}
          keyExtractor={(item) => item.id}
          initialScrollIndex={activeIndex}
          getItemLayout={getItemLayout}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index, animated: false });
            }, 80);
          }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image source={{ uri: item.fileUri }} style={styles.image} resizeMode="contain" />
            </View>
          )}
        />

        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={22} color="#fff" />
            <Text style={styles.actionText}>Paylaş</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
            <Ionicons name="trash-outline" size={22} color="#ef4444" />
            <Text style={[styles.actionText, { color: "#ef4444" }]}>Sil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onClose}>
            <Ionicons name="chevron-down" size={22} color="#94a3b8" />
            <Text style={[styles.actionText, { color: "#94a3b8" }]}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 44,
  },
  counter: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "600",
  },
  closeTopBtn: {
    position: "absolute",
    right: 16,
    bottom: 8,
    padding: 4,
  },
  list: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 160,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: "rgba(30, 41, 59, 0.95)",
    zIndex: 20,
    elevation: 20,
  },
  actionButton: {
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
