import React, { useMemo, useRef } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line } from "react-native-svg";
import {
  AI_DRONE_EDITOR_THEME,
  DEFAULT_PORTRAIT_SUBTITLE,
  DEFAULT_PORTRAIT_USER_CARD_POS,
  PORTRAIT_SAFE_LINE_BOTTOM_PCT,
  PORTRAIT_SAFE_LINE_TOP_PCT,
} from "../../src/constants/aiDroneEditorTheme";
import {
  DEFAULT_USER_CARD_SCALE,
  portraitUserCardPreviewScale,
  portraitSubtitlePreviewFontSize,
  USER_CARD_AVATAR_OFFSET_X,
} from "../../src/utils/portraitOverlayContract";
import { PortraitUserInfoCard } from "./PortraitUserInfoCard";
import { PortraitProParcelBadge } from "./PortraitProParcelBadge";
import type { UserCardInfo } from "../../services/aiDroneSimpleEditorService";

type Props = {
  children?: React.ReactNode;
  subtitleText?: string;
  subtitleEnabled?: boolean;
  subtitlePos?: { x: number; y: number };
  onSubtitlePosChange?: (pos: { x: number; y: number }) => void;
  subtitleMode?: "boxed" | "plain";
  subtitleFontSize?: number;
  userCardScale?: number;
  onLayoutSize?: (size: { width: number; height: number }) => void;
  userCardEnabled?: boolean;
  userCardData?: UserCardInfo | null;
  userCardPos?: { x: number; y: number };
  onUserCardPosChange?: (pos: { x: number; y: number }) => void;
  showProParcelBadge?: boolean;
};

