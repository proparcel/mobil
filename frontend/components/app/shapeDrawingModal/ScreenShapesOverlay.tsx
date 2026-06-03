import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import type { ShapeProperties } from "@/src/maps/drawing/types";

type Props = {
  shapes: ShapeProperties[];
  selectedShapeId: string | null;
  onShapePress: (shapeId: string) => void;
  interactionLocked?: boolean;
};

/**
 * screenSpace şekilleri (normalize [0–1] LineString) harita üstünde SVG ile çizer.
 * Katmanlı stroke: gölge + beyaz halo + renk (iğne/vektör overlay ile uyumlu).
 */
export function ScreenShapesOverlay({ shapes, selectedShapeId, onShapePress, interactionLocked = false }: Props) {
  const screenShapes = shapes.filter((s) => s.screenSpace && s.geometry?.type === "LineString");
  if (screenShapes.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {screenShapes.map((shape) => {
          const coords = (shape.geometry as GeoJSON.LineString).coordinates as [number, number][];
          if (!coords?.length) return null;
          const isSel = selectedShapeId === shape.id;
          const stroke = isSel ? "#ef4444" : shape.outlineColor || "#2563eb";
          const sw = shape.outlineWidth || 3;
          const normStroke = Math.max(0.0025, Math.min(0.04, 0.0035 * sw));
          const normHalo = normStroke + 0.0015;
          const normShadow = normStroke + 0.0025;
          const pts = coords.map(([nx, ny]) => `${nx},${ny}`).join(" ");
          const shadowPts = coords.map(([nx, ny]) => `${nx + 0.0015},${ny + 0.0015}`).join(" ");
          const onPress = interactionLocked ? undefined : () => onShapePress(shape.id);

          return (
            <React.Fragment key={shape.id}>
              <Polyline
                points={shadowPts}
                fill="none"
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={normShadow}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.7}
                onPress={onPress}
              />
              <Polyline
                points={pts}
                fill="none"
                stroke="#ffffff"
                strokeWidth={normHalo}
                strokeLinecap="round"
                strokeLinejoin="round"
                onPress={onPress}
              />
              <Polyline
                points={pts}
                fill="none"
                stroke={stroke}
                strokeWidth={normStroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                onPress={onPress}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
