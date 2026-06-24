import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSmartQueryAudioRecorder } from "./useSmartQueryAudioRecorder";
import { extractVoiceRegistrationField } from "../../services/voiceRegistrationService";
import type { RegistrationExpertiseValue } from "../../components/auth/RegistrationExpertiseStep";
import type { VoiceRegistrationContext } from "../types/voiceRegistration";
import { appendVoiceQueryDebugLog } from "../utils/voiceQueryDebugLog";
import {
  applyExpertiseCityFromVoice,
  applyExpertiseQuarterFromLocation,
  resolveExpertiseTargetFromApiValue,
} from "../utils/voiceExpertiseResolve";

const AUTO_RECORD_DELAY_MS = 400;
const MIN_WALL_RECORDING_MS = 800;
const NETWORK_ERROR_FALLBACK =
  "Sesli işlem sırasında bağlantı sorunu oluştu. Lütfen tekrar deneyin.";

export type VoiceExpertisePendingReview =
  | { status: "success"; summary: string; nextValue: RegistrationExpertiseValue }
  | { status: "error"; message: string };

type UseVoiceExpertiseLocationWizardOptions = {
  visible: boolean;
  mode: "quarters" | "cities";
  context: VoiceRegistrationContext;
  currentValue: RegistrationExpertiseValue;
  onApply: (next: RegistrationExpertiseValue) => void;
  onClose: () => void;
};

function showErrorReview(message: string): VoiceExpertisePendingReview {
  return { status: "error", message };
}

