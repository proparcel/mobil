import { Platform } from "react-native";
import RNFS from "react-native-fs";
import { DJANGO_API_URL } from "../../config/api";
import {
  maskEmailForLog,
  maskIdForLog,
  maskPhoneForLog,
  normalizeVoiceRegistrationEmailFromSpeech,
} from "./voiceRegistrationValidators";
import type { VoiceRegistrationExtractResult, VoiceRegistrationField } from "../types/voiceRegistration";

/** Sesli üyelik odaklı debug günlüğü (JSON Lines). */
export const VOICE_REGISTRATION_DEBUG_LOG_PATH = `${RNFS.DocumentDirectoryPath}/voice-registration-debug.log`;

const MAX_LOG_BYTES = 768 * 1024;
const MAX_SHARE_LINES = 80;

export type VoiceRegistrationDebugEvent =
  | "session_start"
  | "step_started"
  | "recording_started"
  | "recording_stopped"
  | "audio_too_short"
  | "api_request"
  | "api_response"
  | "api_http_error"
  | "api_parse_error"
  | "extraction_failed"
  | "local_validation_failed"
  | "field_resolved"
  | "recovery_success"
  | "network_error"
  | "permission_denied"
  | "wizard_cancelled"
  | "wizard_completed";

type LogPayload = Record<string, unknown>;

async function trimLogIfNeeded(): Promise<void> {
  const exists = await RNFS.exists(VOICE_REGISTRATION_DEBUG_LOG_PATH);
  if (!exists) return;

  const stat = await RNFS.stat(VOICE_REGISTRATION_DEBUG_LOG_PATH);
  if (stat.size <= MAX_LOG_BYTES) return;

  const content = await RNFS.readFile(VOICE_REGISTRATION_DEBUG_LOG_PATH, "utf8");
  const trimmed = content.slice(-Math.floor(MAX_LOG_BYTES / 2));
  await RNFS.writeFile(VOICE_REGISTRATION_DEBUG_LOG_PATH, trimmed, "utf8");
}

export function getVoiceRegistrationDebugLogPath(): string {
  return VOICE_REGISTRATION_DEBUG_LOG_PATH;
}

export async function readVoiceRegistrationDebugLog(): Promise<string> {
  try {
    if (!(await RNFS.exists(VOICE_REGISTRATION_DEBUG_LOG_PATH))) return "";
    return await RNFS.readFile(VOICE_REGISTRATION_DEBUG_LOG_PATH, "utf8");
  } catch {
    return "";
  }
}

export async function readVoiceRegistrationDebugLogTail(maxLines = MAX_SHARE_LINES): Promise<string> {
  const content = await readVoiceRegistrationDebugLog();
  if (!content.trim()) return "(log dosyası boş)";
  const lines = content.trim().split("\n");
  return lines.slice(-maxLines).join("\n");
}

export async function appendVoiceRegistrationDebugLog(
  event: VoiceRegistrationDebugEvent,
  data?: LogPayload,
): Promise<void> {
  const entry = {
    ts: new Date().toISOString(),
    event,
    platform: Platform.OS,
    platformVersion: String(Platform.Version),
    djangoApi: DJANGO_API_URL,
    ...data,
  };

  const line = `${JSON.stringify(entry)}\n`;

  try {
    await trimLogIfNeeded();
    const exists = await RNFS.exists(VOICE_REGISTRATION_DEBUG_LOG_PATH);
    if (exists) {
      await RNFS.appendFile(VOICE_REGISTRATION_DEBUG_LOG_PATH, line, "utf8");
    } else {
      await RNFS.writeFile(VOICE_REGISTRATION_DEBUG_LOG_PATH, line, "utf8");
    }

    if (__DEV__) {
      console.log("[VoiceRegDebug]", event, data ?? {});
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[VoiceRegDebug] yazılamadı:", error);
    }
  }
}