export function PortraitVideoFrame({
  children,
  subtitleText,
  subtitleEnabled,
  subtitlePos,
  onSubtitlePosChange,
  subtitleMode = "boxed",
  subtitleFontSize = DEFAULT_PORTRAIT_SUBTITLE.fontSize,
  userCardScale = DEFAULT_USER_CARD_SCALE,
  onLayoutSize,
  userCardEnabled,
  userCardData,
  userCardPos,
  onUserCardPosChange,
  showProParcelBadge = true,
}: Props) {
  const [frameSize, setFrameSize] = React.useState({ width: 0, height: 0 });
  const subtitlePosRef = useRef(subtitlePos);
  subtitlePosRef.current = subtitlePos;
  const panStartRef = useRef({
    x: DEFAULT_PORTRAIT_SUBTITLE.x,
    y: DEFAULT_PORTRAIT_SUBTITLE.y,
  });

  const safeBounds = useMemo(() => {
    const minY = PORTRAIT_SAFE_LINE_TOP_PCT / 100 + 0.02;
    const maxY = PORTRAIT_SAFE_LINE_BOTTOM_PCT / 100 - 0.05;
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
          x: subtitlePosRef.current?.x ?? DEFAULT_PORTRAIT_SUBTITLE.x,
          y: subtitlePosRef.current?.y ?? DEFAULT_PORTRAIT_SUBTITLE.y,
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

  const userCardPan = useMemo(() => {
    if (!userCardEnabled || !onUserCardPosChange) return null;
    let start = {
      x: userCardPos?.x ?? DEFAULT_PORTRAIT_USER_CARD_POS.x,
      y: userCardPos?.y ?? DEFAULT_PORTRAIT_USER_CARD_POS.y,
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start = {
          x: userCardPos?.x ?? DEFAULT_PORTRAIT_USER_CARD_POS.x,
          y: userCardPos?.y ?? DEFAULT_PORTRAIT_USER_CARD_POS.y,
        };
      },
      onPanResponderMove: (_, g) => {
        if (!frameSize.width || !frameSize.height) return;
        const nx = Math.max(0.1, Math.min(0.55, start.x + g.dx / frameSize.width));
        const ny = Math.max(0.55, Math.min(0.95, start.y + g.dy / frameSize.height));
        onUserCardPosChange({ x: nx, y: ny });
      },
    });
  }, [userCardEnabled, onUserCardPosChange, userCardPos, frameSize.width, frameSize.height]);

  const cardPreviewScale = portraitUserCardPreviewScale(frameSize.width, userCardScale);
  const cardAnchorX = USER_CARD_AVATAR_OFFSET_X * cardPreviewScale;
  const cardHeight = Math.round(76 * cardPreviewScale);
  const previewSubtitleFontPx = portraitSubtitlePreviewFontSize(
    subtitleFontSize,
    frameSize.height || 1,
  );
  const anchorX = (subtitlePos?.x ?? DEFAULT_PORTRAIT_SUBTITLE.x) * frameSize.width;
  const anchorY = (subtitlePos?.y ?? DEFAULT_PORTRAIT_SUBTITLE.y) * frameSize.height;
  const isPlainSubtitle = subtitleMode === "plain";
  const subtitlePad = isPlainSubtitle ? 8 : 24;
  const subtitleLineHeight = previewSubtitleFontPx * 1.18;
  const subtitleMaxWidth = frameSize.width * 0.78;
  const subtitleTextClean = String(subtitleText || "").trim();
  const subtitleMaxChars = Math.max(
    18,
    Math.min(42, Math.floor(subtitleMaxWidth / Math.max(1, previewSubtitleFontPx * 0.56))),
  );
  const subtitleLineCount = subtitleTextClean
    ? Math.min(3, Math.max(1, Math.ceil(subtitleTextClean.length / subtitleMaxChars)))
    : 1;
  const subtitleTextWidth = subtitleTextClean.length * previewSubtitleFontPx * 0.56;
  const subtitleBoxWidth = Math.min(
    subtitleMaxWidth,
    Math.max(96, subtitleTextWidth + subtitlePad),
  );
  const subtitleBoxHeight = subtitleLineCount * subtitleLineHeight + subtitlePad;
  const safeTopPx = frameSize.height * (PORTRAIT_SAFE_LINE_TOP_PCT / 100);
  const safeBottomPx = frameSize.height * (PORTRAIT_SAFE_LINE_BOTTOM_PCT / 100);
  const subtitleLeft = Math.max(
    4,
    Math.min(frameSize.width - subtitleBoxWidth - 4, anchorX - subtitleBoxWidth / 2),
  );
  const subtitleTop = Math.max(
    safeTopPx,
    Math.min(safeBottomPx - subtitleBoxHeight, anchorY - subtitleBoxHeight / 2),
  );
  const avatarCenterX = (userCardPos?.x ?? DEFAULT_PORTRAIT_USER_CARD_POS.x) * frameSize.width;
  const cardTop =
    (userCardPos?.y ?? DEFAULT_PORTRAIT_USER_CARD_POS.y) * frameSize.height - cardHeight / 2;
  const cardWrapLeft = Math.max(0, avatarCenterX - cardAnchorX);

  return (
    <View style={styles.outer} onLayout={onLayout}>
      <View style={styles.frame}>
        {children}
        <View style={styles.guideOverlay} pointerEvents="none">
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Line
              x1="0%"
              y1={`${PORTRAIT_SAFE_LINE_TOP_PCT}%`}
              x2="100%"
              y2={`${PORTRAIT_SAFE_LINE_TOP_PCT}%`}
              stroke={AI_DRONE_EDITOR_THEME.safeLine}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            <Line
              x1="0%"
              y1={`${PORTRAIT_SAFE_LINE_BOTTOM_PCT}%`}
              x2="100%"
              y2={`${PORTRAIT_SAFE_LINE_BOTTOM_PCT}%`}
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
              numberOfLines={3}
            >
              {subtitleText.trim()}
            </Text>
          </View>
        ) : null}
        {userCardEnabled && userCardData ? (
          <View
            style={[
              styles.userCardWrap,
              {
                left: cardWrapLeft,
                top: Math.max(0, cardTop),
                width: frameSize.width - cardWrapLeft,
              },
            ]}
            {...(userCardPan ? userCardPan.panHandlers : {})}
          >
            <PortraitUserInfoCard
              data={userCardData}
              width={frameSize.width - cardWrapLeft}
              scale={cardPreviewScale}
            />
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
    maxWidth: 351,
    aspectRatio: 9 / 16,
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
  userCardWrap: {
    position: "absolute",
  },
});
