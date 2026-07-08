import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { howToVideoService, type HowToLiveStatus } from "../../services/howToVideoService";
import {
  getDismissedLiveVideoId,
  setDismissedLiveVideoId,
} from "../../services/howToLivePromptStorage";

type Props = {
  enabled: boolean;
  onWatch: (status: HowToLiveStatus) => void;
};

export function HowToLivePromptModal({ enabled, onWatch }: Props) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<HowToLiveStatus | null>(null);

  const checkLive = useCallback(async () => {
    if (!enabled) return;
    try {
      const live = await howToVideoService.getLiveStatus();
      if (!live?.is_live || !live.youtube_video_id) {
        setVisible(false);
        setStatus(null);
        return;
      }
      const dismissed = await getDismissedLiveVideoId();
      if (dismissed === live.youtube_video_id) {
        setVisible(false);
        setStatus(null);
        return;
      }
      setStatus(live);
      setVisible(true);
    } catch {
      setVisible(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      void checkLive();
    }
  }, [enabled, checkLive]);

  const dismiss = useCallback(async () => {
    if (status?.youtube_video_id) {
      await setDismissedLiveVideoId(status.youtube_video_id);
    }
    setVisible(false);
  }, [status]);

  const handleWatch = useCallback(async () => {
    if (!status) return;
    await setDismissedLiveVideoId(status.youtube_video_id);
    setVisible(false);
    onWatch(status);
  }, [status, onWatch]);

  if (!visible || !status) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.thumbnailWrap}>
            {status.thumbnail_url ? (
              <Image source={{ uri: status.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
            )}
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>CANLI</Text>
            </View>
          </View>
          <Text style={styles.title} numberOfLines={3}>
            {status.title || "Canlı yayın"}
          </Text>
          <Text style={styles.subtitle}>ProParcel şu anda canlı yayında.</Text>
          <View style={styles.actions}>
            <Pressable style={styles.secondaryBtn} onPress={dismiss}>
              <Text style={styles.secondaryBtnText}>Kapat</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={handleWatch}>
              <Text style={styles.primaryBtnText}>İzle</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  thumbnailWrap: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#111",
  },
  thumbnailPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  liveBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#e53935",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#333",
    fontWeight: "600",
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#e53935",
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
});
