/**
 * Akıllı Sorgu — Django text/image/speech query extract API
 */

import { DJANGO_API_URL } from '../config/api';
import { authService } from './authService';
import { storageService } from './storageService';
import type { ApiResult } from './apiClient';
import type { SmartQueryExtractResult } from '../src/types/smartQuery';
import { appendVoiceQueryDebugLog } from '../src/utils/voiceQueryDebugLog';
import {
  isSmartQueryFeatureLockedError,
  smartQueryFeatureLockedMessage,
} from '../src/utils/customerFeatureGates';

export type SmartQueryExtractResponse = SmartQueryExtractResult;

type FeatureLockedBody = {
  error?: string;
  feature?: string;
  message?: string;
  ok?: boolean;
};

async function getAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  let accessToken = await storageService.getAccessToken();
  if (!accessToken) {
    const refreshed = await authService.refreshToken();
    accessToken = refreshed ? await storageService.getAccessToken() : null;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(extra || {}),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function postSmartQueryExtract(
  endpoint: string,
  body: Record<string, unknown>
): Promise<ApiResult<SmartQueryExtractResponse>> {
  const url = `${DJANGO_API_URL}${endpoint}`;
  const audioLen =
    typeof body.audio === 'string'
      ? body.audio.length
      : undefined;

  await appendVoiceQueryDebugLog('api_request', 'api', {
    endpoint,
    url,
    mimeType: body.mimeType ?? body.mime_type,
    audioBase64Length: audioLen,
    bodyKeys: Object.keys(body),
  });

  try {
    let headers = await getAuthHeaders();
    let res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (res.status === 401 && endpoint !== '/api/auth/token/refresh/') {
      const refreshed = await authService.refreshToken();
      const token = refreshed ? await storageService.getAccessToken() : null;
      if (token) {
        headers = { ...headers, Authorization: `Bearer ${token}` };
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
      }
    }

    const text = await res.text();
    let parsed: (SmartQueryExtractResponse & FeatureLockedBody) | null = null;

    try {
      parsed = text ? (JSON.parse(text) as SmartQueryExtractResponse & FeatureLockedBody) : null;
    } catch {
      if (!res.ok) {
        return { ok: false, status: res.status, error: `HTTP ${res.status}` };
      }
      return { ok: false, error: 'Sunucu yanıtı okunamadı.' };
    }

    if (!res.ok) {
      const locked = isSmartQueryFeatureLockedError(res.status, parsed);
      const result = {
        ok: false as const,
        status: res.status,
        error: locked
          ? smartQueryFeatureLockedMessage(parsed)
          : parsed?.error || parsed?.message || `HTTP ${res.status}`,
      };
      await appendVoiceQueryDebugLog('api_response', 'api', {
        endpoint,
        httpStatus: res.status,
        ok: false,
        error: result.error,
        featureLocked: locked,
        engine: parsed?.engine,
        responsePreview: text.slice(0, 500),
      });
      return result;
    }

    if (!parsed) {
      await appendVoiceQueryDebugLog('api_response', 'api', {
        endpoint,
        httpStatus: res.status,
        ok: false,
        error: 'Sunucu yanıtı boş.',
      });
      return { ok: false, error: 'Sunucu yanıtı boş.' };
    }

    await appendVoiceQueryDebugLog('api_response', 'api', {
      endpoint,
      httpStatus: res.status,
      ok: true,
      dataOk: parsed.ok,
      engine: parsed.engine,
      error: parsed.error,
      city_id: parsed.city_id,
      town_id: parsed.town_id,
      quarter_id: parsed.quarter_id,
      tkgm_value: parsed.tkgm_value,
      transcribedTextLength: parsed.transcribed_text?.length ?? 0,
    });

    return { ok: true, data: parsed };
  } catch (error: any) {
    const message = error?.message || 'Ağ hatası';
    await appendVoiceQueryDebugLog('api_network_error', 'api', {
      endpoint,
      message,
    });
    return { ok: false, error: message };
  }
}

/** POST /api/text_query_extract/ */
export async function extractSmartQueryFromText(
  text: string
): Promise<ApiResult<SmartQueryExtractResponse>> {
  return postSmartQueryExtract('/api/text_query_extract/', { text: String(text).trim() });
}

function toDataUrl(base64OrDataUrl: string, mimeType = 'image/jpeg'): string {
  const value = String(base64OrDataUrl || '').trim();
  if (!value) return '';
  if (value.startsWith('data:')) return value;
  return `data:${mimeType};base64,${value}`;
}

/** POST /api/image_query_extract/ */
export async function extractSmartQueryFromImage(
  base64OrDataUrl: string,
  mimeType = 'image/jpeg'
): Promise<ApiResult<SmartQueryExtractResponse>> {
  const image = toDataUrl(base64OrDataUrl, mimeType);
  if (!image) {
    return { ok: false, error: 'Görsel verisi boş.' };
  }
  return postSmartQueryExtract('/api/image_query_extract/', { image });
}

/** POST /api/speech_query_extract/ */
export async function extractSmartQueryFromSpeech(
  base64Audio: string,
  mimeType = 'audio/m4a'
): Promise<ApiResult<SmartQueryExtractResponse>> {
  const audio = String(base64Audio || '').trim();
  if (!audio) {
    return { ok: false, error: 'Ses verisi boş.' };
  }
  return postSmartQueryExtract('/api/speech_query_extract/', {
    audio,
    mimeType: mimeType || 'audio/m4a',
  });
}
