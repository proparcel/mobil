/**
 * 3D Model Editör – Capture Compose Container
 * Ekran dışında render edilen ViewShot: snapshot Image + ekran çizimleri (screenSpace) + ProParcel badge
 */

import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import ViewShot from "react-native-view-shot";
import Svg, { Polyline } from "react-native-svg";
import type { ShapeProperties } from "@/src/maps/drawing/types";

interface Props {
  capturedMapUri: string | null;
  width: number;
  height: number;
  /** "Ekrana çiz" ile kaydedilen normalize [0–1] çizgiler; yakalama JPEG'ine basılır */
  screenOverlayShapes?: ShapeProperties[];
}

export const CaptureComposeContainer = React.forwardRef<any, Props>(
  ({ capturedMapUri, width, height, screenOverlayShapes }, ref) => {
    if (!width || !height) return null;

    const overlay =
      screenOverlayShapes?.filter((s) => s.screenSpace && s.geometry?.type === "LineString") ?? [];

    return (
      <ViewShot
        ref={ref}
        options={{ format: "jpg", quality: 0.9, result: "tmpfile" }}
        style={[styles.offscreen, { width, height }]}
      >
        <View style={[styles.container, { width, height }]}>
          {capturedMapUri && (
            <Image
              source={{ uri: capturedMapUri }}
              fadeDuration={0}
              style={[styles.image, { width, height }]}
              resizeMode="cover"
            />
          )}
          {overlay.length > 0 ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                style={StyleSheet.absoluteFill}
              >
                {overlay.map((shape) => {
                  const coords = (shape.geometry as GeoJSON.LineString).coordinates as [number, number][];
                  if (!coords?.length) return null;
                  const stroke = shape.outlineColor || "#2563eb";
                  const sw = shape.outlineWidth || 3;
                  const normStroke = Math.max(0.0025, Math.min(0.04, 0.0035 * sw));
                  return (
                    <Polyline
                      key={shape.id}
                      points={coords.map(([nx, ny]) => `${nx},${ny}`).join(" ")}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={normStroke}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
              </Svg>
            </View>
          ) : null}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ProParcel</Text>
          </View>
        </View>
      </ViewShot>
    );
  }
);

const styles = StyleSheet.create({
  offscreen: {
    position: "absolute",
    left: -10000,
    top: -10000,
    opacity: 0,
    pointerEvents: "none",
  },
  container: {
    backgroundColor: "#0f172a",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.5)",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
