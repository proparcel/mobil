import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppBottomSheetModal from "../app/AppBottomSheetModal";
import { sheetScrollBottomPadding } from "../../src/utils/sheetSafeArea";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";
import {
  DRONE_VIDEO_PRODUCTION_STEPS,
  type DroneProductionStepDef,
  type DroneProductionStepId,
} from "../../src/constants/aiDroneProductionPipeline";

export type PipelineStepStatus = "pending" | "active" | "done" | "error";

type PipelineContentProps = {
  activeStepId: DroneProductionStepId | null;
  completedStepIds: ReadonlySet<DroneProductionStepId>;
  detail?: string;
  errorMessage?: string;
  steps?: DroneProductionStepDef[];
};

function statusFor(
  stepId: DroneProductionStepId,
  activeStepId: DroneProductionStepId | null,
  completed: ReadonlySet<DroneProductionStepId>,
  errorMessage?: string,
): PipelineStepStatus {
  if (errorMessage && activeStepId === stepId) return "error";
  if (completed.has(stepId)) return "done";
  if (activeStepId === stepId) return "active";
  return "pending";
}

function StepIcon({ status }: { status: PipelineStepStatus }) {
  if (status === "active") {
    return <ActivityIndicator size="small" color={AI_DRONE_EDITOR_THEME.primaryBright} style={styles.icon} />;
  }
  if (status === "done") {
    return <Ionicons name="checkmark-circle" size={20} color="#4ade80" style={styles.icon} />;
  }
  if (status === "error") {
    return <Ionicons name="close-circle" size={20} color="#f87171" style={styles.icon} />;
  }
  return <Ionicons name="ellipse-outline" size={18} color={AI_DRONE_EDITOR_THEME.mutedOnDark} style={styles.icon} />;
}

