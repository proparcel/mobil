import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSmartQueryAudioRecorder } from "./useSmartQueryAudioRecorder";
import { extractVoiceRegistrationField } from "../../services/voiceRegistrationService";
import type {
  VoiceRegistrationContext,
  VoiceRegistrationField,
  VoiceRegistrationFormPatch,
  VoiceRegistrationPendingReview,
  VoiceRegistrationStepConfig,
  VoiceRegistrationWizardState,
} from "../types/voiceRegistration";
import {
  buildFormPatchFromVoiceField,
  buildVoiceRegistrationResultSummary,
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
const MIN_WALL_RECORDING_MS = 800;

type UseVoiceRegistrationWizardOptions = {
  visible: boolean;
  context: VoiceRegistrationContext;
  onFieldResolved: (patch: VoiceRegistrationFormPatch, field: VoiceRegistrationField) => void;
  onCompleted: () => void;
  onClose: () => void;
};

function maskValueForLog(field: VoiceRegistrationField, value: unknown): unknown {
  if (field === "phone") return maskPhoneForLog(String(value || ""));
  if (field === "email") return maskEmailForLog(String(value || ""));
  if (field === "spk_tc_no") return maskIdForLog(String(value || ""));
  return value;
}

function showErrorReview(message: string): VoiceRegistrationPendingReview {
  return { status: "error", message };
}

export function useVoiceRegistrationWizard(options: UseVoiceRegistrationWizardOptions) {
  const { visible, context, onFieldResolved, onCompleted, onClose } = options;
  const voiceRecorder = useSmartQueryAudioRecorder();
  const steps = useMemo(() => buildVoiceRegistrationSteps(context), [context]);
  const [stepIndex, setStepIndex] = useState(0);
  const [wizardState, setWizardState] = useState<VoiceRegistrationWizardState>("idle");
  const [pendingReview, setPendingReview] = useState<VoiceRegistrationPendingReview | null>(null);
  const pendingReviewRef = useRef<VoiceRegistrationPendingReview | null>(null);
  const autoRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  const currentStep: VoiceRegistrationStepConfig | undefined = steps[stepIndex];

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
    setStepIndex(0);
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
    setStepIndex(0);
    setWizardState("idle");
    setPendingReview(null);
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

  const scheduleAutoRecord = useCallback(
    (delayMs = AUTO_RECORD_DELAY_MS, force = false) => {
      clearAutoRecordTimer();
      if (!visible || !currentStep) return;
      if (!force && pendingReviewRef.current) return;
      if (currentStep.inputType === "manual_password") return;

      autoRecordTimerRef.current = setTimeout(async () => {
        if (!force && pendingReviewRef.current) return;
        const started = await voiceRecorder.startRecording();
        if (started) {
          recordingStartedAtRef.current = Date.now();
          setWizardState("listening");
          await appendVoiceQueryDebugLog("recording_auto_started", "voice_registration", {
            field: currentStep.field,
            stepIndex,
          });
        } else {
          setWizardState("idle");
          setPendingReview(
            showErrorReview(
              voiceRecorder.permissionHint ||
                "Sesli üyelik için mikrofon izni gereklidir. Ayarlardan mikrofon izni verebilirsiniz.",
            ),
          );
          await appendVoiceQueryDebugLog("permission_denied", "voice_registration", {});
        }
      }, delayMs);
    },
    [clearAutoRecordTimer, visible, currentStep, voiceRecorder, stepIndex],
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
      clearAutoRecordTimer();
      setWizardState("completed");
      return;
    }

    if (!pendingReview) {
      scheduleAutoRecord();
    }
    return () => clearAutoRecordTimer();
  }, [visible, stepIndex, currentStep?.field, currentStep?.inputType]);

  const goToNextStep = useCallback(() => {
    setPendingReview(null);
    setStepIndex((prev) => {
      const next = prev + 1;
      if (next >= steps.length) return prev;
      return next;
    });
    setWizardState("idle");
  }, [steps.length]);

  const presentSuccessReview = useCallback(
    (
      field: VoiceRegistrationField,
      resolvedValue: unknown,
      patch: VoiceRegistrationFormPatch,
      locationResolved?: Parameters<typeof buildFormPatchFromVoiceField>[2],
    ) => {
      clearAutoRecordTimer();
      void voiceRecorder.clearRecording();
      setWizardState("idle");
      setPendingReview({
        status: "success",
        summary: buildVoiceRegistrationResultSummary(
          field,
          field === "location" ? locationResolved ?? resolvedValue : resolvedValue,
        ),
        patch,
        field,
      });
    },
    [clearAutoRecordTimer, voiceRecorder],
  );

  const presentErrorReview = useCallback(
    (message: string) => {
      clearAutoRecordTimer();
      void voiceRecorder.clearRecording();
      setWizardState("idle");
      setPendingReview(showErrorReview(message));
    },
    [clearAutoRecordTimer, voiceRecorder],
  );

  const processFieldResult = useCallback(
    async (field: VoiceRegistrationField, apiData: { value?: unknown; raw_text?: string; message?: string | null }) => {
      let resolvedValue = apiData.value;

      if (field === "phone") {
        resolvedValue = resolveVoiceRegistrationPhoneValue(
          apiData.value,
          apiData.raw_text,
          (apiData as { debug_normalized?: string | null }).debug_normalized,
        );
      }

      if (field === "email") {
        resolvedValue = resolveVoiceRegistrationEmailValue(
          apiData.value,
          apiData.raw_text,
          (apiData as { debug_normalized?: string | null }).debug_normalized,
        );
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
          presentErrorReview(locResult.error);
          await appendVoiceQueryDebugLog("field_invalid", "voice_registration", {
            field,
            error: locResult.error,
          });
          return;
        }
        resolvedValue = locResult.location;
        locationResolved = locResult.location;
      }

      const localCheck = validateVoiceFieldLocally(field, resolvedValue, context);
      if (!localCheck.ok) {
        presentErrorReview(localCheck.message);
        await appendVoiceQueryDebugLog("field_invalid", "voice_registration", {
          field,
          error: localCheck.message,
        });
        await logVoiceRegistrationLocalValidationFailed(field, {
          value: resolvedValue,
          rawText: apiData.raw_text,
          error: localCheck.message,
        });
        return;
      }

      const patch = buildFormPatchFromVoiceField(
        field,
        resolvedValue,
        field === "location" ? locationResolved : undefined,
      );

      await appendVoiceQueryDebugLog("field_resolved", "voice_registration", {
        field,
        value: maskValueForLog(field, resolvedValue),
      });

      presentSuccessReview(field, resolvedValue, patch, locationResolved);
    },
    [context, presentErrorReview, presentSuccessReview],
  );

  const handleAcceptReview = useCallback(() => {
    if (pendingReview?.status !== "success") return;
    onFieldResolved(pendingReview.patch, pendingReview.field);
    void appendVoiceQueryDebugLog("step_completed", "voice_registration", {
      field: pendingReview.field,
      stepIndex,
    });
    goToNextStep();
  }, [pendingReview, onFieldResolved, stepIndex, goToNextStep]);

  const handleConfirm = useCallback(async () => {
    if (!currentStep || wizardState === "processing") return;
    if (currentStep.inputType === "manual_password") return;

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
      await appendVoiceQueryDebugLog("recording_stopped_by_confirm", "voice_registration", {
        field: currentStep.field,
      });
      const wallDuration = wallStart != null ? Date.now() - wallStart : null;
      if (wallDuration != null && wallDuration < MIN_WALL_RECORDING_MS) {
        presentErrorReview("Ses çok kısa algılandı. Lütfen cevabınızı tekrar söyleyin.");
        await appendVoiceQueryDebugLog("audio_too_short", "voice_registration", {
          field: currentStep.field,
          wallDurationMs: wallDuration,
        });
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
      currentStep.field,
      recording.base64,
      recording.mimeType,
      context,
    );

    if (!response.ok || !response.data) {
      presentErrorReview(response.error || NETWORK_ERROR_FALLBACK);
      return;
    }

    if (currentStep.field === "phone") {
      const resolved = resolveVoiceRegistrationPhoneValue(
        response.data.value,
        response.data.raw_text,
        response.data.debug_normalized,
      );
      if (validateVoiceRegistrationPhone(resolved)) {
        if (!response.data.is_valid || response.data.ok === false) {
          await logVoiceRegistrationRecovery("phone", {
            rawText: response.data.raw_text || "",
            recoveredValue: resolved,
          });
        }
        await processFieldResult("phone", {
          value: resolved,
          raw_text: response.data.raw_text,
        });
        return;
      }

      presentErrorReview(
        response.data.message ||
          response.data.error ||
          "Telefon numarası doğru algılanamadı. Lütfen numaranızı tekrar söyleyin.",
      );
      await appendVoiceQueryDebugLog("field_invalid", "voice_registration", {
        field: currentStep.field,
        error: response.data.error,
        raw_text: response.data.raw_text,
        message: response.data.message,
        debug_normalized: response.data.debug_normalized,
      });
      return;
    }

    if (currentStep.field === "email") {
      const resolved = resolveVoiceRegistrationEmailValue(
        response.data.value,
        response.data.raw_text,
        response.data.debug_normalized,
      );
      if (validateVoiceRegistrationEmail(resolved)) {
        if (!response.data.is_valid || response.data.ok === false) {
          await logVoiceRegistrationRecovery("email", {
            rawText: response.data.raw_text || "",
            recoveredValue: resolved,
          });
        }
        await processFieldResult("email", {
          value: resolved,
          raw_text: response.data.raw_text,
          debug_normalized: response.data.debug_normalized,
        });
        return;
      }

      presentErrorReview(
        response.data.message ||
          response.data.error ||
          "E-posta adresi doğru algılanamadı. Lütfen tekrar söyleyin.",
      );
      await appendVoiceQueryDebugLog("field_invalid", "voice_registration", {
        field: currentStep.field,
        error: response.data.error,
        raw_text: response.data.raw_text,
        message: response.data.message,
        debug_normalized: response.data.debug_normalized,
      });
      return;
    }

    if (!response.data.is_valid || response.data.ok === false) {

      presentErrorReview(
        response.data.message ||
          response.data.error ||
          "Alan doğrulanamadı. Lütfen tekrar söyleyin.",
      );
      await appendVoiceQueryDebugLog("field_invalid", "voice_registration", {
        field: currentStep.field,
        error: response.data.error,
        raw_text: response.data.raw_text,
        message: response.data.message,
        debug_normalized: (response.data as { debug_normalized?: string }).debug_normalized,
      });
      return;
    }

    await processFieldResult(currentStep.field, response.data);
  }, [
    currentStep,
    wizardState,
    pendingReview,
    clearAutoRecordTimer,
    voiceRecorder,
    context,
    processFieldResult,
    handleAcceptReview,
    presentErrorReview,
  ]);

  const handleSkip = useCallback(async () => {
    if (!currentStep?.optional) return;
    clearAutoRecordTimer();
    if (voiceRecorder.isRecording) {
      await voiceRecorder.clearRecording();
    }
    if (currentStep.field === "phone") {
      onFieldResolved({}, "phone");
    }
    if (currentStep.field === "company_name") {
      onFieldResolved({ companyName: "" }, "company_name");
    }
    setPendingReview(null);
    goToNextStep();
  }, [currentStep, clearAutoRecordTimer, voiceRecorder, onFieldResolved, goToNextStep]);

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

  const handleBack = useCallback(async () => {
    clearAutoRecordTimer();
    if (voiceRecorder.isRecording) {
      await voiceRecorder.clearRecording();
    }
    setPendingReview(null);
    setStepIndex((prev) => Math.max(0, prev - 1));
    setWizardState("idle");
  }, [clearAutoRecordTimer, voiceRecorder]);

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
    pendingReview,
    voiceRecorder,
    handleConfirm,
    handleAcceptReview,
    handleSkip,
    handleRetry,
    handleBack,
    handleCancel,
    totalSteps: steps.length,
  };
}

const NETWORK_ERROR_FALLBACK =
  "Sesli işlem sırasında bağlantı sorunu oluştu. Lütfen tekrar deneyin.";
