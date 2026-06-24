import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PORTRAIT_SAFE_LINE_TOP_PCT } from "../../src/constants/aiDroneEditorTheme";

/** Önceki pill boyutunun %60'ı (yaklaşık %40 küçültme). */
const BADGE_SIZE_SCALE = 0.6;

/** Web portrait ProParcel pill — güvenli alan üst çizgisinin altında, okunaklı boyut. */
type Props = {
  frameWidth: number;
  frameHeight: number;
};

export function PortraitProParcelBadge({ frameWidth, frameHeight }: Props) {
  if (frameWidth <= 0 || frameHeight <= 0) return null;

  const safeTopPx = frameHeight * (PORTRAIT_SAFE_LINE_TOP_PCT / 100);
  const pillX = Math.max(12, frameWidth * 0.045);
  const pillY = safeTopPx + Math.max(10, frameHeight * 0.022);
  const pillH = Math.max(22, Math.round(frameWidth * 0.105 * BADGE_SIZE_SCALE));
  const pillW = Math.max(74, Math.round(frameWidth * 0.36 * BADGE_SIZE_SCALE));
  const pillRadius = Math.round(pillH * 0.36);
  const fontSize = Math.max(10, Math.round(pillH * 0.48));
  const padH = Math.max(6, Math.round(pillW * 0.1));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          left: pillX,
          top: pillY,
          minWidth: pillW,
          height: pillH,
          paddingHorizontal: padH,
          borderRadius: pillRadius,
        },
      ]}
    >
      <Text
        style={[styles.label, { fontSize, lineHeight: fontSize * 1.15 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        ProParcel
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    opacity: 0.96,
    zIndex: 4,
  },
  label: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    includeFontPadding: false,
  },
});
