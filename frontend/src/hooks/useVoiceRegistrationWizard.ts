import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSmartQueryAudioRecorder } from "./useSmartQueryAudioRecorder";
import { extractVoiceRegistrationField } from "../../services/voiceRegistrationService";
import type {
  VoiceRegistrationBatchFailure,
  VoiceRegistrationBatchResult,
  VoiceRegistrationBatchSuccess,
  VoiceRegistrationContext,
  VoiceRegistrationField,
  VoiceRegistrationFormPatch,
  VoiceRegistrationStepConfig,
  VoiceRegistrationWizardState,
} from "../types/voiceRegistration";
import {
  buildFormPatchFromVoiceField,
  buildVoiceRegistrationSteps,
  resolveVoiceRegistrationLocation,
  validateVoiceFieldLocally,
} from "../utils/voiceRegistrationResolve";
import {
  maskEmailForLog,
  maskIdForLog,
  maskPhoneForLog,
  resolveVoiceRegistrationEmailValue,
  resolveVoiceRegistrationPhoneValue,
  validateVoiceRegistrationEmail,
  validateVoiceRegistrationPhone,
} from "../utils/voiceRegistrationValidators";
import { appendVoiceQueryDebugLog } from "../utils/voiceQueryDebugLog";
import {
  appendVoiceRegistrationDebugLog,
  logVoiceRegistrationLocalValidationFailed,
  logVoiceRegistrationRecovery,
  logVoiceRegistrationSessionStart,
} from "../utils/voiceRegistrationDebugLog";

const AUTO_RECORD_DELAY_MS = 400;
const MIN_SEGMENT_MS = 800;

const NETWORK_ERROR_FALLBACK =
  "Sesli işlem sırasında bağlantı sorunu oluştu. Lütfen tekrar deneyin.";

type SegmentPayload = {
  field: VoiceRegistrationField;
  base64: string;
  mimeType: string;
};

type UseVoiceRegistrationWizardOptions = {
  visible: boolean;
  context: VoiceRegistrationContext;
  onBatchCompleted: (result: VoiceRegistrationBatchResult) => void;
  onClose: () => void;
};

function maskValueForLog(field: VoiceRegistrationField, value: unknown): unknown {
  if (field === "phone") return maskPhoneForLog(String(value || ""));
  if (field === "email") return maskEmailForLog(String(value || ""));
  if (field === "spk_tc_no") return maskIdForLog(String(value || ""));
  return value;
}

function isVoiceStep(step: VoiceRegistrationStepConfig | undefined): boolean {
  return Boolean(step && step.inputType === "voice");
}

function lastVoiceStepIndex(steps: VoiceRegistrationStepConfig[]): number {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    if (steps[i]?.inputType === "voice") return i;
  }
  return -1;
}

function segmentDurationMs(
  recording: { durationMs?: number | null } | null,
  fallbackMs: number | null,
): number {
  if (recording?.durationMs != null && !Number.isNaN(recording.durationMs)) {
    return recording.durationMs;
  }
  return fallbackMs ?? 0;
}

