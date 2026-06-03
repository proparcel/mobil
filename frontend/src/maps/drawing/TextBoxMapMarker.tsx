import React, { useMemo } from "react";
import { Platform, Text, View } from "react-native";
import type { ShapeProperties } from "./types";
import { toOpaqueColor } from "./mapPinStyles";
import {
  computeTextBoxLayout,
  TEXTBOX_PADDING,
  textBoxEffectiveTextSize,
} from "./textBoxLayout";

function hexToRgba(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const h = (hex || "").replace("#", "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return `rgba(15,23,42,${a})`;
}

type Props = {
  shape: ShapeProperties;
  selected?: boolean;
};

/**
 * Ekran overlay metin kutusu — iğne ile aynı katmanlı 3D görünüm (gölge + beyaz halo + renk).
 */
export function TextBoxMapMarker({ shape, selected = false }: Props) {
  const text = String(shape.text ?? "");
  const baseTextSize = typeof shape.textSize === "number" ? shape.textSize : 14;
  const shapeSizePercent =
    typeof shape.shapeSizePercent === "number" ? shape.shapeSizePercent : 100;
  const textColor =
    typeof shape.textColor === "string" && shape.textColor.length > 0
      ? shape.textColor
      : "#ffffff";
  const textAlign = shape.textAlign === "left" ? "left" : "center";
  const boxFillEnabled = shape.boxFillEnabled !== false;
  const rotationDeg = typeof shape.rotation === "number" ? shape.rotation : 0;

  const layout = useMemo(
    () =>
      computeTextBoxLayout(text, baseTextSize, {
        boxFillEnabled,
        shapeSizePercent,
      }),
    [text, baseTextSize, boxFillEnabled, shapeSizePercent]
  );

  const effectiveTextSize = layout.effectiveTextSize;
  const widthPx = layout.widthPx;
  const heightPx = layout.heightPx;

  const bgOpacity = typeof shape.fillOpacity === "number" ? shape.fillOpacity : 0.85;
  const bgHex = toOpaqueColor(
    selected ? "#f87171" : shape.fillColor,
    selected ? "#f87171" : "#0f172a"
  );
  const borderHex = toOpaqueColor(
    selected ? "#ef4444" : shape.outlineColor,
    selected ? "#ef4444" : "#2563eb"
  );
  const borderW = boxFillEnabled ? Math.max(1, Number(shape.outlineWidth ?? 2)) : 0;
  const radiusPx = Math.max(
    2,
    Math.min(12, typeof shape.boxCornerRadiusPx === "number" ? shape.boxCornerRadiusPx : 6)
  );

  const shadowEnabled = boxFillEnabled && shape.shadowEnabled !== false;
  const shadowColor = String(shape.shadowColor || "#000000");
  const shadowOpacity = typeof shape.shadowOpacity === "number" ? shape.shadowOpacity : 0.35;
  const elevation = shadowEnabled ? 8 : 0;
  const backgroundColor = boxFillEnabled ? hexToRgba(bgHex, bgOpacity) : "transparent";
  const haloW = borderW + 2;

  const boxStyle = {
    width: widthPx,
    minHeight: heightPx,
    paddingHorizontal: boxFillEnabled ? TEXTBOX_PADDING : 0,
    paddingVertical: boxFillEnabled ? TEXTBOX_PADDING : 0,
    borderRadius: boxFillEnabled ? radiusPx : 0,
    transform: rotationDeg ? [{ rotate: `${rotationDeg}deg` }] : undefined,
    overflow: "visible" as const,
    alignSelf: "center" as const,
  };

  return (
    <View collapsable={false} pointerEvents="none">
      <View collapsable={false} style={{ alignItems: "center", justifyContent: "center" }}>
        {boxFillEnabled && shadowEnabled ? (
          <View
            style={{
              position: "absolute",
              top: 3,
              left: 2,
              width: widthPx,
              minHeight: heightPx,
              borderRadius: radiusPx,
              backgroundColor: hexToRgba(shadowColor, shadowOpacity),
            }}
          />
        ) : null}

        {boxFillEnabled ? (
          <View
            style={{
              position: "absolute",
              top: -1,
              left: -1,
              width: widthPx + 2,
              minHeight: heightPx + 2,
              borderRadius: radiusPx + 1,
              borderWidth: 2,
              borderColor: "#ffffff",
            }}
          />
        ) : null}

        <View
          collapsable={false}
          style={{
            ...boxStyle,
            backgroundColor,
            borderColor: boxFillEnabled ? borderHex : "transparent",
            borderWidth: borderW,
            ...(shadowEnabled
              ? Platform.select({
                  ios: {
                    shadowColor,
                    shadowOpacity,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                  },
                  android: { elevation },
                  default: {},
                })
              : {}),
          }}
        >
          {layout.lines.map((line, idx) => (
            <Text
              key={`line-${idx}-${line.length}`}
              style={{
                color: textColor,
                fontSize: effectiveTextSize,
                lineHeight: layout.lineHeightPx,
                textAlign,
                includeFontPadding: false,
              }}
            >
              {line.length > 0 ? line : "\u00A0"}
            </Text>
          ))}
        </View>

        {boxFillEnabled && borderW > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -haloW / 2,
              left: -haloW / 2,
              width: widthPx + haloW,
              minHeight: heightPx + haloW,
              borderRadius: radiusPx + haloW / 2,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.55)",
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

export { textBoxEffectiveTextSize };
