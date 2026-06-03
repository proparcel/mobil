import React from "react";
import { View } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { ShapeProperties } from "./types";
import {
  getMapPinStyleDef,
  getPinDisplaySize,
  normalizeMapPinVariant,
  toOpaqueColor,
} from "./mapPinStyles";

type Props = {
  shape: ShapeProperties;
  selected?: boolean;
};

/**
 * Opak iğne — outline ikonların iç boşluğu katmanlarla doldurulur (harita görünmez).
 */
export function MapPinMarker({ shape, selected = false }: Props) {
  const def = getMapPinStyleDef(normalizeMapPinVariant(shape.pinVariant));
  const fillColor = toOpaqueColor(
    selected ? "#f87171" : shape.fillColor,
    selected ? "#f87171" : "#3b82f6"
  );
  const outlineColor = toOpaqueColor(
    selected ? "#ef4444" : shape.outlineColor,
    selected ? "#ef4444" : "#ffffff"
  );
  const { width, height, iconSize } = getPinDisplaySize(shape.shapeSizePercent, selected);
  const strokeSize = iconSize + 4;
  const innerSize = Math.max(8, iconSize - 2);

  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "flex-end",
        opacity: 1,
      }}
    >
      <View style={{ width: strokeSize, height: strokeSize, alignItems: "center", justifyContent: "flex-end" }}>
        <MaterialCommunityIcons
          name={def.previewIcon}
          size={strokeSize}
          color={outlineColor}
          style={{ position: "absolute", bottom: 0 }}
        />
        <MaterialCommunityIcons
          name={def.previewIcon}
          size={iconSize}
          color="#ffffff"
          style={{ position: "absolute", bottom: 1 }}
        />
        <MaterialCommunityIcons
          name={def.previewIcon}
          size={innerSize}
          color={fillColor}
          style={{ position: "absolute", bottom: 2 }}
        />
      </View>
    </View>
  );
}
