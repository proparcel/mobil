/**
 * Sesli Üyelik — Django voice_registration_field_extract API
 */

import { DJANGO_API_URL } from "../config/api";
import { storageService } from "./storageService";
import { authService } from "./authService";
import type { ApiResult } from "./apiClient";
import type {
  VoiceRegistrationContext,
  VoiceRegistrationExtractResult,
  VoiceRegistrationField,
} from "../src/types/voiceRegistration";
import { appendVoiceQueryDebugLog } from "../src/utils/voiceQueryDebugLog";
import {
  logVoiceRegistrationApiRequest,
  logVoiceRegistrationApiResponse,
} from "../src/utils/voiceRegistrationDebugLog";

const NETWORK_ERROR_MESSAGE =
  "Sesli işlem sırasında bağlantı sorunu oluştu. Lütfen tekrar deneyin.";

function normalizeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token === "null" || token === "undefined") return null;
  return token;
}

async function resolveOptionalAccessToken(): Promise<string | null> {
  let accessToken = normalizeToken(await storageService.getAccessToken());
  const refreshToken = normalizeToken(await storageService.getRefreshToken());
  if (!accessToken && refreshToken) {
    const refreshed = await authService.refreshToken();
    accessToken = normalizeToken(
      refreshed?.access ?? (await storageService.getAccessToken()),
    );
  }
  return accessToken;
}

function buildContextPayload(ctx: VoiceRegistrationContext) {
  return {
    source: "voice_registration",
    member_type: ctx.memberType,
    corporate_type: ctx.corporateType,
    company_profile_id: ctx.selectedCompany?.company_profile_id ?? null,
  };
}

export async function extractVoiceRegistrationField(
  field: VoiceRegistrationField,
  base64Audio: string,
  mimeType: string,
  ctx: VoiceRegistrationContext,
): Promise<ApiResult<VoiceRegistrationExtractResult>> {
  const audio = String(base64Audio || "").trim();
  if (!audio) {
    return { ok: false, error: "Ses verisi boş." };
  }

  const url = `${DJANGO_API_URL}/api/voice_registration_field_extract/`;
  const body = {
    field,
    audio,
    mimeType: mimeType || "audio/m4a",
    context: buildContextPayload(ctx),
  };

  const accessToken = await resolveOptionalAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  await appendVoiceQueryDebugLog("api_request", "voice_registration", {
    endpoint: "/api/voice_registration_field_extract/",
    field,
    mimeType: body.mimeType,
    audioBase64Length: audio.length,
    memberType: ctx.memberType,
    corporateType: ctx.corporateType,
    hasAccessToken: Boolean(accessToken),
  });
  await logVoiceRegistrationApiRequest(field, {
    mimeType: body.mimeType,
    audioBase64Length: audio.length,
    memberType: ctx.memberType,
    corporateType: ctx.corporateType,
    hasAccessToken: Boolean(accessToken),
  });

  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: VoiceRegistrationExtractResult | null = null;
    try {
      parsed = text ? (JSON.parse(text) as VoiceRegistrationExtractResult) : null;
    } catch (parseError) {
      await logVoiceRegistrationApiResponse(field, {
        httpStatus: res.status,
        durationMs: Date.now() - startedAt,
        result: null,
        parseError: parseError instanceof Error ? parseError.message : "json_parse_failed",
      });
      if (!res.ok) {
        return { ok: false, status: res.status, error: `HTTP ${res.status}` };
      }
      return { ok: false, error: "Sunucu yanıtı okunamadı." };
    }

    const durationMs = Date.now() - startedAt;

    if (!res.ok) {
      const message =
        String(parsed?.message || parsed?.error || "").trim() ||
        (res.status === 429
          ? "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin."
          : NETWORK_ERROR_MESSAGE);
      await appendVoiceQueryDebugLog("api_response", "voice_registration", {
        httpStatus: res.status,
        ok: false,
        field,
        error: message,
      });
      await logVoiceRegistrationApiResponse(field, {
        httpStatus: res.status,
        durationMs,
        result: parsed,
      });
      return { ok: false, status: res.status, error: message, data: parsed ?? undefined };
    }

    if (!parsed) {
      await logVoiceRegistrationApiResponse(field, {
        httpStatus: res.status,
        durationMs,
        result: null,
        parseError: "empty_body",
      });
      return { ok: false, error: "Sunucu yanıtı boş." };
    }

    await appendVoiceQueryDebugLog("api_response", "voice_registration", {
      httpStatus: res.status,
      ok: true,
      field: parsed.field,
      is_valid: parsed.is_valid,
      error: parsed.error,
      raw_text: parsed.raw_text,
    });
    await logVoiceRegistrationApiResponse(field, {
      httpStatus: res.status,
      durationMs,
      result: parsed,
    });

    return { ok: true, data: parsed };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE;
    await appendVoiceQueryDebugLog("network_error", "voice_registration", {
      field,
      message,
    });
    return { ok: false, error: NETWORK_ERROR_MESSAGE };
  }
}
