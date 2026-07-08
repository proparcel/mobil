import React, { useMemo, useRef } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line } from "react-native-svg";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";
import {
  DEFAULT_LANDSCAPE_SUBTITLE_EXPORT_FONT_SIZE,
  landscapeSubtitlePreviewFontSize,
  LANDSCAPE_PREVIEW_REF_WIDTH,
} from "../../src/utils/landscapeOverlayContract";
import { PortraitProParcelBadge } from "../ai-drone-simple/PortraitProParcelBadge";

const LANDSCAPE_SAFE_LINE_TOP_PCT = 8;
const LANDSCAPE_SAFE_LINE_BOTTOM_PCT = 88;

const DEFAULT_LANDSCAPE_SUBTITLE = {
  x: 0.5,
  y: 0.82,
};

type Props = {
  children?: React.ReactNode;
  subtitleText?: string;
  subtitleEnabled?: boolean;
  subtitlePos?: { x: number; y: number };
  onSubtitlePosChange?: (pos: { x: number; y: number }) => void;
  subtitleMode?: "boxed" | "plain";
  subtitleFontSize?: number;
  onLayoutSize?: (size: { width: number; height: number }) => void;
  showProParcelBadge?: boolean;
};

export function LandscapeVideoFrame({
  children,
  subtitleText,
  subtitleEnabled,
  subtitlePos,
  onSubtitlePosChange,
  subtitleMode = "boxed",
  subtitleFontSize = DEFAULT_LANDSCAPE_SUBTITLE_EXPORT_FONT_SIZE,
  onLayoutSize,
  showProParcelBadge = true,
}: Props) {
  const [frameSize, setFrameSize] = React.useState({ width: 0, height: 0 });
  const subtitlePosRef = useRef(subtitlePos);
  subtitlePosRef.current = subtitlePos;
  const panStartRef = useRef({
    x: DEFAULT_LANDSCAPE_SUBTITLE.x,
    y: DEFAULT_LANDSCAPE_SUBTITLE.y,
  });

  const safeBounds = useMemo(() => {
    const minY = LANDSCAPE_SAFE_LINE_TOP_PCT / 100 + 0.02;
    const maxY = LANDSCAPE_SAFE_LINE_BOTTOM_PCT / 100 - 0.05;
    return { minY, maxY };
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFrameSize({ width, height });
    onLayoutSize?.({ width, height });
  };

  const pan = useMemo(() => {
    if (!subtitleEnabled || !onSubtitlePosChange) return null;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panStartRef.current = {
          x: subtitlePosRef.current?.x ?? DEFAULT_LANDSCAPE_SUBTITLE.x,
          y: subtitlePosRef.current?.y ?? DEFAULT_LANDSCAPE_SUBTITLE.y,
        };
      },
      onPanResponderMove: (_, g) => {
        if (!frameSize.width || !frameSize.height) return;
        const start = panStartRef.current;
        const nx = Math.max(0.08, Math.min(0.92, start.x + g.dx / frameSize.width));
        const ny = Math.max(
          safeBounds.minY,
          Math.min(safeBounds.maxY, start.y + g.dy / frameSize.height),
        );
        onSubtitlePosChange({ x: nx, y: ny });
      },
    });
  }, [subtitleEnabled, onSubtitlePosChange, frameSize.width, frameSize.height, safeBounds.minY, safeBounds.maxY]);

  const previewSubtitleFontPx = landscapeSubtitlePreviewFontSize(
    subtitleFontSize,
    frameSize.height || 1,
  );
  const anchorX = (subtitlePos?.x ?? DEFAULT_LANDSCAPE_SUBTITLE.x) * frameSize.width;
  const anchorY = (subtitlePos?.y ?? DEFAULT_LANDSCAPE_SUBTITLE.y) * frameSize.height;
  const isPlainSubtitle = subtitleMode === "plain";
  const subtitlePad = isPlainSubtitle ? 8 : 24;
  const subtitleLineHeight = previewSubtitleFontPx * 1.18;
  const subtitleMaxWidth = frameSize.width * 0.78;
  const subtitleTextClean = String(subtitleText || "").trim();
  const subtitleMaxChars = Math.max(
    18,
    Math.min(52, Math.floor(subtitleMaxWidth / Math.max(1, previewSubtitleFontPx * 0.56))),
  );
  const subtitleLineCount = subtitleTextClean
    ? Math.min(2, Math.max(1, Math.ceil(subtitleTextClean.length / subtitleMaxChars)))
    : 1;
  const subtitleTextWidth = subtitleTextClean.length * previewSubtitleFontPx * 0.56;
  const subtitleBoxWidth = Math.min(
    subtitleMaxWidth,
    Math.max(96, subtitleTextWidth + subtitlePad),
  );
  const subtitleBoxHeight = subtitleLineCount * subtitleLineHeight + subtitlePad;
  const safeTopPx = frameSize.height * (LANDSCAPE_SAFE_LINE_TOP_PCT / 100);
  const safeBottomPx = frameSize.height * (LANDSCAPE_SAFE_LINE_BOTTOM_PCT / 100);
  const subtitleLeft = Math.max(
    4,
    Math.min(frameSize.width - subtitleBoxWidth - 4, anchorX - subtitleBoxWidth / 2),
  );
  const subtitleTop = Math.max(
    safeTopPx,
    Math.min(safeBottomPx - subtitleBoxHeight, anchorY - subtitleBoxHeight / 2),
  );

  return (
    <View style={styles.outer} onLayout={onLayout}>
      <View style={styles.frame}>
        {children}
        <View style={styles.guideOverlay} pointerEvents="none">
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Line
              x1="0%"
              y1={`${LANDSCAPE_SAFE_LINE_TOP_PCT}%`}
              x2="100%"
              y2={`${LANDSCAPE_SAFE_LINE_TOP_PCT}%`}
              stroke={AI_DRONE_EDITOR_THEME.safeLine}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            <Line
              x1="0%"
              y1={`${LANDSCAPE_SAFE_LINE_BOTTOM_PCT}%`}
              x2="100%"
              y2={`${LANDSCAPE_SAFE_LINE_BOTTOM_PCT}%`}
              stroke={AI_DRONE_EDITOR_THEME.safeLine}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          </Svg>
        </View>
        {showProParcelBadge ? (
          <PortraitProParcelBadge frameWidth={frameSize.width} frameHeight={frameSize.height} />
        ) : null}
        {subtitleEnabled && subtitleText?.trim() ? (
          <View
            style={[
              styles.subtitleWrap,
              isPlainSubtitle && styles.subtitleWrapPlain,
              {
                left: subtitleLeft,
                top: subtitleTop,
                width: subtitleBoxWidth,
                alignItems: "center",
              },
            ]}
            {...(pan ? pan.panHandlers : {})}
          >
            <Text
              style={[
                styles.subtitleText,
                isPlainSubtitle && styles.subtitleTextPlain,
                {
                  fontSize: previewSubtitleFontPx,
                  lineHeight: Math.round(previewSubtitleFontPx * 1.33),
                  width: "100%",
                },
              ]}
              numberOfLines={2}
            >
              {subtitleText.trim()}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  frame: {
    width: "100%",
    maxWidth: LANDSCAPE_PREVIEW_REF_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: AI_DRONE_EDITOR_THEME.previewBg,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  subtitleWrap: {
    position: "absolute",
    maxWidth: 280,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.45)",
    alignItems: "center",
  },
  subtitleWrapPlain: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  subtitleText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },
  subtitleTextPlain: {
    textShadowColor: "rgba(2, 6, 23, 0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});

export const DEFAULT_LANDSCAPE_SUBTITLE_POS = DEFAULT_LANDSCAPE_SUBTITLE;
