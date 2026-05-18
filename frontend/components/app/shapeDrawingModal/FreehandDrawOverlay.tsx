import React, { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

type Props = {
  active: boolean;
  mode: "pen" | "freehand";
  drawSurface: "map" | "screen";
  mapRef: React.RefObject<any>;
  onCommitMap: (coords: [number, number][]) => void;
  onCommitScreen: (normalizedPoints: [number, number][]) => void;
  strokePreviewColor: string;
  strokeWidth: number;
};

/**
 * Kalem / serbest: parmağı sürükleyerek çizim. Harita modunda noktalar lng/lat’e çevrilir.
 */
export function FreehandDrawOverlay({
  active,
  mode,
  drawSurface,
  mapRef,
  onCommitMap,
  onCommitScreen,
  strokePreviewColor,
  strokeWidth,
}: Props) {
  const [draftPx, setDraftPx] = useState<[number, number][]>([]);
  const [layout, setLayout] = useState({ w: 1, h: 1 });
  const pointsRef = useRef<[number, number][]>([]);
  const layoutRef = useRef({ w: 1, h: 1 });

  const minDistSq = (mode === "pen" ? 10 : 4) ** 2;
  const lastRef = useRef<[number, number] | null>(null);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => active,
        onMoveShouldSetPanResponder: () => active,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          lastRef.current = [locationX, locationY];
          pointsRef.current = [[locationX, locationY]];
          setDraftPx([[locationX, locationY]]);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          const last = lastRef.current;
          if (!last) return;
          const dx = locationX - last[0];
          const dy = locationY - last[1];
          if (dx * dx + dy * dy < minDistSq) return;
          lastRef.current = [locationX, locationY];
          pointsRef.current = [...pointsRef.current, [locationX, locationY]];
          setDraftPx(pointsRef.current);
        },
        onPanResponderRelease: () => {
          const pts = pointsRef.current;
          pointsRef.current = [];
          lastRef.current = null;
          setDraftPx([]);
          if (pts.length < 2) return;

          const { w, h } = layoutRef.current;
          if (drawSurface === "screen") {
            const norm: [number, number][] = pts.map(([x, y]) => [Math.max(0, Math.min(1, x / w)), Math.max(0, Math.min(1, y / h))]);
            onCommitScreen(norm);
            return;
          }

          const map = mapRef?.current;
          if (!map || typeof map.getCoordinateFromView !== "function") return;

          (async () => {
            const lnglats: [number, number][] = [];
            for (const [x, y] of pts) {
              try {
                const ll = await map.getCoordinateFromView([x, y]);
                if (ll && Array.isArray(ll) && ll.length >= 2) {
                  lnglats.push([Number(ll[0]), Number(ll[1])]);
                }
              } catch {
                /* atla */
              }
            }
            if (lnglats.length >= 2) onCommitMap(lnglats);
          })();
        },
      }),
    [active, mode, drawSurface, mapRef, minDistSq, onCommitMap, onCommitScreen]
  );

  if (!active) return null;

  const pointsStr = draftPx.map((p) => `${p[0]},${p[1]}`).join(" ");

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          layoutRef.current = { w: width, h: height };
          setLayout({ w: width, h: height });
        }
      }}
      {...pan.panHandlers}
    >
      {draftPx.length >= 2 ? (
        <Svg width={layout.w} height={layout.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Polyline points={pointsStr} fill="none" stroke={strokePreviewColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}