export function useVoiceRegistrationWizard(options: UseVoiceRegistrationWizardOptions) {
  const { visible, context, onBatchCompleted, onClose } = options;
  const voiceRecorder = useSmartQueryAudioRecorder();
  const steps = useMemo(() => buildVoiceRegistrationSteps(context), [context]);
  const [stepIndex, setStepIndex] = useState(0);
  const [wizardState, setWizardState] = useState<VoiceRegistrationWizardState>("idle");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const autoRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentPayloadsRef = useRef<SegmentPayload[]>([]);
  const flushInProgressRef = useRef(false);

  const currentStep: VoiceRegistrationStepConfig | undefined = steps[stepIndex];
  const lastVoiceIdx = useMemo(() => lastVoiceStepIndex(steps), [steps]);

  const clearAutoRecordTimer = useCallback(() => {
    if (autoRecordTimerRef.current) {
      clearTimeout(autoRecordTimerRef.current);
      autoRecordTimerRef.current = null;
    }
  }, []);

  const resetWizard = useCallback(() => {
    clearAutoRecordTimer();
    setStepIndex(0);
    setWizardState("idle");
    setInlineError(null);
    segmentPayloadsRef.current = [];
    flushInProgressRef.current = false;
    void voiceRecorder.clearRecording();
  }, [clearAutoRecordTimer, voiceRecorder]);

  useEffect(() => {
    if (!visible) {
      resetWizard();
      return;
    }
    setStepIndex(0);
    setWizardState("idle");
    setInlineError(null);
    segmentPayloadsRef.current = [];
    flushInProgressRef.current = false;
    void voiceRecorder.clearRecording();
    void appendVoiceQueryDebugLog("wizard_opened", "voice_registration", {
      memberType: context.memberType,
      corporateType: context.corporateType,
      stepCount: steps.length,
    });
    void logVoiceRegistrationSessionStart({
      memberType: context.memberType,
      corporateType: context.corporateType,
      stepCount: steps.length,
    });
  }, [visible]);

  const ensureRecording = useCallback(async (): Promise<boolean> => {
    if (voiceRecorder.isRecording || voiceRecorder.getRecordingDurationMs() != null) {
      setWizardState("listening");
      return true;
    }
    const started = await voiceRecorder.startRecording(true);
    if (started) {
      setWizardState("listening");
      setInlineError(null);
      return true;
    }
    setWizardState("idle");
    setInlineError(
      voiceRecorder.permissionHint ||
        "Sesli üyelik için mikrofon izni gereklidir. Ayarlardan mikrofon izni verebilirsiniz.",
    );
    await appendVoiceQueryDebugLog("permission_denied", "voice_registration", {});
    return false;
  }, [voiceRecorder]);

  const scheduleAutoRecord = useCallback(
    (delayMs = AUTO_RECORD_DELAY_MS) => {
      clearAutoRecordTimer();
      if (!visible || !isVoiceStep(currentStep)) return;

      autoRecordTimerRef.current = setTimeout(async () => {
        const ok = await ensureRecording();
        if (ok) {
          await appendVoiceQueryDebugLog("recording_auto_started", "voice_registration", {
            field: currentStep?.field,
            stepIndex,
          });
        }
      }, delayMs);
    },
    [clearAutoRecordTimer, visible, currentStep, ensureRecording, stepIndex],
  );

  useEffect(() => {
    if (!visible || !currentStep) return;
    void appendVoiceQueryDebugLog("step_started", "voice_registration", {
      field: currentStep.field,
      stepIndex,
    });
    void appendVoiceRegistrationDebugLog("step_started", {
      field: currentStep.field,
      stepIndex,
      prompt: currentStep.prompt,
    });

    if (currentStep.inputType === "manual_password") {
      return;
    }

    if (!inlineError && wizardState !== "processing") {
      scheduleAutoRecord();
    }
    return () => clearAutoRecordTimer();
  }, [visible, stepIndex, currentStep?.field, currentStep?.inputType]);

  const goToNextStep = useCallback(() => {
    setInlineError(null);
    setStepIndex((prev) => {
      const next = prev + 1;
      if (next >= steps.length) return prev;
      return next;
    });
    setWizardState("listening");
  }, [steps.length]);

  const resolveFieldFromApi = useCallback(
    async (
      field: VoiceRegistrationField,
      apiData: {
        value?: unknown;
        raw_text?: string;
        message?: string | null;
        debug_normalized?: string | null;
        ok?: boolean;
        is_valid?: boolean;
        error?: string;
      },
    ): Promise<
      | { ok: true; patch: VoiceRegistrationFormPatch; resolvedValue: unknown }
      | { ok: false; message: string }
    > => {
      let resolvedValue = apiData.value;

      if (field === "phone") {
        resolvedValue = resolveVoiceRegistrationPhoneValue(
          apiData.value,
          apiData.raw_text,
          apiData.debug_normalized,
        );
        if (validateVoiceRegistrationPhone(resolvedValue)) {
          if (!apiData.is_valid || apiData.ok === false) {
            await logVoiceRegistrationRecovery("phone", {
              rawText: apiData.raw_text || "",
              recoveredValue: resolvedValue,
            });
          }
        } else {
          return {
            ok: false,
            message:
              apiData.message ||
              apiData.error ||
              "Telefon numarası doğru algılanamadı. Lütfen numaranızı tekrar söyleyin.",
          };
        }
      }

      if (field === "email") {
        resolvedValue = resolveVoiceRegistrationEmailValue(
          apiData.value,
          apiData.raw_text,
          apiData.debug_normalized,
        );
        if (validateVoiceRegistrationEmail(resolvedValue)) {
          if (!apiData.is_valid || apiData.ok === false) {
            await logVoiceRegistrationRecovery("email", {
              rawText: apiData.raw_text || "",
              recoveredValue: resolvedValue,
            });
          }
        } else {
          return {
            ok: false,
            message:
              apiData.message ||
              apiData.error ||
              "E-posta adresi doğru algılanamadı. Lütfen tekrar söyleyin.",
          };
        }
      }

      let locationResolved: Parameters<typeof buildFormPatchFromVoiceField>[2];

      if (field === "location") {
        const locResult = await resolveVoiceRegistrationLocation({
          ok: true,
          field: "location",
          value: apiData.value as never,
          raw_text: apiData.raw_text,
        });
        if (!locResult.ok) {
          return { ok: false, message: locResult.error };
        }
        resolvedValue = locResult.location;
        locationResolved = locResult.location;
      }

      if (field !== "phone" && field !== "email") {
        if (!apiData.is_valid || apiData.ok === false) {
          return {
            ok: false,
            message:
              apiData.message ||
              apiData.error ||
              "Alan doğrulanamadı. Lütfen tekrar söyleyin.",
          };
        }
      }

      const localCheck = validateVoiceFieldLocally(field, resolvedValue, context);
      if (!localCheck.ok) {
        await logVoiceRegistrationLocalValidationFailed(field, {
          value: resolvedValue,
          rawText: apiData.raw_text,
          error: localCheck.message,
        });
        return { ok: false, message: localCheck.message };
      }

      const patch = buildFormPatchFromVoiceField(
        field,
        resolvedValue,
        field === "location" ? locationResolved : undefined,
      );

      await appendVoiceQueryDebugLog("field_resolved", "voice_registration", {
        field,
        value: maskValueForLog(field, resolvedValue),
        batch: true,
      });

      return { ok: true, patch, resolvedValue };
    },
    [context],
  );

  const flushVoiceBatch = useCallback(async () => {
    if (flushInProgressRef.current) return;
    flushInProgressRef.current = true;
    clearAutoRecordTimer();
    setWizardState("processing");
    setInlineError(null);

    const payloads = [...segmentPayloadsRef.current];
    await appendVoiceRegistrationDebugLog("batch_flush_start", {
      payloadCount: payloads.length,
      fields: payloads.map((p) => p.field),
    });

    const successes: VoiceRegistrationBatchSuccess[] = [];
    const failures: VoiceRegistrationBatchFailure[] = [];

    if (payloads.length === 0) {
      flushInProgressRef.current = false;
      setWizardState("idle");
      setInlineError("Ses kaydı bulunamadı. Lütfen soruları sesli yanıtlayın.");
      return;
    }

    try {
      const apiResponses = await Promise.all(
        payloads.map((payload) =>
          extractVoiceRegistrationField(
            payload.field,
            payload.base64,
            payload.mimeType,
            context,
          ),
        ),
      );

      for (let i = 0; i < payloads.length; i += 1) {
        const payload = payloads[i];
        const response = apiResponses[i];

        if (!response.ok || !response.data) {
          failures.push({
            field: payload.field,
            message: response.error || NETWORK_ERROR_FALLBACK,
          });
          continue;
        }

        const resolved = await resolveFieldFromApi(payload.field, response.data);
        if (!resolved.ok) {
          failures.push({ field: payload.field, message: resolved.message });
          await appendVoiceQueryDebugLog("field_invalid", "voice_registration", {
            field: payload.field,
            error: resolved.message,
            batch: true,
          });
          continue;
        }

        successes.push({ field: payload.field, patch: resolved.patch });
        await appendVoiceQueryDebugLog("step_completed", "voice_registration", {
          field: payload.field,
          batch: true,
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Ses işlenirken bir hata oluştu.";
      await appendVoiceRegistrationDebugLog("batch_flush_failed", { message });
      payloads.forEach((payload) => {
        failures.push({ field: payload.field, message });
      });
    }

    await appendVoiceRegistrationDebugLog("batch_flush_done", {
      successCount: successes.length,
      failureCount: failures.length,
    });

    flushInProgressRef.current = false;
    onBatchCompleted({ successes, failures });
  }, [clearAutoRecordTimer, context, resolveFieldFromApi, onBatchCompleted]);

  const captureCurrentSegment = useCallback(async (): Promise<
    { ok: true; payload: SegmentPayload } | { ok: false; message: string }
  > => {
    if (!currentStep) {
      return { ok: false, message: "Geçerli adım bulunamadı." };
    }

    const preStopDuration = voiceRecorder.getRecordingDurationMs();
    const recording = await voiceRecorder.stopRecording();
    const duration = segmentDurationMs(recording, preStopDuration);

    if (!recording?.base64) {
      await ensureRecording();
      return { ok: false, message: "Lütfen cevabınızı söyleyin ve Tamam'a basın." };
    }

    if (duration < MIN_SEGMENT_MS) {
      await ensureRecording();
      await appendVoiceQueryDebugLog("audio_too_short", "voice_registration", {
        field: currentStep.field,
        segmentDurationMs: duration,
      });
      return { ok: false, message: "Ses çok kısa algılandı. Lütfen cevabınızı tekrar söyleyin." };
    }

    const payload: SegmentPayload = {
      field: currentStep.field,
      base64: recording.base64,
      mimeType: recording.mimeType,
    };

    await appendVoiceQueryDebugLog("segment_captured", "voice_registration", {
      field: currentStep.field,
      durationMs: duration,
      stepIndex,
      base64Length: recording.base64.length,
    });

    return { ok: true, payload };
  }, [currentStep, voiceRecorder, ensureRecording, stepIndex]);

  const handleConfirm = useCallback(async () => {
    if (!currentStep || wizardState === "processing" || flushInProgressRef.current) return;
    if (currentStep.inputType === "manual_password") return;

    const sessionBlocked =
      inlineError &&
      (inlineError.includes("mikrofon") ||
        inlineError.includes("Kayıt") ||
        inlineError.includes("Ses kaydı"));
    if (sessionBlocked) return;

    clearAutoRecordTimer();
    setInlineError(null);

    const captured = await captureCurrentSegment();
    if (!captured.ok) {
      setInlineError(captured.message);
      return;
    }

    segmentPayloadsRef.current.push(captured.payload);

    const isLastVoice = stepIndex >= lastVoiceIdx;

    if (isLastVoice) {
      await flushVoiceBatch();
      return;
    }

    const restarted = await voiceRecorder.startRecording(true);
    if (!restarted) {
      segmentPayloadsRef.current.pop();
      setInlineError(
        voiceRecorder.permissionHint ||
          "Sonraki soru için kayıt başlatılamadı. Lütfen tekrar deneyin.",
      );
      return;
    }

    setWizardState("listening");
    goToNextStep();
  }, [
    currentStep,
    wizardState,
    inlineError,
    clearAutoRecordTimer,
    captureCurrentSegment,
    stepIndex,
    lastVoiceIdx,
    flushVoiceBatch,
    voiceRecorder,
    goToNextStep,
  ]);

  const handleSkip = useCallback(async () => {
    if (!currentStep?.optional) return;
    clearAutoRecordTimer();
    setInlineError(null);

    if (voiceRecorder.isRecording || voiceRecorder.getRecordingDurationMs() != null) {
      await voiceRecorder.clearRecording();
    }

    const isLastVoice = stepIndex >= lastVoiceIdx;
    if (isLastVoice) {
      await flushVoiceBatch();
      return;
    }

    const restarted = await voiceRecorder.startRecording(true);
    if (!restarted) {
      setInlineError(
        voiceRecorder.permissionHint ||
          "Sonraki soru için kayıt başlatılamadı. Lütfen tekrar deneyin.",
      );
      return;
    }

    goToNextStep();
  }, [
    currentStep,
    clearAutoRecordTimer,
    stepIndex,
    lastVoiceIdx,
    flushVoiceBatch,
    goToNextStep,
    voiceRecorder,
  ]);

  const handleRetry = useCallback(async () => {
    clearAutoRecordTimer();
    setInlineError(null);
    setWizardState("idle");
    segmentPayloadsRef.current = [];
    await voiceRecorder.clearRecording();
    scheduleAutoRecord(200);
  }, [voiceRecorder, scheduleAutoRecord, clearAutoRecordTimer]);

  const handleBack = useCallback(async () => {
    if (stepIndex <= 0) return;
    clearAutoRecordTimer();
    setInlineError(null);

    if (segmentPayloadsRef.current.length > 0) {
      segmentPayloadsRef.current.pop();
    }

    if (voiceRecorder.isRecording || voiceRecorder.getRecordingDurationMs() != null) {
      await voiceRecorder.clearRecording();
    }

    setStepIndex((prev) => Math.max(0, prev - 1));
    setWizardState("listening");
    await ensureRecording();
  }, [stepIndex, clearAutoRecordTimer, ensureRecording, voiceRecorder]);

  const handleCancel = useCallback(async () => {
    clearAutoRecordTimer();
    if (voiceRecorder.isRecording) {
      await voiceRecorder.clearRecording();
    }
    await appendVoiceQueryDebugLog("wizard_cancelled", "voice_registration", {});
    await appendVoiceRegistrationDebugLog("wizard_cancelled", {});
    onClose();
  }, [clearAutoRecordTimer, voiceRecorder, onClose]);

  return {
    steps,
    stepIndex,
    currentStep,
    wizardState,
    inlineError,
    voiceRecorder,
    handleConfirm,
    handleSkip,
    handleRetry,
    handleBack,
    handleCancel,
    totalSteps: steps.length,
  };
}
