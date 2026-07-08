import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HowToYoutubePlayer } from "./HowToYoutubePlayer";
import { howToScrollBottomPadding } from "./howToTheme";
import {
  getHowToLiveSession,
  saveHowToLiveSession,
  type HowToLiveSession,
} from "../../services/howToLiveSessionStorage";
import { howToVideoService } from "../../services/howToVideoService";

const LIVE_VIEW_PING_MS = 45_000;

type Props = {
  active: boolean;
  initialVideoId?: string;
  initialTitle?: string;
};

export function HowToLiveTab({ active, initialVideoId, initialTitle }: Props) {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<HowToLiveSession | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [viewerCount, setViewerCount] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      const fromRoute = initialVideoId?.trim();
      if (fromRoute) {
        const next: HowToLiveSession = {
          videoId: fromRoute,
          title: initialTitle?.trim() || undefined,
          youtubeUrl: `https://www.youtube.com/watch?v=${fromRoute}`,
        };
        if (!cancelled) setSession(next);
        void saveHowToLiveSession(next);
      } else {
        const stored = await getHowToLiveSession();
        if (!cancelled) setSession(stored);
      }
      if (!cancelled) setInitialLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, initialTitle, initialVideoId]);

  useEffect(() => {
    if (active && session?.videoId) {
      setPlaying(true);
    } else {
      setPlaying(false);
      if (!active) setViewerCount(null);
    }
  }, [active, session?.videoId]);

  useEffect(() => {
    if (!active || !session?.videoId) return;

    let cancelled = false;
    const sendPing = async () => {
      const count = await howToVideoService.pingLiveView(session.videoId);
      if (!cancelled && count != null) setViewerCount(count);
    };

    void sendPing();
    const timer = setInterval(sendPing, LIVE_VIEW_PING_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, session?.videoId]);

  if (initialLoading) {
    return (
      <View style={[styles.center, { paddingBottom: howToScrollBottomPadding(insets.bottom) }]}>
        <ActivityIndicator size="large" color="#e53935" />
      </View>
    );
  }

  if (!session?.videoId) {
    return (
      <View style={[styles.center, { paddingBottom: howToScrollBottomPadding(insets.bottom) }]}>
        <Text style={styles.emptyTitle}>Canlı yayın bekleniyor</Text>
        <Text style={styles.emptyText}>
          Push bildirimine tıklayın veya gelen link ile bu sekmeye gelin.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: howToScrollBottomPadding(insets.bottom) },
      ]}
    >
      <View style={styles.playerWrap}>
        <HowToYoutubePlayer
          height={220}
          play={playing && active}
          videoId={session.videoId}
          onChangeState={(state) => {
            if (state === "playing") setPlaying(true);
            if (state === "paused" || state === "ended") setPlaying(false);
          }}
        />
      </View>
      <Text style={styles.title}>{session.title || "Canlı yayın"}</Text>
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveLabel}>CANLI</Text>
        {viewerCount != null && (
          <Text style={styles.viewerCount}>
            {viewerCount} izleyici
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  playerWrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e53935",
  },
  liveLabel: {
    color: "#e53935",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  viewerCount: {
    marginLeft: 8,
    color: "#555",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
