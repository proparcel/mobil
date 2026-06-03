import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from "react-native-svg";
import {
  MAP_ARROW_STYLES,
  type MapArrowVariant,
  getMapArrowStyleDef,
} from "@/src/maps/drawing/mapArrowStyles";

type PreviewProps = {
  variant: MapArrowVariant;
  width?: number;
  height?: number;
};

/** Referans SVG'lere uygun mini ok önizlemesi. */
export function ArrowStylePreview({ variant, width = 54, height = 22 }: PreviewProps) {
  const def = getMapArrowStyleDef(variant);
  const gid = `arrow-prev-${variant}`;

  const shaftPath =
    variant === "sharp"
      ? "M2 14 L 28 14 L 28 6 L 46 6"
      : variant === "curvy"
        ? "M2 16 C 12 -2, 24 24, 46 8"
        : variant === "arc"
          ? "M2 15 Q 24 4, 46 10"
          : "M2 11 L 46 11";

  const headPoints =
    variant === "sharp"
      ? "42,0 52,6 42,12"
      : variant === "curvy"
        ? "40,2 52,8 40,14"
        : variant === "arc"
          ? "40,4 52,10 40,14"
          : "40,4 52,11 40,18";

  return (
    <Svg width={width} height={height} viewBox="0 0 54 22">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={def.previewLight} />
          <Stop offset="100%" stopColor={def.previewDark} />
        </LinearGradient>
      </Defs>
      <Path
        d={shaftPath}
        stroke={`url(#${gid})`}
        strokeWidth={4.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.95}
      />
      <Polygon
        points={headPoints}
        fill={`url(#${gid})`}
        stroke={def.previewBorder}
        strokeWidth={1}
      />
    </Svg>
  );
}

type Props = {
  selected: MapArrowVariant;
  onSelect: (variant: MapArrowVariant) => void;
  accentColor?: string;
  compact?: boolean;
};

export function ArrowStylePicker({
  selected,
  onSelect,
  accentColor = "#3b82f6",
  compact = false,
}: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact ? <Text style={styles.label}>Ok stili</Text> : null}
      <View style={styles.row}>
        {MAP_ARROW_STYLES.map((style) => {
          const active = selected === style.id;
          return (
            <TouchableOpacity
              key={style.id}
              style={[
                styles.option,
                active && { borderColor: accentColor, backgroundColor: "rgba(59,130,246,0.18)" },
              ]}
              onPress={() => onSelect(style.id)}
              accessibilityLabel={style.label}
              accessibilityState={{ selected: active }}
              activeOpacity={0.85}
            >
              <ArrowStylePreview variant={style.id} width={compact ? 48 : 54} height={compact ? 20 : 22} />
              {!compact ? (
                <Text style={[styles.optionLabel, active && { color: accentColor }]} numberOfLines={1}>
                  {style.label}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  wrapCompact: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "rgba(15,23,42,0.55)",
    gap: 4,
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
  },
});
