import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import type { CalibrationTransform } from "../types/calibrationTransform";
import type { VrLatLon } from "../types/vrParcelPayload";
import {
  countVisibleBoundaryPoints,
  projectCentroidLabel,
  projectParcelBoundaryGround,
  projectParcelEdges,
} from "../utils/parcelGroundProjection";

type Props = {
  polygon: VrLatLon[];
  center: VrLatLon;
  transform: CalibrationTransform;
  userLat: number;
  userLon: number;
  deviceHeadingDeg: number;
  width: number;
  height: number;
  ada: string;
  parsel: string;
  areaM2?: number;
};

export function VrParcelOverlay({
  polygon,
  center,
  transform,
  userLat,
  userLon,
  deviceHeadingDeg,
  width,
  height,
  ada,
  parsel,
  areaM2,
}: Props): React.ReactElement {
  const projectionParams = useMemo(
    () => ({
      polygon,
      userLat,
      userLon,
      deviceHeadingDeg,
      transform,
      screenW: width,
      screenH: height,
    }),
    [polygon, userLat, userLon, deviceHeadingDeg, transform, width, height],
  );

  const screenPoints = useMemo(
    () => projectParcelBoundaryGround(projectionParams),
    [projectionParams],
  );
  const edges = useMemo(() => projectParcelEdges(projectionParams), [projectionParams]);
  const labelPoint = useMemo(
    () => projectCentroidLabel(center, projectionParams),
    [center, projectionParams],
  );

  const visibleCount = countVisibleBoundaryPoints(screenPoints);
  const pointsStr = screenPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const label = `Ada ${ada} / ${parsel}${areaM2 ? ` · ${areaM2.toLocaleString("tr-TR")} m²` : ""}`;

  if (visibleCount < 1 && edges.every((e) => !e.visible)) {
    return (
      <View style={styles.hintBox} pointerEvents="none">
        <Text style={styles.hintTitle}>Sınır aranıyor…</Text>
        <Text style={styles.hintText}>
          Telefonu yatay tutun ve etrafınızda yavaşça dönün. Pusula kalibre olana kadar birkaç saniye bekleyin.
        </Text>
      </View>
    );
  }

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {visibleCount >= 3 ? (
        <Polygon
          points={pointsStr}
          fill="rgba(59, 130, 246, 0.12)"
          stroke="none"
        />
      ) : null}
      {edges.map((edge, index) =>
        edge.visible ? (
          <Line
            key={`edge-${index}`}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="#60a5fa"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null,
      )}
      {screenPoints.map((p, index) =>
        p.visible && !p.behind ? (
          <Circle
            key={`corner-${index}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#ffffff"
            stroke="#3b82f6"
            strokeWidth={2}
          />
        ) : null,
      )}
      {labelPoint.visible && !labelPoint.behind ? (
        <SvgText
          x={labelPoint.x}
          y={labelPoint.y - 10}
          fill="#f8fafc"
          fontSize={11}
          fontWeight="700"
          textAnchor="middle"
        >
          {label}
        </SvgText>
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  hintBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 48,
    paddingHorizontal: 20,
  },
  hintTitle: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  hintText: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
});

export default VrParcelOverlay;