export async function logVoiceRegistrationSessionStart(ctx: {
  memberType: string;
  corporateType: string | null;
  stepCount: number;
}): Promise<void> {
  await appendVoiceRegistrationDebugLog("session_start", {
    logPath: VOICE_REGISTRATION_DEBUG_LOG_PATH,
    memberType: ctx.memberType,
    corporateType: ctx.corporateType,
    stepCount: ctx.stepCount,
    adbHint: `adb pull ${VOICE_REGISTRATION_DEBUG_LOG_PATH.replace(/^\/data\//, "/data//")}`,
  });
}

function maskFieldValue(field: VoiceRegistrationField, value: unknown): unknown {
  if (field === "phone") return maskPhoneForLog(String(value ?? ""));
  if (field === "email") return maskEmailForLog(String(value ?? ""));
  if (field === "spk_tc_no") return maskIdForLog(String(value ?? ""));
  if (field === "location" && value && typeof value === "object") {
    const loc = value as Record<string, unknown>;
    return {
      city_id: loc.city_id,
      town_id: loc.town_id,
      quarter_id: loc.quarter_id,
      il: loc.il,
      ilce: loc.ilce,
      mahalle: loc.mahalle,
    };
  }
  return value;
}

export async function logVoiceRegistrationApiRequest(
  field: VoiceRegistrationField,
  detail: {
    mimeType: string;
    audioBase64Length: number;
    memberType: string;
    corporateType: string | null;
    hasAccessToken: boolean;
  },
): Promise<void> {
  await appendVoiceRegistrationDebugLog("api_request", {
    field,
    endpoint: "/api/voice_registration_field_extract/",
    ...detail,
  });
}

export async function logVoiceRegistrationApiResponse(
  field: VoiceRegistrationField,
  detail: {
    httpStatus: number;
    durationMs: number;
    result: VoiceRegistrationExtractResult | null;
    parseError?: string;
  },
): Promise<void> {
  const result = detail.result;
  const payload: LogPayload = {
    field,
    httpStatus: detail.httpStatus,
    durationMs: detail.durationMs,
    ok: result?.ok,
    is_valid: result?.is_valid,
    error: result?.error,
    message: result?.message,
    raw_text: result?.raw_text ?? null,
    value: result ? maskFieldValue(field, result.value) : null,
  };

  if (field === "email" && result?.raw_text) {
    payload.normalized_from_raw = maskEmailForLog(
      normalizeVoiceRegistrationEmailFromSpeech(String(result.raw_text)),
    );
  }

  if (detail.parseError) {
    await appendVoiceRegistrationDebugLog("api_parse_error", {
      ...payload,
      parseError: detail.parseError,
    });
    return;
  }

  if (detail.httpStatus >= 400) {
    await appendVoiceRegistrationDebugLog("api_http_error", payload);
    return;
  }

  if (result && (result.is_valid === false || result.ok === false)) {
    await appendVoiceRegistrationDebugLog("extraction_failed", payload);
    return;
  }

  await appendVoiceRegistrationDebugLog("api_response", payload);
}

export async function logVoiceRegistrationLocalValidationFailed(
  field: VoiceRegistrationField,
  detail: {
    value: unknown;
    rawText?: string;
    error: string;
  },
): Promise<void> {
  await appendVoiceRegistrationDebugLog("local_validation_failed", {
    field,
    error: detail.error,
    raw_text: detail.rawText ?? null,
    value: maskFieldValue(field, detail.value),
    ...(field === "email" && detail.rawText
      ? {
          normalized_from_raw: maskEmailForLog(
            normalizeVoiceRegistrationEmailFromSpeech(String(detail.rawText)),
          ),
        }
      : {}),
  });
}

export async function logVoiceRegistrationRecovery(
  field: VoiceRegistrationField,
  detail: { rawText: string; recoveredValue: string },
): Promise<void> {
  await appendVoiceRegistrationDebugLog("recovery_success", {
    field,
    raw_text: detail.rawText,
    recoveredValue: maskFieldValue(field, detail.recoveredValue),
  });
}
