import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { TextBoxMapMarker } from "@/src/maps/drawing/TextBoxMapMarker";
import { textBoxHitSizePx } from "@/src/maps/drawing/shapePickAtLngLat";
import type { ShapeProperties } from "@/src/maps/drawing/types";

type Props = {
  shapes: ShapeProperties[];
  mapRef: React.RefObject<any>;
  /** Kamera / harita hareketinde artırılır — ekran konumu yenilenir */
  layoutTick: number;
  selectedShapeId: string | null;
  onShapePress: (shapeId: string) => void;
  enabled?: boolean;
};

type ScreenPos = { x: number; y: number };

/**
 * Metin kutuları MarkerView yerine RN overlay ile çizilir.
 * Android + Fabric'te MarkerView içi Pressable / harita onPress güvenilir değil.
 */
export function TextBoxMapOverlay({
  shapes,
  mapRef,
  layoutTick,
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

  useEffect(() => {
    if (!enabled || textboxes.length === 0) {
      setPositions({});
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const map = mapRef?.current;
        if (!map || typeof map.getPointInView !== "function") return;

        const next: Record<string, ScreenPos> = {};
        for (const shape of textboxes) {
          const coord = shape.geometry.coordinates as [number, number];
          try {
            const p = await map.getPointInView(coord);
            if (!p || p.length < 2) continue;
            const x = Number(p[0]);
            const y = Number(p[1]);
            if (Number.isFinite(x) && Number.isFinite(y)) {
              next[shape.id] = { x, y };
            }
          } catch {
            /* ignore per-shape */
          }
        }
        if (!cancelled) setPositions(next);
      })();
    }, 16);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, textboxes, mapRef, layoutTick]);

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
            <TextBoxMapMarker shape={shape} />
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
