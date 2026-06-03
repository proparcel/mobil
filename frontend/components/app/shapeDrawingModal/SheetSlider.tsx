import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

export type SheetSliderProps = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange?: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: StyleProp<ViewStyle>;
};

const THUMB_SIZE = 22;
const THUMB_HIT = 44;
const TRACK_HEIGHT = 5;

function clamp(n: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, n));
}

function snapStep(raw: number, step: number, min: number, max: number) {
  "worklet";
  if (!step || step <= 0) return clamp(raw, min, max);
  const snapped = min + Math.round((raw - min) / step) * step;
  return clamp(snapped, min, max);
}

function valueToOffset(value: number, min: number, max: number, travel: number) {
  "worklet";
  const range = max - min;
  if (range <= 0 || travel <= 0) return 0;
  return ((clamp(value, min, max) - min) / range) * travel;
}

function offsetToValue(offset: number, min: number, max: number, travel: number, step: number) {
  "worklet";
  const range = max - min;
  if (range <= 0 || travel <= 0) return min;
  const raw = min + (clamp(offset, 0, travel) / travel) * range;
  return snapStep(raw, step, min, max);
}

/**
 * Bottom sheet içinde yatay slider (RNGH Pan).
 * Dikey sürüklemeler sheet/scroll’a bırakılır; yalnızca thumb yatay pan alır.
 */
export function SheetSlider({
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
  minimumTrackTintColor = "#3b82f6",
  maximumTrackTintColor = "#475569",
  thumbTintColor = "#e2e8f0",
  style,
}: SheetSliderProps) {
  const travelWidth = useSharedValue(0);
  const thumbOffset = useSharedValue(0);
  const dragStartOffset = useSharedValue(0);
  const draggingRef = useRef(false);
  const [layoutWidth, setLayoutWidth] = useState(0);

  const syncThumbFromValue = useCallback(
    (nextValue: number, width: number) => {
      const t = Math.max(0, width - THUMB_SIZE);
      thumbOffset.value = valueToOffset(nextValue, minimumValue, maximumValue, t);
    },
    [maximumValue, minimumValue, thumbOffset]
  );

  useEffect(() => {
    if (!draggingRef.current && layoutWidth > 0) {
      syncThumbFromValue(value, layoutWidth);
    }
  }, [value, layoutWidth, syncThumbFromValue]);

  const emitChange = useCallback(
    (next: number) => {
      onValueChange?.(next);
    },
    [onValueChange]
  );

  const emitStart = useCallback(() => {
    draggingRef.current = true;
    onSlidingStart?.();
  }, [onSlidingStart]);

  const emitComplete = useCallback(
    (next: number) => {
      draggingRef.current = false;
      onSlidingComplete?.(next);
    },
    [onSlidingComplete]
  );

  const applyOffset = useCallback(
    (offset: number, complete: boolean) => {
      const t = Math.max(0, layoutWidth - THUMB_SIZE);
      const next = offsetToValue(offset, minimumValue, maximumValue, t, step);
      thumbOffset.value = valueToOffset(next, minimumValue, maximumValue, t);
      emitChange(next);
      if (complete) emitComplete(next);
    },
    [emitChange, emitComplete, layoutWidth, maximumValue, minimumValue, step, thumbOffset]
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setLayoutWidth(w);
      travelWidth.value = Math.max(0, w - THUMB_SIZE);
      syncThumbFromValue(value, w);
    },
    [syncThumbFromValue, travelWidth, value]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-6, 6])
        .onStart(() => {
          dragStartOffset.value = thumbOffset.value;
          runOnJS(emitStart)();
        })
        .onUpdate((event) => {
          const t = travelWidth.value;
          const next = clamp(dragStartOffset.value + event.translationX, 0, t);
          thumbOffset.value = next;
          const v = offsetToValue(next, minimumValue, maximumValue, t, step);
          runOnJS(emitChange)(v);
        })
        .onEnd(() => {
          const t = travelWidth.value;
          const v = offsetToValue(thumbOffset.value, minimumValue, maximumValue, t, step);
          thumbOffset.value = valueToOffset(v, minimumValue, maximumValue, t);
          runOnJS(emitComplete)(v);
        }),
    [
      dragStartOffset,
      emitChange,
      emitComplete,
      emitStart,
      maximumValue,
      minimumValue,
      step,
      thumbOffset,
      travelWidth,
    ]
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbOffset.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbOffset.value + THUMB_SIZE / 2,
  }));

  const jumpToX = useCallback(
    (localX: number) => {
      if (layoutWidth <= 0) return;
      const t = Math.max(0, layoutWidth - THUMB_SIZE);
      const offset = clamp(localX - THUMB_SIZE / 2, 0, t);
      emitStart();
      applyOffset(offset, true);
    },
    [applyOffset, emitStart, layoutWidth]
  );

  return (
    <View style={[styles.root, style]} onLayout={onLayout} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        <Pressable
          style={styles.trackPress}
          onPress={(e) => jumpToX(e.nativeEvent.locationX + THUMB_SIZE / 2)}
          accessibilityRole="adjustable"
        >
          <View style={[styles.track, { backgroundColor: maximumTrackTintColor }]}>
            <Animated.View
              style={[styles.trackFill, { backgroundColor: minimumTrackTintColor }, fillStyle]}
            />
          </View>
        </Pressable>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.thumbHit, thumbStyle]}>
            <View
              style={[
                styles.thumb,
                { backgroundColor: thumbTintColor, borderColor: minimumTrackTintColor },
              ]}
            />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    height: THUMB_HIT,
    justifyContent: "center",
  },
  row: {
    height: THUMB_HIT,
    justifyContent: "center",
    paddingHorizontal: THUMB_SIZE / 2,
  },
  trackPress: {
    height: 28,
    justifyContent: "center",
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: "hidden",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumbHit: {
    position: "absolute",
    top: 0,
    left: THUMB_SIZE / 2 - THUMB_HIT / 2,
    width: THUMB_HIT,
    height: THUMB_HIT,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
