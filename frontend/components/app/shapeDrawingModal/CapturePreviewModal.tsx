/**
 * 3D Model Editör – Capture Önizleme Modal
 * Thumbnail tıklandığında büyük görüntü gösterir
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { CaptureItem } from "@/src/utils/captureGallery";
import { shareManyImages } from "@/src/utils/handlers/modelEditorShareHandler";

type Props = {
  visible: boolean;
  item: CaptureItem | null;
  onClose: () => void;
  onDelete: () => void;
};

export const CapturePreviewModal: React.FC<Props> = ({ visible, item, onClose, onDelete }) => {
  if (!visible || !item) return null;

  const handleShare = async () => {
    const res = await shareManyImages([item.fileUri]);
    if (!res.ok && res.error) {
      Alert.alert("Paylaşım Hatası", res.error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.fileUri }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color="#fff" />
              <Text style={styles.actionText}>Paylaş</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
              <Text style={[styles.actionText, { color: "#ef4444" }]}>Sil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="#94a3b8" />
              <Text style={[styles.actionText, { color: "#94a3b8" }]}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  modal: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: "space-between",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    flex: 1,
    maxHeight: SCREEN_HEIGHT - 80,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: "rgba(30, 41, 59, 0.95)",
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
