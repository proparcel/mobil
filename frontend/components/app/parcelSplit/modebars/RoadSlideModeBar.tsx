/**
 * Yol kaydır modu bar: segment için ±, vertex için 4 yön, adım input, İptal/Bitir.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  type NativeSyntheticEvent,
  type TextInputEndEditingEventData,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { parcelSplitTheme } from "../theme";
import type { RoadHandleSelection } from "../../../src/types/parcelSplit";

const MODE_BAR_HEIGHT = 48;
const LONG_PRESS_INTERVAL_MS = 80;
const STEP_MIN = 0.001;
const STEP_MAX = 100;

function clampStep(v: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(STEP_MIN, Math.min(STEP_MAX, n));
}

function formatStep(v: number): string {
  const n = Math.round(v * 1000) / 1000;
  if (n >= 1) return String(n);
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") || "0.001";
}

type Props = {
  roadSlideStep: number;
  onRoadSlideStepChange: (s: number) => void;
  selectedHandle: RoadHandleSelection;
  onSegmentArrow: (offsetMeters: number) => void;
  onVertexMove: (dx: number, dy: number) => void;
  hasRoadSlideSelection: boolean;
  onFinish: () => void;
  onCancel: () => void;
};

export const ROAD_SLIDE_MODE_BAR_HEIGHT_PX = MODE_BAR_HEIGHT;

export function RoadSlideModeBar({
  roadSlideStep,
  onRoadSlideStepChange,
  selectedHandle,
  onSegmentArrow,
  onVertexMove,
  hasRoadSlideSelection,
  onFinish,
  onCancel,
}: Props) {
  const [inputText, setInputText] = useState(() => formatStep(roadSlideStep));
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setInputText(formatStep(roadSlideStep));
  }, [roadSlideStep]);

  const step = clampStep(roadSlideStep);
  const isSegment = selectedHandle?.type === "segment";
  const isVertex = selectedHandle?.type === "vertex";
  const hasHandle = !!selectedHandle;
  /** Yol seçiliyken segment handle yoksa da kaydırma oklarını göster (default segment ile uygulanır). */
  const showSegmentArrows = hasRoadSlideSelection && (isSegment || !hasHandle);

  const handleInputBlur = useCallback(
    (_e: NativeSyntheticEvent<TextInputEndEditingEventData>) => {
      const parsed = parseFloat(inputText.replace(",", "."));
      if (Number.isFinite(parsed) && parsed >= STEP_MIN) {
        const c = clampStep(parsed);
        onRoadSlideStepChange(c);
        setInputText(formatStep(c));
      } else {
        setInputText(formatStep(roadSlideStep));
      }
    },
    [inputText, roadSlideStep, onRoadSlideStepChange]
  );

  const fireSegmentArrow = useCallback(
    (dir: 1 | -1) => {
      onSegmentArrow(dir * step);
    },
    [step, onSegmentArrow]
  );

  const fireVertexMove = useCallback(
    (dx: number, dy: number) => {
      onVertexMove(dx, dy);
    },
    [onVertexMove]
  );

  const startRepeat = useCallback(
    (fn: () => void) => {
      if (repeatTimerRef.current) return;
      fn();
      repeatTimerRef.current = setInterval(fn, LONG_PRESS_INTERVAL_MS);
    },
    []
  );

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  const c = hasHandle || showSegmentArrows ? parcelSplitTheme.brandNavy : "#94a3b8";

  return (
    <View style={[styles.bar, { height: MODE_BAR_HEIGHT }]}>
      <Text style={styles.label}>Adım</Text>
      <TextInput
        style={styles.input}
        value={inputText}
        onChangeText={setInputText}
        onEndEditing={handleInputBlur}
        keyboardType="decimal-pad"
        selectTextOnFocus
        maxLength={8}
      />
      <Text style={styles.unit}>m</Text>

      {showSegmentArrows ? (
        <>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => fireSegmentArrow(-1)}
            onLongPress={() => startRepeat(() => fireSegmentArrow(-1))}
            onPressOut={stopRepeat}
            delayLongPress={400}
          >
            <Ionicons name="chevron-back" size={22} color={c} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => fireSegmentArrow(1)}
            onLongPress={() => startRepeat(() => fireSegmentArrow(1))}
            onPressOut={stopRepeat}
            delayLongPress={400}
          >
            <Ionicons name="chevron-forward" size={22} color={c} />
          </TouchableOpacity>
        </>
      ) : isVertex ? (
        <>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => fireVertexMove(-step, 0)}
            onLongPress={() => startRepeat(() => fireVertexMove(-step, 0))}
            onPressOut={stopRepeat}
            delayLongPress={400}
          >
            <Ionicons name="chevron-back" size={20} color={c} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => fireVertexMove(step, 0)}
            onLongPress={() => startRepeat(() => fireVertexMove(step, 0))}
            onPressOut={stopRepeat}
            delayLongPress={400}
          >
            <Ionicons name="chevron-forward" size={20} color={c} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => fireVertexMove(0, -step)}
            onLongPress={() => startRepeat(() => fireVertexMove(0, -step))}
            onPressOut={stopRepeat}
            delayLongPress={400}
          >
            <Ionicons name="chevron-up" size={20} color={c} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => fireVertexMove(0, step)}
            onLongPress={() => startRepeat(() => fireVertexMove(0, step))}
            onPressOut={stopRepeat}
            delayLongPress={400}
          >
            <Ionicons name="chevron-down" size={20} color={c} />
          </TouchableOpacity>
        </>
      ) : null}

      {hasRoadSlideSelection && (
        <>
          <TouchableOpacity style={[styles.iconBtn, styles.btnCancel]} onPress={onCancel}>
            <Ionicons name="close" size={22} color="#dc2626" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, styles.btnPrimary]} onPress={onFinish}>
            <Ionicons name="checkmark" size={22} color="#fff" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: parcelSplitTheme.cardBg,
  },
  label: {
    fontSize: 11,
    color: parcelSplitTheme.textMuted,
    fontWeight: "600",
  },
  input: {
    width: 52,
    minHeight: 32,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: parcelSplitTheme.brandNavy,
    backgroundColor: "#fff",
    ...(Platform.OS === "android" && { includeFontPadding: false, textAlignVertical: "center" }),
  },
  unit: {
    fontSize: 10,
    color: parcelSplitTheme.textMuted,
    fontWeight: "600",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancel: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  btnPrimary: {
    backgroundColor: parcelSplitTheme.accentBlue,
    borderColor: parcelSplitTheme.accentBlue,
  },
});
