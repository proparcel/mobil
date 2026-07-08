import React, { useMemo } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { HowToVideoItem } from "../../services/howToVideoService";
import {
  groupHowToVideosByCategory,
  groupVideosIntoGridRows,
  type HowToGridRowItem,
} from "../../utils/howToVideoGrouping";
import { HowToCategoryHeader } from "./HowToCategoryHeader";
import { howToColors, howToRadii, howToScrollBottomPadding, howToShadow } from "./howToTheme";

type Props = {
  videos: HowToVideoItem[];
  onPressVideo: (video: HowToVideoItem) => void;
};

const NUM_COLUMNS = 3;
const GAP = 10;

export function HowToVideoGrid({ videos, onPressVideo }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalPadding = 16;
  const itemWidth = (width - horizontalPadding * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
  const thumbHeight = Math.round((itemWidth * 16) / 9);

  const rows = useMemo(
    () => groupVideosIntoGridRows(groupHowToVideosByCategory(videos), NUM_COLUMNS),
    [videos],
  );

  const renderRow = (item: HowToGridRowItem, index: number) => {
    if (item.type === "header") {
      const isFirst = index === 0;
      return (
        <HowToCategoryHeader
          categoryKey={item.categoryKey}
          title={item.title}
          videoCount={item.videoCount}
          isFirst={isFirst}
        />
      );
    }

    return (
      <View style={styles.row}>
        {item.videos.map((video) => (
          <Pressable
            key={video.id}
            style={[styles.item, { width: itemWidth }]}
            onPress={() => onPressVideo(video)}
            accessibilityRole="button"
            accessibilityLabel={video.title}
          >
            <View style={[styles.thumbWrap, { height: thumbHeight }, howToShadow.thumb]}>
              <Image source={{ uri: video.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
              <View style={styles.playBadge} pointerEvents="none">
                <View style={styles.playBtn}>
                  <Ionicons name="play" size={14} color="#fff" style={styles.playIcon} />
                </View>
              </View>
            </View>
            <Text style={styles.title} numberOfLines={3}>
              {video.title}
            </Text>
          </Pressable>
        ))}
        {item.videos.length < NUM_COLUMNS
          ? Array.from({ length: NUM_COLUMNS - item.videos.length }).map((_, i) => (
              <View key={`spacer-${item.key}-${i}`} style={{ width: itemWidth }} />
            ))
          : null}
      </View>
    );
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.key}
      contentContainerStyle={[
        styles.list,
        {
          paddingHorizontal: horizontalPadding,
          paddingBottom: howToScrollBottomPadding(insets.bottom),
        },
      ]}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => renderRow(item, index)}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 12,
    gap: GAP,
  },
  row: {
    flexDirection: "row",
    gap: GAP,
    marginBottom: 2,
  },
  item: {
    gap: 8,
  },
  thumbWrap: {
    borderRadius: howToRadii.thumb,
    overflow: "hidden",
    backgroundColor: howToColors.thumbBg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  playBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(59, 130, 246, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  playIcon: {
    marginLeft: 2,
  },
  title: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: howToColors.textPrimary,
    letterSpacing: -0.1,
  },
});
