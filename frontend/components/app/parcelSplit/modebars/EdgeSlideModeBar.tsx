/**
 * Kenar kaydır modu bar: adım input (0,001–100 m, 3 ondalık), yön ve işlem butonları (simge).
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

const MODE_BAR_HEIGHT = 44;
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
  edgeSlideStep: number;
  onEdgeSlideStepChange: (s: number) => void;
  selectedEdgeId: string | null;
  onArrow: (offsetMeters: number) => void;
  hasEdgeSlideSelection: boolean;
  onFinish: () => void;
  onCancel: () => void;
};

export const EDGE_SLIDE_MODE_BAR_HEIGHT_PX = MODE_BAR_HEIGHT;

export function EdgeSlideModeBar({
  edgeSlideStep,
  onEdgeSlideStepChange,
  selectedEdgeId,
  onArrow,
  hasEdgeSlideSelection,
  onFinish,
  onCancel,
}: Props) {
  const [inputText, setInputText] = useState(() => formatStep(edgeSlideStep));
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setInputText(formatStep(edgeSlideStep));
  }, [edgeSlideStep]);

  const step = clampStep(edgeSlideStep);

  const handleInputBlur = useCallback(
    (_e: NativeSyntheticEvent<TextInputEndEditingEventData>) => {
      const parsed = parseFloat(inputText.replace(",", "."));
      if (Number.isFinite(parsed) && parsed >= STEP_MIN) {
        const c = clampStep(parsed);
        onEdgeSlideStepChange(c);
        setInputText(formatStep(c));
      } else {
        setInputText(formatStep(edgeSlideStep));
      }
    },
    [inputText, edgeSlideStep, onEdgeSlideStepChange]
  );

  const fireArrow = useCallback(
    (dir: 1 | -1) => {
      onArrow(dir * step);
    },
    [step, onArrow]
  );

  const startRepeat = useCallback(
    (dir: 1 | -1) => {
      if (repeatTimerRef.current) return;
      fireArrow(dir);
      repeatTimerRef.current = setInterval(() => fireArrow(dir), LONG_PRESS_INTERVAL_MS);
    },
    [fireArrow]
  );

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

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

      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => fireArrow(-1)}
        onLongPress={() => startRepeat(-1)}
        onPressOut={stopRepeat}
        delayLongPress={400}
        disabled={!selectedEdgeId}
      >
        <Ionicons
          name="chevron-back"
          size={22}
          color={selectedEdgeId ? parcelSplitTheme.brandNavy : "#94a3b8"}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => fireArrow(1)}
        onLongPress={() => startRepeat(1)}
        onPressOut={stopRepeat}
        delayLongPress={400}
        disabled={!selectedEdgeId}
      >
        <Ionicons
          name="chevron-forward"
          size={22}
          color={selectedEdgeId ? parcelSplitTheme.brandNavy : "#94a3b8"}
        />
      </TouchableOpacity>

      {hasEdgeSlideSelection && (
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
    width: 36,
    height: 36,
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