/** Tüm adımlar — sheet içinde kaydırılabilir */
export function DroneProductionPipelineContent({
  activeStepId,
  completedStepIds,
  detail,
  errorMessage,
  steps = DRONE_VIDEO_PRODUCTION_STEPS,
}: PipelineContentProps) {
  const rows = useMemo(
    () =>
      steps.map((step) => ({
        step,
        status: statusFor(step.id, activeStepId, completedStepIds, errorMessage),
      })),
    [steps, activeStepId, completedStepIds, errorMessage],
  );

  return (
    <View style={styles.content} accessibilityRole="summary">
      <Text style={styles.heading}>Üretim süreci</Text>
      <Text style={styles.subheading}>
        {completedStepIds.size}/{steps.length} adım tamamlandı
      </Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <View style={styles.list}>
        {rows.map(({ step, status }) => (
          <View key={step.id} style={styles.row}>
            <StepIcon status={status} />
            <View style={styles.rowText}>
              <Text style={[styles.title, status === "active" && styles.titleActive]}>{step.title}</Text>
              {step.api ? (
                <Text style={[styles.api, status === "active" && styles.apiActive]} numberOfLines={3}>
                  {step.method ? `${step.method} ` : ""}
                  {step.api}
                </Text>
              ) : (
                <Text style={styles.apiLocal}>Cihazda — Mapbox harita görüntüsü (3 açı)</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

type SheetProps = PipelineContentProps & {
  /** Pipeline aktif — bar veya sheet göster */
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
};

/** Alt bar (kapalı) + açılabilir bottom sheet (tüm adımlar) */
export function DroneProductionPipelineSheet({
  active,
  open,
  onOpenChange,
  busy,
  activeStepId,
  completedStepIds,
  detail,
  errorMessage,
  steps = DRONE_VIDEO_PRODUCTION_STEPS,
}: SheetProps) {
  const insets = useSafeAreaInsets();

  const activeStep = useMemo(
    () => steps.find((s) => s.id === activeStepId) ?? null,
    [steps, activeStepId],
  );

  const summary = useMemo(() => {
    if (errorMessage) return errorMessage;
    if (detail) return detail;
    if (activeStep) return activeStep.title;
    return "Üretim süreci";
  }, [errorMessage, detail, activeStep]);

  if (!active) return null;

  return (
    <>
      {!open ? (
        <TouchableOpacity
          style={[styles.collapsedBar, { paddingBottom: sheetScrollBottomPadding(insets.bottom, 10) }]}
          onPress={() => onOpenChange(true)}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Üretim sürecini aç"
        >
          <View style={styles.collapsedLeft}>
            {busy ? (
              <ActivityIndicator size="small" color={AI_DRONE_EDITOR_THEME.primaryBright} />
            ) : (
              <Ionicons name="list-outline" size={20} color={AI_DRONE_EDITOR_THEME.primaryBright} />
            )}
            <View style={styles.collapsedTextWrap}>
              <Text style={styles.collapsedTitle}>Üretim süreci</Text>
              <Text style={styles.collapsedSubtitle} numberOfLines={1}>
                {completedStepIds.size}/{steps.length} · {summary}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-up" size={20} color={AI_DRONE_EDITOR_THEME.mutedOnDark} />
        </TouchableOpacity>
      ) : null}

      <AppBottomSheetModal
        visible={open}
        onClose={() => onOpenChange(false)}
        variant="dark"
        snapPoints={["58%", "88%"]}
        initialIndex={0}
        enablePanDownToClose
        backdropPressBehavior="close"
        backdropOpacity={0.35}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.sheetScroll, { paddingBottom: sheetScrollBottomPadding(insets.bottom, 16) }]}
          showsVerticalScrollIndicator
        >
          <DroneProductionPipelineContent
            activeStepId={activeStepId}
            completedStepIds={completedStepIds}
            detail={detail}
            errorMessage={errorMessage}
            steps={steps}
          />
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </>
  );
}

/** @deprecated DroneProductionPipelineSheet kullanın */
export function DroneProductionPipelinePanel(props: PipelineContentProps & { visible: boolean }) {
  if (!props.visible) return null;
  return (
    <View style={styles.legacyWrap}>
      <DroneProductionPipelineContent
        activeStepId={props.activeStepId}
        completedStepIds={props.completedStepIds}
        detail={props.detail}
        errorMessage={props.errorMessage}
        steps={props.steps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0f172a",
    borderTopWidth: 3,
    borderTopColor: "#3b82f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  collapsedLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 8,
  },
  collapsedTextWrap: { flex: 1, gap: 2 },
  collapsedTitle: {
    color: AI_DRONE_EDITOR_THEME.textOnDark,
    fontSize: 14,
    fontWeight: "800",
  },
  collapsedSubtitle: {
    color: AI_DRONE_EDITOR_THEME.primaryBright,
    fontSize: 12,
    fontWeight: "600",
  },
  sheetScroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  content: { gap: 8 },
  heading: {
    color: AI_DRONE_EDITOR_THEME.textOnDark,
    fontSize: 18,
    fontWeight: "800",
  },
  subheading: {
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 13,
    fontWeight: "600",
  },
  detail: {
    color: AI_DRONE_EDITOR_THEME.primaryBright,
    fontSize: 13,
    fontWeight: "600",
  },
  error: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "600",
  },
  list: { gap: 12, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { width: 22, marginTop: 2 },
  rowText: { flex: 1, gap: 3 },
  title: {
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 14,
    fontWeight: "700",
  },
  titleActive: {
    color: AI_DRONE_EDITOR_THEME.textOnDark,
  },
  api: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "rgba(148, 163, 184, 0.85)",
    lineHeight: 16,
  },
  apiActive: {
    color: AI_DRONE_EDITOR_THEME.primaryBright,
  },
  apiLocal: {
    fontSize: 11,
    color: "rgba(148, 163, 184, 0.75)",
    fontStyle: "italic",
  },
  legacyWrap: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
});
