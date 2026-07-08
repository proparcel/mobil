import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HowToLiveTab } from "../../components/how-to/HowToLiveTab";
import { HowToScreenShell, type HowToViewMode } from "../../components/how-to/HowToScreenShell";
import { HowToVideoGrid } from "../../components/how-to/HowToVideoGrid";
import { HowToVideoList } from "../../components/how-to/HowToVideoList";
import { HowToVideoPlayerModal } from "../../components/how-to/HowToVideoPlayerModal";
import { howToColors, howToRadii, howToScrollBottomPadding } from "../../components/how-to/howToTheme";
import { getHowToLiveSession } from "../../services/howToLiveSessionStorage";
import {
  howToVideoService,
  type HowToVideoItem,
} from "../../services/howToVideoService";

type HowToTab = "videos" | "live";

type RouteParams = { tab?: HowToTab; videoId?: string; liveTitle?: string };

export default function NasilYapilirScreen() {
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const bottomPad = howToScrollBottomPadding(insets.bottom);
  const [activeTab, setActiveTab] = useState<HowToTab>(() => {
    const tab = (route.params as RouteParams | undefined)?.tab;
    return tab === "live" ? "live" : "videos";
  });
  const [hasLiveLink, setHasLiveLink] = useState(false);
  const [videos, setVideos] = useState<HowToVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeVideo, setActiveVideo] = useState<HowToVideoItem | null>(null);
  const [viewMode, setViewMode] = useState<HowToViewMode>("grid");

  useFocusEffect(
    useCallback(() => {
      const tab = (route.params as RouteParams | undefined)?.tab;
      if (tab === "live") setActiveTab("live");
    }, [route.params]),
  );

  useEffect(() => {
    const tab = (route.params as RouteParams | undefined)?.tab;
    if (tab === "live") setActiveTab("live");
  }, [route.params]);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await howToVideoService.listVideos();
      setVideos(items);
    } catch {
      setError("Videolar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    const params = route.params as RouteParams | undefined;
    if (params?.videoId?.trim()) {
      setHasLiveLink(true);
      return;
    }
    void getHowToLiveSession().then((stored) => {
      setHasLiveLink(Boolean(stored?.videoId));
    });
  }, [route.params]);

  return (
    <HowToScreenShell
      title="Nasıl Yapılır"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showViewMenu={activeTab === "videos"}
    >
      <View style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabBtn, activeTab === "videos" && styles.tabBtnActive]}
            onPress={() => setActiveTab("videos")}
          >
            <Ionicons
              name="play-circle-outline"
              size={16}
              color={activeTab === "videos" ? howToColors.accentText : howToColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === "videos" && styles.tabTextActive]}>
              Videolar
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, activeTab === "live" && styles.tabBtnActive]}
            onPress={() => setActiveTab("live")}
          >
            <View style={styles.liveTabLabel}>
              <Ionicons
                name="radio-outline"
                size={16}
                color={activeTab === "live" ? howToColors.accentText : howToColors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === "live" && styles.tabTextActive]}>
                Canlı Yayın
              </Text>
              {hasLiveLink ? <View style={styles.liveDot} /> : null}
            </View>
          </Pressable>
        </View>
      </View>

      {activeTab === "live" ? (
        <HowToLiveTab
          active
          initialVideoId={(route.params as RouteParams | undefined)?.videoId}
          initialTitle={(route.params as RouteParams | undefined)?.liveTitle}
        />
      ) : loading ? (
        <View style={[styles.center, { paddingBottom: bottomPad }]}>
          <ActivityIndicator size="large" color={howToColors.accent} />
          <Text style={styles.centerHint}>Videolar yükleniyor…</Text>
        </View>
      ) : error ? (
        <View style={[styles.center, { paddingBottom: bottomPad }]}>
          <View style={styles.stateIconWrap}>
            <Ionicons name="cloud-offline-outline" size={28} color={howToColors.accentText} />
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadVideos} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : videos.length === 0 ? (
        <View style={[styles.center, { paddingBottom: bottomPad }]}>
          <View style={styles.stateIconWrap}>
            <Ionicons name="videocam-outline" size={28} color={howToColors.accentText} />
          </View>
          <Text style={styles.emptyTitle}>Henüz video yok</Text>
          <Text style={styles.emptyText}>Eğitim videoları eklendiğinde burada görünecek.</Text>
        </View>
      ) : viewMode === "grid" ? (
        <HowToVideoGrid videos={videos} onPressVideo={setActiveVideo} />
      ) : (
        <HowToVideoList videos={videos} onPressVideo={setActiveVideo} />
      )}

      <HowToVideoPlayerModal
        visible={!!activeVideo}
        video={activeVideo}
        onClose={() => setActiveVideo(null)}
      />
    </HowToScreenShell>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    backgroundColor: howToColors.pageBg,
  },
  tabBar: {
    flexDirection: "row",
    padding: 4,
    borderRadius: howToRadii.tab,
    backgroundColor: "#e2e8f0",
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: howToColors.surface,
    shadowColor: howToColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: howToColors.textSecondary,
  },
  tabTextActive: {
    color: howToColors.textPrimary,
    fontWeight: "700",
  },
  liveTabLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: howToColors.live,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  centerHint: {
    marginTop: 8,
    fontSize: 14,
    color: howToColors.textSecondary,
  },
  stateIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: howToColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorText: {
    color: "#b42318",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: howToColors.textPrimary,
    textAlign: "center",
  },
  emptyText: {
    color: howToColors.textSecondary,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 260,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: howToColors.accent,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
