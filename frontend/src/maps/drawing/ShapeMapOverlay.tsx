import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Polygon, Polyline } from "react-native-svg";
import type { ShapeProperties } from "@/src/maps/drawing/types";
import { isOverlayVectorShape } from "@/src/maps/drawing/overlayShapePolicy";
import {
  getOverlayFillOpacity,
  getOverlayShapeColors,
  getOverlayStrokeWidth,
} from "@/src/maps/drawing/mapOverlayStyles";
import {
  pointsToSvg,
  projectOverlayShapes,
  type ProjectedShapeGeometry,
} from "@/src/maps/drawing/shapeScreenProjection";
import {
  DEFAULT_MAP_OVERLAY_VIEWPORT,
  isMapOverlayViewportReady,
  type MapOverlayViewport,
} from "@/src/maps/drawing/mapOverlayViewport";
import { ArrowOverlayShape } from "@/src/maps/drawing/ArrowOverlayShape";

type Props = {
  shapes: ShapeProperties[];
  mapRef: React.RefObject<any>;
  layoutTick: number;
  selectedShapeId: string | null;
  onShapePress: (shapeId: string) => void;
  viewport?: MapOverlayViewport;
  enabled?: boolean;
};

/** Vektör overlay — viewBox = MapView kardeş container onLayout. Projeksiyon layoutTick (onCameraChanged) ile yenilenir. */
export function ShapeMapOverlay({
  shapes,
  mapRef,
  layoutTick,
  selectedShapeId,
  onShapePress,
  viewport = DEFAULT_MAP_OVERLAY_VIEWPORT,
  enabled = true,
}: Props) {
  const vectorShapes = useMemo(
    () => shapes.filter((s) => isOverlayVectorShape(s)),
    [shapes]
  );

  const [projected, setProjected] = useState<Record<string, ProjectedShapeGeometry>>({});
  const projectSeqRef = useRef(0);

  useEffect(() => {
    if (!enabled || vectorShapes.length === 0 || !isMapOverlayViewportReady(viewport)) {
      if (!enabled || vectorShapes.length === 0) setProjected({});
      return;
    }

    let cancelled = false;
    const seq = ++projectSeqRef.current;

    void (async () => {
      const next = await projectOverlayShapes(mapRef, vectorShapes, viewport);
      if (!cancelled && seq === projectSeqRef.current) {
        setProjected(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, vectorShapes, mapRef, layoutTick, viewport.width, viewport.height]);

  const ordered = useMemo(() => {
    const rest = vectorShapes.filter((s) => s.id !== selectedShapeId);
    const sel = vectorShapes.find((s) => s.id === selectedShapeId);
    return sel ? [...rest, sel] : rest;
  }, [vectorShapes, selectedShapeId]);

  if (!enabled || vectorShapes.length === 0 || !isMapOverlayViewportReady(viewport)) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.clip} pointerEvents="box-none">
      <Svg
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        style={styles.svg}
        pointerEvents="box-none"
      >
        {ordered.map((shape) => {
          const geom = projected[shape.id];
          if (!geom) return null;
          const selected = selectedShapeId === shape.id;
          const colors = getOverlayShapeColors(shape, selected);
          const strokeW = getOverlayStrokeWidth(shape, selected);
          const haloW = strokeW + 3;
          const shadowW = strokeW + 5;

          if (shape.type === "arrow" && geom.arrow) {
            return (
              <ArrowOverlayShape
                key={shape.id}
                shapeId={shape.id}
                model={geom.arrow}
                outlineColor={colors.outline}
                selected={selected}
                onPress={() => onShapePress(shape.id)}
              />
            );
          }

          return (
            <React.Fragment key={shape.id}>
              {geom.polygons.map((ring, idx) => {
                const pts = pointsToSvg(ring);
                const shadowPts = pointsToSvg(ring.map(([x, y]) => [x + 2, y + 2] as [number, number]));
                const fillOpacity = getOverlayFillOpacity(shape, false);
                return (
                  <React.Fragment key={`${shape.id}-poly-${idx}`}>
                    <Polygon
                      points={shadowPts}
                      fill={colors.shadow}
                      stroke="none"
                      opacity={0.55}
                      onPress={() => onShapePress(shape.id)}
                    />
                    <Polygon
                      points={pts}
                      fill={colors.fill}
                      fillOpacity={fillOpacity}
                      stroke={colors.halo}
                      strokeWidth={haloW}
                      strokeLinejoin="round"
                      onPress={() => onShapePress(shape.id)}
                    />
                    <Polygon
                      points={pts}
                      fill={colors.fill}
                      fillOpacity={fillOpacity}
                      stroke={colors.outline}
                      strokeWidth={strokeW}
                      strokeLinejoin="round"
                      onPress={() => onShapePress(shape.id)}
                    />
                  </React.Fragment>
                );
              })}

              {geom.polylines.map((line, idx) => {
                const pts = pointsToSvg(line);
                const shadowPts = pointsToSvg(line.map(([x, y]) => [x + 1.5, y + 1.5] as [number, number]));
                return (
                  <React.Fragment key={`${shape.id}-line-${idx}`}>
                    <Polyline
                      points={shadowPts}
                      fill="none"
                      stroke={colors.shadow}
                      strokeWidth={shadowW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.75}
                      onPress={() => onShapePress(shape.id)}
                    />
                    <Polyline
                      points={pts}
                      fill="none"
                      stroke={colors.halo}
                      strokeWidth={haloW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      onPress={() => onShapePress(shape.id)}
                    />
                    <Polyline
                      points={pts}
                      fill="none"
                      stroke={colors.outline}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      onPress={() => onShapePress(shape.id)}
                    />
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}
      </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1250,
  },
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  svg: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
