import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getHowToCategoryPalette } from "./howToCategoryPalette";
import { howToRadii } from "./howToTheme";

type Props = {
  categoryKey: string;
  title: string;
  videoCount?: number;
  isFirst?: boolean;
};

function formatVideoCount(count: number): string {
  if (count === 1) return "1 video";
  return `${count} video`;
}

export function HowToCategoryHeader({ categoryKey, title, videoCount, isFirst = false }: Props) {
  const palette = useMemo(() => getHowToCategoryPalette(categoryKey), [categoryKey]);

  return (
    <View style={[styles.wrap, isFirst && styles.wrapFirst]}>
      <View style={styles.card}>
        <View style={[styles.gradientBase, { backgroundColor: palette.gradientStart }]} />
        <View style={[styles.gradientFade, { backgroundColor: palette.gradientEnd }]} />
        <View style={[styles.gradientGlow, { backgroundColor: palette.gradientGlow }]} />

        <View style={styles.row}>
          <View style={[styles.accentBar, { backgroundColor: palette.accentBar }]} />
          <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]}>
            <Ionicons name="layers-outline" size={16} color={palette.iconColor} />
          </View>
          <Text style={[styles.title, { color: palette.title }]} numberOfLines={2}>
            {title}
          </Text>
          {videoCount != null && videoCount > 0 ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: palette.badgeBg, borderColor: palette.badgeBorder },
              ]}
            >
              <Text style={[styles.badgeText, { color: palette.badgeText }]}>
                {formatVideoCount(videoCount)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: palette.divider }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    marginBottom: 12,
  },
  wrapFirst: {
    marginTop: 2,
  },
  card: {
    borderRadius: howToRadii.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  gradientBase: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientFade: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "62%",
    height: "100%",
  },
  gradientGlow: {
    position: "absolute",
    bottom: -8,
    left: 12,
    width: 72,
    height: 72,
    borderRadius: 36,
    opacity: 0.85,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accentBar: {
    width: 4,
    height: 24,
    borderRadius: 3,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.25,
    lineHeight: 22,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: howToRadii.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.15,
  },
  divider: {
    height: 1,
    marginTop: 10,
    marginHorizontal: 8,
    opacity: 0.75,
  },
});
