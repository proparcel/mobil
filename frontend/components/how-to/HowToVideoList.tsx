import React, { useMemo } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { HowToVideoItem } from "../../services/howToVideoService";
import {
  groupHowToVideosByCategory,
  type HowToVideoSection,
} from "../../utils/howToVideoGrouping";
import { HowToCategoryHeader } from "./HowToCategoryHeader";
import { howToColors, howToRadii, howToScrollBottomPadding, howToShadow } from "./howToTheme";

type Props = {
  videos: HowToVideoItem[];
  onPressVideo: (video: HowToVideoItem) => void;
};

type ListItem =
  | { type: "header"; key: string; categoryKey: string; title: string; videoCount: number; isFirst: boolean }
  | { type: "video"; key: string; video: HowToVideoItem };

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 68;

function flattenSections(sections: HowToVideoSection[]): ListItem[] {
  const items: ListItem[] = [];
  sections.forEach((section, sectionIndex) => {
    items.push({
      type: "header",
      key: `header-${section.key}`,
      categoryKey: section.key,
      title: section.title,
      videoCount: section.videos.length,
      isFirst: sectionIndex === 0,
    });
    for (const video of section.videos) {
      items.push({ type: "video", key: `video-${video.id}`, video });
    }
  });
  return items;
}

export function HowToVideoList({ videos, onPressVideo }: Props) {
  const insets = useSafeAreaInsets();
  const items = useMemo(
    () => flattenSections(groupHowToVideosByCategory(videos)),
    [videos],
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.key}
      contentContainerStyle={[
        styles.list,
        { paddingBottom: howToScrollBottomPadding(insets.bottom) },
      ]}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        if (item.type === "header") {
          return (
            <HowToCategoryHeader
              categoryKey={item.categoryKey}
              title={item.title}
              videoCount={item.videoCount}
              isFirst={item.isFirst}
            />
          );
        }

        const video = item.video;
        return (
          <Pressable
            style={[styles.row, howToShadow.card]}
            onPress={() => onPressVideo(video)}
            accessibilityRole="button"
            accessibilityLabel={video.title}
          >
            <View style={[styles.thumbWrap, howToShadow.thumb]}>
              <Image source={{ uri: video.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
              <View style={styles.playBadge} pointerEvents="none">
                <View style={styles.playBtn}>
                  <Ionicons name="play" size={16} color="#fff" style={styles.playIcon} />
                </View>
              </View>
            </View>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={2}>
                {video.title}
              </Text>
              {video.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {video.description}
                </Text>
              ) : null}
            </View>
            <View style={styles.chevronWrap}>
              <Ionicons name="chevron-forward" size={16} color={howToColors.textMuted} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: howToRadii.card,
    backgroundColor: howToColors.surface,
    borderWidth: 1,
    borderColor: howToColors.border,
  },
  thumbWrap: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: howToRadii.thumb,
    overflow: "hidden",
    backgroundColor: howToColors.thumbBg,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  playBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(59, 130, 246, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  playIcon: {
    marginLeft: 2,
  },
  body: {
    flex: 1,
    gap: 4,
    justifyContent: "center",
    minHeight: THUMB_HEIGHT,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
    color: howToColors.textPrimary,
    letterSpacing: -0.15,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: howToColors.textSecondary,
  },
  chevronWrap: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
