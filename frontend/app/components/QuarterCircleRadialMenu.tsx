import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, ClipPath, Path, G } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

export type RingMenuItem = {
  id: string;
  color?: string;
  onPress?: () => void;
};

const clampW = (v: number, min: number, max: number) => {
  "worklet";
  return Math.max(min, Math.min(max, v));
};

function polar(cx: number, cy: number, r: number, a: number) {
  // SVG koordinatında y aşağı +; a=0 sağ, a=-pi/2 yukarı
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function ringSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  a0: number,
  a1: number
) {
  const p0 = polar(cx, cy, rOuter, a0);
  const p1 = polar(cx, cy, rOuter, a1);
  const p2 = polar(cx, cy, rInner, a1);
  const p3 = polar(cx, cy, rInner, a0);

  // Bu kullanımda dilimler küçük, large-arc-flag hep 0
  const laf = 0;

  // Outer arc saat yönü; inner arc ters
  const sweepOuter = 1;
  const sweepInner = 0;

  return [
    `M ${p0.x} ${p0.y}`,
    `A ${rOuter} ${rOuter} 0 ${laf} ${sweepOuter} ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rInner} ${rInner} 0 ${laf} ${sweepInner} ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
}

export function QuarterCircleRadialMenu({
  items,
  size = 260,

  // radius'ları pencereyle uyumlu tutalım:
  // outerRadius pencerenin biraz dışına taşabilir ama çok uçmasın
  outerRadius = 320,
  innerRadius = 210,

  visibleCount = 4,
  gapDeg = 1.2,
  snapDuration = 180,
  dragSensitivity = 0.004,
}: {
  items: RingMenuItem[];
  size?: number;
  outerRadius?: number;
  innerRadius?: number;
  visibleCount?: number;
  gapDeg?: number;
  snapDuration?: number;
  dragSensitivity?: number;
}) {
  // Quarter pencere: yukarı(-90°) -> sağ(0°)
  const arcStart = -Math.PI / 2;
  const arcEnd = 0;
  const visibleArc = arcEnd - arcStart; // 90°

  const gap = (gapDeg * Math.PI) / 180;
  const sliceArc = (visibleArc - gap * visibleCount) / visibleCount;
  const stepArc = sliceArc + gap;

  const totalArc = items.length * stepArc;

  const minRot = -(totalArc - visibleArc);
  const maxRot = 0;

  const rotation = useSharedValue(0);
  const startRotation = useSharedValue(0);

  // Pivot: sağ-alt köşe (size,size)
  const pivotX = size;
  const pivotY = size;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pivotX },
      { translateY: pivotY },
      { rotateZ: `${rotation.value}rad` },
      { translateX: -pivotX },
      { translateY: -pivotY },
    ],
  }));

  const snapToStep = (r: number) => {
    "worklet";
    const k = Math.round(r / stepArc);
    return clampW(k * stepArc, minRot, maxRot);
  };

  const gesture = useMemo(() => {
    return Gesture.Pan()
      .onBegin(() => {
        "worklet";
        startRotation.value = rotation.value;
      })
      .onUpdate((e) => {
        "worklet";
        const delta = (e.translationX - e.translationY) * dragSensitivity;
        rotation.value = clampW(startRotation.value + delta, minRot, maxRot);
      })
      .onEnd(() => {
        "worklet";
        const snapped = snapToStep(rotation.value);
        rotation.value = withTiming(snapped, { duration: snapDuration });
      });
  }, [dragSensitivity, minRot, maxRot, snapDuration, stepArc]);

  // Merkez sağ-alt köşe
  const cx = size;
  const cy = size;

  // Quarter clip (aynı koordinat sisteminde: 0..size)
  const clipId = "quarterClip";
  const clipPathD = useMemo(() => {
    const pA = polar(cx, cy, outerRadius, arcStart);
    const pB = polar(cx, cy, outerRadius, arcEnd);
    return [
      `M ${cx} ${cy}`,
      `L ${pA.x} ${pA.y}`,
      `A ${outerRadius} ${outerRadius} 0 0 1 ${pB.x} ${pB.y}`,
      "Z",
    ].join(" ");
  }, [cx, cy, outerRadius, arcStart, arcEnd]);

  const slices = useMemo(() => {
    const contentEnd = arcEnd;
    return items.map((it, i) => {
      const a1 = contentEnd - i * stepArc - gap / 2;
      const a0 = a1 - sliceArc;
      return { ...it, a0, a1 };
    });
  }, [items, arcEnd, stepArc, gap, sliceArc]);

  return (
    <GestureHandlerRootView style={[styles.root, { width: size, height: size }]}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.layer, { width: size, height: size }, animatedStyle]}>
          <Svg width={size} height={size}>
            <Defs>
              <ClipPath id={clipId}>
                <Path d={clipPathD} />
              </ClipPath>
            </Defs>

            <G clipPath={`url(#${clipId})`}>
              {slices.map((s) => {
                const d = ringSlicePath(cx, cy, outerRadius, innerRadius, s.a0, s.a1);
                return (
                  <Path
                    key={s.id}
                    d={d}
                    fill={s.color ?? "#2f80ed"}
                    stroke="rgba(0,0,0,0.22)"
                    strokeWidth={1}
                    onPress={s.onPress}
                  />
                );
              })}
            </G>
          </Svg>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  layer: {
    position: "absolute",
    right: 0,
    bottom: 0,
  },
});
