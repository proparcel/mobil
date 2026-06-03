import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { TextBoxMapMarker } from "@/src/maps/drawing/TextBoxMapMarker";
import { textBoxHitSizePx } from "@/src/maps/drawing/shapePickAtLngLat";
import type { ShapeProperties } from "@/src/maps/drawing/types";
import {
  DEFAULT_MAP_OVERLAY_VIEWPORT,
  type MapOverlayViewport,
} from "@/src/maps/drawing/mapOverlayViewport";
import { projectLngLatsBatch } from "@/src/maps/drawing/shapeScreenProjection";

type Props = {
  shapes: ShapeProperties[];
  mapRef: React.RefObject<any>;
  layoutTick: number;
  viewport?: MapOverlayViewport;
  selectedShapeId: string | null;
  onShapePress: (shapeId: string) => void;
  enabled?: boolean;
};

type ScreenPos = { x: number; y: number };

export function TextBoxMapOverlay({
  shapes,
  mapRef,
  layoutTick,
  viewport = DEFAULT_MAP_OVERLAY_VIEWPORT,
  selectedShapeId,
  onShapePress,
  enabled = true,
}: Props) {
  const textboxes = useMemo(
    () =>
      shapes.filter(
        (s) =>
          s.type === "textbox" &&
          !s.screenSpace &&
          s.geometry?.type === "Point" &&
          Array.isArray(s.geometry.coordinates) &&
          s.geometry.coordinates.length >= 2
      ),
    [shapes]
  );

  const [positions, setPositions] = useState<Record<string, ScreenPos>>({});
  const projectSeqRef = useRef(0);

  useEffect(() => {
    if (!enabled || textboxes.length === 0) {
      setPositions({});
      return;
    }

    let cancelled = false;
    const seq = ++projectSeqRef.current;

    void (async () => {
      const coords = textboxes.map((s) => s.geometry.coordinates as [number, number]);
      const projected = await projectLngLatsBatch(mapRef, coords, viewport);
      const next: Record<string, ScreenPos> = {};
      textboxes.forEach((shape, i) => {
        const p = projected[i];
        if (p) next[shape.id] = { x: p[0], y: p[1] };
      });
      if (!cancelled && seq === projectSeqRef.current) {
        setPositions(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, textboxes, mapRef, layoutTick, viewport.width, viewport.height]);

  if (!enabled || textboxes.length === 0) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {textboxes.map((shape) => {
        const pos = positions[shape.id];
        if (!pos) return null;

        const hitSize = textBoxHitSizePx(shape);
        const left = pos.x - hitSize.width / 2;
        const top = pos.y - hitSize.height / 2;

        return (
          <Pressable
            key={shape.id}
            pointerEvents="auto"
            onPress={() => onShapePress(shape.id)}
            style={[
              styles.item,
              {
                left,
                top,
                minWidth: hitSize.width,
                minHeight: hitSize.height,
                zIndex: selectedShapeId === shape.id ? 3 : 2,
              },
            ]}
            hitSlop={12}
          >
            <TextBoxMapMarker shape={shape} selected={selectedShapeId === shape.id} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 850,
  },
  item: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
