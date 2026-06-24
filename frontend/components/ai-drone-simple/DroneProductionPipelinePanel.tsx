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
  userFacingPipelineDetail,
} from "../../src/constants/aiDroneProductionPipeline";

export type PipelineStepStatus = "pending" | "active" | "done" | "error";

export type PipelineSlotProgressItem = {
  slot: number;
  percent: number;
  status: PipelineStepStatus;
  label?: string;
};

type PipelineContentProps = {
  activeStepId: DroneProductionStepId | null;
  completedStepIds: ReadonlySet<DroneProductionStepId>;
  detail?: string;
  errorMessage?: string;
  steps?: DroneProductionStepDef[];
  slotProgress?: PipelineSlotProgressItem[];
  /** Arka plan modunda kare kutularını gizle (yüzde güncellenmez) */
  hideSlotProgress?: boolean;
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

function SlotProgressBoxes({ items }: { items: PipelineSlotProgressItem[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.slotGrid} accessibilityRole="progressbar">
      {items.map((item) => {
        const barColor =
          item.status === "done"
            ? "#4ade80"
            : item.status === "failed"
              ? "#f87171"
              : item.status === "active"
                ? AI_DRONE_EDITOR_THEME.primaryBright
                : "rgba(148, 163, 184, 0.45)";
        const borderColor =
          item.status === "active" ? AI_DRONE_EDITOR_THEME.primaryBright : "rgba(56, 189, 248, 0.25)";
        return (
          <View key={item.slot} style={[styles.slotCard, { borderColor }]}>
            <Text style={styles.slotTitle}>Kare {item.slot}</Text>
            <View style={styles.slotBarTrack}>
              <View style={[styles.slotBarFill, { width: `${item.percent}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.slotPercent}>%{item.percent}</Text>
            {item.label && item.status === "active" ? (
              <Text style={styles.slotLabel} numberOfLines={2}>
                {userFacingPipelineDetail(item.label, "Video karesi hazırlanıyor…")}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Tüm adımlar — sheet içinde kaydırılabilir */
export function DroneProductionPipelineContent({
  activeStepId,
  completedStepIds,
  detail,
  errorMessage,
  steps = DRONE_VIDEO_PRODUCTION_STEPS,
  slotProgress,
  hideSlotProgress = false,
}: PipelineContentProps) {
  const rows = useMemo(
    () =>
      steps.map((step) => ({
        step,
        status: statusFor(step.id, activeStepId, completedStepIds, errorMessage),
      })),
    [steps, activeStepId, completedStepIds, errorMessage],
  );

  const showSlotProgress =
    !hideSlotProgress &&
    slotProgress &&
    slotProgress.length > 0 &&
    (activeStepId === "polling" || activeStepId === "production");

  return (
    <View style={styles.content} accessibilityRole="summary">
      <Text style={styles.heading}>Üretim süreci</Text>
      <Text style={styles.subheading}>
        {completedStepIds.size}/{steps.length} adım tamamlandı
      </Text>
      {detail ? (
        <Text style={styles.detail}>{userFacingPipelineDetail(detail, "İşleniyor…")}</Text>
      ) : null}
      {showSlotProgress ? <SlotProgressBoxes items={slotProgress!} /> : null}
      {errorMessage ? (
        <Text style={styles.error}>{userFacingPipelineDetail(errorMessage, "İşlem tamamlanamadı.")}</Text>
      ) : null}
      <View style={styles.list}>
        {rows.map(({ step, status }) => (
          <View key={step.id} style={styles.row}>
            <StepIcon status={status} />
            <View style={styles.rowText}>
              <Text style={[styles.title, status === "active" && styles.titleActive]}>{step.title}</Text>
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
  slotProgress,
  hideSlotProgress,
}: SheetProps) {
  const insets = useSafeAreaInsets();

  const activeStep = useMemo(
    () => steps.find((s) => s.id === activeStepId) ?? null,
    [steps, activeStepId],
  );

  const summary = useMemo(() => {
    if (errorMessage) return userFacingPipelineDetail(errorMessage, "İşlem tamamlanamadı.");
    if (detail) return userFacingPipelineDetail(detail, "İşleniyor…");
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
            slotProgress={slotProgress}
            hideSlotProgress={hideSlotProgress}
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
  rowText: { flex: 1 },
  title: {
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 14,
    fontWeight: "700",
  },
  titleActive: {
    color: AI_DRONE_EDITOR_THEME.textOnDark,
  },
  legacyWrap: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  slotCard: {
    width: "31%",
    minWidth: 96,
    flexGrow: 1,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    gap: 4,
  },
  slotTitle: {
    color: AI_DRONE_EDITOR_THEME.textOnDark,
    fontSize: 11,
    fontWeight: "800",
  },
  slotBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.25)",
    overflow: "hidden",
  },
  slotBarFill: {
    height: 4,
    borderRadius: 2,
  },
  slotPercent: {
    color: AI_DRONE_EDITOR_THEME.primaryBright,
    fontSize: 12,
    fontWeight: "800",
  },
  slotLabel: {
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
  },
});
