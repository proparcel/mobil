import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";

/** Zoom-in referans noktası: ekran ortasının bu oran kadar yukarısı + ekstra kaydırma */
const ZOOM_IN_CENTER_Y_OFFSET_RATIO = 0.3;
export const ZOOM_IN_CENTER_DOWN_PX = 70;
const ZOOM_IN_CROSS_ARM_PX = 14;
const ZOOM_IN_CROSS_STROKE = 3;

type HoldPoint = { x: number; y: number };

type Props = {
  sessionActive: boolean;
  onZoomCenterReady?: (x: number, y: number) => void;
  children: React.ReactElement;
};

export function computeZoomInCenter(width: number, height: number): HoldPoint {
  return {
    x: width / 2,
    y: height / 2 - height * ZOOM_IN_CENTER_Y_OFFSET_RATIO + ZOOM_IN_CENTER_DOWN_PX,
  };
}

export function MapHoldZoomLayer({
  sessionActive,
  onZoomCenterReady,
  children,
}: Props) {
  const [zoomInCenterPoint, setZoomInCenterPoint] = useState<HoldPoint | null>(null);

  const syncZoomInCenter = useCallback(
    (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const center = computeZoomInCenter(width, height);
      setZoomInCenterPoint(center);
      onZoomCenterReady?.(center.x, center.y);
    },
    [onZoomCenterReady],
  );

  const showPlus = sessionActive && zoomInCenterPoint;

  return (
    <View
      style={styles.container}
      collapsable={false}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        syncZoomInCenter(width, height);
      }}
    >
      {children}
      {showPlus ? (
        <View pointerEvents="none" style={styles.indicatorLayer}>
          <Svg style={styles.indicatorSvg} pointerEvents="none">
            <Line
              x1={zoomInCenterPoint.x - ZOOM_IN_CROSS_ARM_PX}
              y1={zoomInCenterPoint.y}
              x2={zoomInCenterPoint.x + ZOOM_IN_CROSS_ARM_PX}
              y2={zoomInCenterPoint.y}
              stroke="rgba(148, 163, 184, 0.95)"
              strokeWidth={ZOOM_IN_CROSS_STROKE}
              strokeLinecap="round"
            />
            <Line
              x1={zoomInCenterPoint.x}
              y1={zoomInCenterPoint.y - ZOOM_IN_CROSS_ARM_PX}
              x2={zoomInCenterPoint.x}
              y2={zoomInCenterPoint.y + ZOOM_IN_CROSS_ARM_PX}
              stroke="rgba(148, 163, 184, 0.95)"
              strokeWidth={ZOOM_IN_CROSS_STROKE}
              strokeLinecap="round"
            />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  indicatorLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  indicatorSvg: {
    ...StyleSheet.absoluteFillObject,
  },
});
