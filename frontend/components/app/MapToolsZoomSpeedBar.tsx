import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const BAR_HEIGHT = 136;
const TRACK_WIDTH = 4;
const CAP_SIZE = 26;
const BUTTON_GAP = 34;

type Props = {
  visible: boolean;
  mode: "in" | "out";
  speedT: number;
};

export function MapToolsZoomSpeedBar({ visible, mode, speedT }: Props) {
  const reveal = useRef(new Animated.Value(0)).current;
  const isIn = mode === "in";
  const clampedT = Math.max(0, Math.min(1, speedT));
  const travel = BAR_HEIGHT - CAP_SIZE - 8;
  const thumbOffset = clampedT * travel;

  useEffect(() => {
    Animated.spring(reveal, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 118,
      friction: 11,
    }).start();
  }, [reveal, visible]);

  const fillStyle = isIn
    ? { bottom: CAP_SIZE / 2, height: Math.max(8, thumbOffset + 8) }
    : { top: CAP_SIZE / 2, height: Math.max(8, thumbOffset + 8) };

  const thumbStyle = isIn
    ? { bottom: CAP_SIZE / 2 - 5 + thumbOffset }
    : { top: CAP_SIZE / 2 - 5 + thumbOffset };

  const topCapActive = isIn;
  const bottomCapActive = !isIn;

  const plusCap = (
    <View style={[styles.cap, topCapActive ? styles.capActive : styles.capIdle]}>
      <Text style={[styles.capText, topCapActive ? styles.capTextActive : styles.capTextIdle]}>+</Text>
    </View>
  );

  const minusCap = (
    <View style={[styles.cap, bottomCapActive ? styles.capActive : styles.capIdle]}>
      <Text style={[styles.capText, bottomCapActive ? styles.capTextActive : styles.capTextIdle]}>-</Text>
    </View>
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        isIn ? styles.wrapUp : styles.wrapDown,
        {
          opacity: reveal,
          transform: [
            {
              scaleY: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
            },
            {
              translateY: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: isIn ? [28, 0] : [-28, 0],
              }),
            },
          ],
        },
      ]}
    >
      {plusCap}
      <View style={styles.trackCol}>
        <View style={styles.track} />
        <View style={[styles.fill, fillStyle]} />
        <View style={[styles.thumb, thumbStyle]} />
      </View>
      {minusCap}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapUp: {
    position: "absolute",
    bottom: BUTTON_GAP,
    left: "50%",
    marginLeft: -CAP_SIZE / 2,
    width: CAP_SIZE,
    height: BAR_HEIGHT,
    alignItems: "center",
    zIndex: 1003,
  },
  wrapDown: {
    position: "absolute",
    top: BUTTON_GAP,
    left: "50%",
    marginLeft: -CAP_SIZE / 2,
    width: CAP_SIZE,
    height: BAR_HEIGHT,
    alignItems: "center",
    zIndex: 1003,
  },
  cap: {
    width: CAP_SIZE,
    height: CAP_SIZE,
    borderRadius: CAP_SIZE / 2,
    backgroundColor: "#0f172a",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  capActive: {
    borderColor: "#3b82f6",
  },
  capIdle: {
    borderColor: "rgba(148, 163, 184, 0.75)",
  },
  capText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  capTextActive: {
    color: "#3b82f6",
  },
  capTextIdle: {
    color: "rgba(148, 163, 184, 0.9)",
  },
  trackCol: {
    flex: 1,
    width: CAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
    backgroundColor: "rgba(148, 163, 184, 0.35)",
  },
  fill: {
    position: "absolute",
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
    backgroundColor: "rgba(59, 130, 246, 0.85)",
  },
  thumb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
});
