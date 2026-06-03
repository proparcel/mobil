import React, { useMemo } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line } from "react-native-svg";
import {
  AI_DRONE_EDITOR_THEME,
  PORTRAIT_SAFE_LINE_BOTTOM_PCT,
  PORTRAIT_SAFE_LINE_TOP_PCT,
} from "../../src/constants/aiDroneEditorTheme";

type Props = {
  children?: React.ReactNode;
  subtitleText?: string;
  subtitleEnabled?: boolean;
  subtitlePos?: { x: number; y: number };
  onSubtitlePosChange?: (pos: { x: number; y: number }) => void;
  onLayoutSize?: (size: { width: number; height: number }) => void;
};

export function PortraitVideoFrame({
  children,
  subtitleText,
  subtitleEnabled,
  subtitlePos,
  onSubtitlePosChange,
  onLayoutSize,
}: Props) {
  const [frameSize, setFrameSize] = React.useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFrameSize({ width, height });
    onLayoutSize?.({ width, height });
  };

  const pan = useMemo(() => {
    if (!subtitleEnabled || !onSubtitlePosChange) return null;
    let start = { x: subtitlePos?.x ?? 0.5, y: subtitlePos?.y ?? 0.12 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start = { x: subtitlePos?.x ?? 0.5, y: subtitlePos?.y ?? 0.12 };
      },
      onPanResponderMove: (_, g) => {
        if (!frameSize.width || !frameSize.height) return;
        const nx = Math.max(0.08, Math.min(0.92, start.x + g.dx / frameSize.width));
        const ny = Math.max(0.06, Math.min(0.42, start.y + g.dy / frameSize.height));
        onSubtitlePosChange({ x: nx, y: ny });
      },
    });
  }, [subtitleEnabled, onSubtitlePosChange, subtitlePos, frameSize.width, frameSize.height]);

  const subLeft = (subtitlePos?.x ?? 0.5) * frameSize.width;
  const subTop = (subtitlePos?.y ?? 0.12) * frameSize.height;

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
        {subtitleEnabled && subtitleText?.trim() ? (
          <View
            style={[
              styles.subtitleWrap,
              {
                left: Math.max(8, subLeft - 140),
                top: Math.max(8, subTop - 20),
              },
            ]}
            {...(pan ? pan.panHandlers : {})}
          >
            <Text style={styles.subtitleText} numberOfLines={3}>
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
  },
  subtitleText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },
});