export function useVoiceExpertiseLocationWizard(options: UseVoiceExpertiseLocationWizardOptions) {
  const { visible, mode, context, currentValue, onApply, onClose } = options;
  const voiceRecorder = useSmartQueryAudioRecorder();
  const [wizardState, setWizardState] = useState<"idle" | "listening" | "processing">("idle");
  const [pendingReview, setPendingReview] = useState<VoiceExpertisePendingReview | null>(null);
  const pendingReviewRef = useRef<VoiceExpertisePendingReview | null>(null);
  const autoRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const currentValueRef = useRef(currentValue);

  const prompt = useMemo(
    () =>
      mode === "cities"
        ? "Uzmanlık ilinizi söyleyin."
        : "İl, ilçe ve mahalle bilginizi söyleyin.",
    [mode],
  );

  const selectedCount = mode === "cities" ? currentValue.cities.length : currentValue.quarters.length;
  const isFull = selectedCount >= 5;

  const progressStep = useMemo(() => {
    if (pendingReview?.status === "success") {
      return mode === "cities"
        ? pendingReview.nextValue.cities.length
        : pendingReview.nextValue.quarters.length;
    }
    if (isFull) return 5;
    return Math.min(selectedCount + 1, 5);
  }, [pendingReview, mode, isFull, selectedCount]);

  useEffect(() => {
    currentValueRef.current = currentValue;
  }, [currentValue]);

  useEffect(() => {
    pendingReviewRef.current = pendingReview;
  }, [pendingReview]);

  const clearAutoRecordTimer = useCallback(() => {
    if (autoRecordTimerRef.current) {
      clearTimeout(autoRecordTimerRef.current);
      autoRecordTimerRef.current = null;
    }
  }, []);

  const resetWizard = useCallback(() => {
    clearAutoRecordTimer();
    setWizardState("idle");
    pendingReviewRef.current = null;
    setPendingReview(null);
    recordingStartedAtRef.current = null;
    void voiceRecorder.clearRecording();
  }, [clearAutoRecordTimer, voiceRecorder]);

  useEffect(() => {
    if (!visible) {
      resetWizard();
      return;
    }
    setWizardState("idle");
    setPendingReview(null);
    void voiceRecorder.clearRecording();
    void appendVoiceQueryDebugLog("wizard_opened", "voice_expertise", {
      mode,
      memberType: context.memberType,
      corporateType: context.corporateType,
    });
  }, [visible]);

  const scheduleAutoRecord = useCallback(
    (delayMs = AUTO_RECORD_DELAY_MS, force = false) => {
      clearAutoRecordTimer();
      if (!visible || isFull) return;
      if (!force && pendingReviewRef.current) return;

      autoRecordTimerRef.current = setTimeout(async () => {
        if (!force && pendingReviewRef.current) return;
        const started = await voiceRecorder.startRecording();
        if (started) {
          recordingStartedAtRef.current = Date.now();
          setWizardState("listening");
          await appendVoiceQueryDebugLog("recording_auto_started", "voice_expertise", { mode });
        } else {
          setWizardState("idle");
          setPendingReview(
            showErrorReview(
              voiceRecorder.permissionHint ||
                "Sesli bölge seçimi için mikrofon izni gereklidir. Ayarlardan mikrofon izni verebilirsiniz.",
            ),
          );
        }
      }, delayMs);
    },
    [clearAutoRecordTimer, visible, isFull, voiceRecorder, mode],
  );

  useEffect(() => {
    if (!visible || isFull) return;
    if (!pendingReview) {
      scheduleAutoRecord();
    }
    return () => clearAutoRecordTimer();
  }, [visible, isFull, pendingReview]);

  const presentErrorReview = useCallback(
    (message: string) => {
      clearAutoRecordTimer();
      void voiceRecorder.clearRecording();
      setWizardState("idle");
      setPendingReview(showErrorReview(message));
    },
    [clearAutoRecordTimer, voiceRecorder],
  );

  const processLocationResult = useCallback(
    async (apiData: { value?: unknown; raw_text?: string; message?: string | null }) => {
      const target = await resolveExpertiseTargetFromApiValue(mode, apiData.value, apiData.raw_text);
      if (!target.ok) {
        presentErrorReview(apiData.message || target.error);
        return;
      }

      const applyResult =
        target.kind === "quarter"
          ? applyExpertiseQuarterFromLocation(currentValueRef.current, target.location)
          : applyExpertiseCityFromVoice(
              currentValueRef.current,
              target.cityId,
              target.cityName,
            );

      if (!applyResult.ok) {
        presentErrorReview(applyResult.error);
        return;
      }

      clearAutoRecordTimer();
      void voiceRecorder.clearRecording();
      setWizardState("idle");
      setPendingReview({
        status: "success",
        summary: applyResult.summary,
        nextValue: applyResult.value,
      });
    },
    [mode, presentErrorReview, clearAutoRecordTimer, voiceRecorder],
  );

  const handleAcceptReview = useCallback(() => {
    if (pendingReview?.status !== "success") return;
    onApply(pendingReview.nextValue);
    pendingReviewRef.current = null;
    setPendingReview(null);
    setWizardState("idle");
    const nextCount =
      mode === "cities"
        ? pendingReview.nextValue.cities.length
        : pendingReview.nextValue.quarters.length;
    if (nextCount < 5) {
      scheduleAutoRecord(300, true);
    }
  }, [pendingReview, onApply, mode, scheduleAutoRecord]);

  const handleConfirm = useCallback(async () => {
    if (wizardState === "processing" || isFull) return;

    if (pendingReview?.status === "success") {
      handleAcceptReview();
      return;
    }

    if (pendingReview?.status === "error") {
      return;
    }

    clearAutoRecordTimer();

    let recording = null;
    if (voiceRecorder.isRecording) {
      const wallStart = recordingStartedAtRef.current;
      recording = await voiceRecorder.stopRecording();
      const wallDuration = wallStart != null ? Date.now() - wallStart : null;
      if (wallDuration != null && wallDuration < MIN_WALL_RECORDING_MS) {
        presentErrorReview("Ses çok kısa algılandı. Lütfen cevabınızı tekrar söyleyin.");
        return;
      }
    } else {
      recording = await voiceRecorder.getRecordingPayload();
    }

    if (!recording?.base64) {
      presentErrorReview("Lütfen cevabınızı söyleyin ve Tamam'a basın.");
      return;
    }

    setWizardState("processing");
    setPendingReview(null);

    const response = await extractVoiceRegistrationField(
      "location",
      recording.base64,
      recording.mimeType,
      context,
    );

    if (!response.ok || !response.data) {
      presentErrorReview(response.error || NETWORK_ERROR_FALLBACK);
      return;
    }

    if (!response.data.is_valid || response.data.ok === false) {
      presentErrorReview(
        response.data.message ||
          response.data.error ||
          "Konum doğrulanamadı. Lütfen tekrar söyleyin.",
      );
      return;
    }

    await processLocationResult(response.data);
    setWizardState("idle");
  }, [
    wizardState,
    isFull,
    pendingReview,
    clearAutoRecordTimer,
    voiceRecorder,
    context,
    processLocationResult,
    handleAcceptReview,
    presentErrorReview,
  ]);

  const handleRetry = useCallback(async () => {
    clearAutoRecordTimer();
    if (voiceRecorder.isRecording) {
      await voiceRecorder.clearRecording();
    }
    pendingReviewRef.current = null;
    setPendingReview(null);
    setWizardState("idle");
    scheduleAutoRecord(200, true);
  }, [voiceRecorder, scheduleAutoRecord, clearAutoRecordTimer]);

  const handleCancel = useCallback(async () => {
    clearAutoRecordTimer();
    if (voiceRecorder.isRecording) {
      await voiceRecorder.clearRecording();
    }
    onClose();
  }, [clearAutoRecordTimer, voiceRecorder, onClose]);

  return {
    prompt,
    wizardState,
    pendingReview,
    voiceRecorder,
    isFull,
    progressStep,
    handleConfirm,
    handleAcceptReview,
    handleRetry,
    handleCancel,
  };
}
