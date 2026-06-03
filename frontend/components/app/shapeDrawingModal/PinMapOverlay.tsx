import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MapPinMarker } from "@/src/maps/drawing/MapPinMarker";
import { pinHitSizePx } from "@/src/maps/drawing/mapPinStyles";
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

export function PinMapOverlay({
  shapes,
  mapRef,
  layoutTick,
  viewport = DEFAULT_MAP_OVERLAY_VIEWPORT,
  selectedShapeId,
  onShapePress,
  enabled = true,
}: Props) {
  const markers = useMemo(
    () =>
      shapes.filter(
        (s) =>
          s.type === "marker" &&
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
    if (!enabled || markers.length === 0) {
      setPositions({});
      return;
    }

    let cancelled = false;
    const seq = ++projectSeqRef.current;

    void (async () => {
      const coords = markers.map((s) => s.geometry.coordinates as [number, number]);
      const projected = await projectLngLatsBatch(mapRef, coords, viewport);
      const next: Record<string, ScreenPos> = {};
      markers.forEach((shape, i) => {
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
  }, [enabled, markers, mapRef, layoutTick, viewport.width, viewport.height]);

  if (!enabled || markers.length === 0) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {markers.map((shape) => {
        const pos = positions[shape.id];
        if (!pos) return null;

        const hit = pinHitSizePx(shape);
        const left = pos.x - hit.width / 2;
        const top = pos.y - hit.height;

        return (
          <Pressable
            key={shape.id}
            pointerEvents="auto"
            onPress={() => onShapePress(shape.id)}
            style={({ pressed }) => [
              styles.item,
              {
                left,
                top,
                width: hit.width,
                height: hit.height,
                zIndex: selectedShapeId === shape.id ? 4 : 3,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            hitSlop={8}
          >
            <MapPinMarker shape={shape} selected={selectedShapeId === shape.id} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 860,
  },
  item: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
