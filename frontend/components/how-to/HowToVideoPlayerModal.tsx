import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HowToYoutubePlayer } from "./HowToYoutubePlayer";
import type { HowToVideoItem } from "../../services/howToVideoService";

type Props = {
  visible: boolean;
  video: HowToVideoItem | null;
  onClose: () => void;
};

export function HowToVideoPlayerModal({ visible, video, onClose }: Props) {
  const { width } = useWindowDimensions();
  const playerWidth = Math.min(width - 32, 720);
  const playerHeight = Math.round((playerWidth * 9) / 16);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (visible && video?.youtube_video_id) {
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  }, [visible, video?.youtube_video_id]);

  if (!video) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
        />
        <View style={styles.panel}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={[styles.playerWrap, { width: playerWidth, height: playerHeight }]}>
            <HowToYoutubePlayer
              height={playerHeight}
              width={playerWidth}
              play={playing}
              videoId={video.youtube_video_id}
              onChangeState={(state: string) => {
                if (state === "playing") setPlaying(true);
                if (state === "paused" || state === "ended") setPlaying(false);
              }}
              webViewStyle={styles.webView}
            />
          </View>
          <Text style={styles.title}>{video.title}</Text>
          {video.description ? <Text style={styles.description}>{video.description}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 760,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    zIndex: 1,
  },
  closeBtn: {
    alignSelf: "flex-end",
    padding: 4,
    marginBottom: 8,
  },
  playerWrap: {
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
  },
  webView: {
    opacity: 0.99,
  },
  title: {
    marginTop: 14,
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
