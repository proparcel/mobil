/**
 * Akıllı Sorgu — Django text/image/speech query extract API
 */

import { DJANGO_API_URL } from '../config/api';
import { authService } from './authService';
import { storageService } from './storageService';
import type { ApiResult } from './apiClient';
import type { SmartQueryExtractResult } from '../src/types/smartQuery';
import type { SmartQueryDebugChannel } from '../src/utils/smartQueryDebugLog';
import {
  logSmartQueryApiRequest,
  logSmartQueryApiResponse,
  appendSmartQueryDebugLog,
} from '../src/utils/smartQueryDebugLog';
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
  auth_required?: boolean;
};

const SMART_QUERY_AUTH_ERROR_MESSAGE =
  'Oturum doğrulanamadı. Lütfen çıkış yapıp tekrar giriş yapın.';

function normalizeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token === 'null' || token === 'undefined') return null;
  return token;
}

async function resolveAccessToken(): Promise<string | null> {
  let accessToken = normalizeToken(await storageService.getAccessToken());
  const refreshToken = normalizeToken(await storageService.getRefreshToken());

  if (!accessToken && refreshToken) {
    const refreshed = await authService.refreshToken();
    accessToken = normalizeToken(
      refreshed?.access ?? (await storageService.getAccessToken())
    );
  }

  return accessToken;
}

function buildAuthHeaders(
  accessToken: string | null,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(extra || {}),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function resolveSmartQueryApiError(
  status: number,
  parsed: FeatureLockedBody | null | undefined
): string {
  if (isSmartQueryFeatureLockedError(status, parsed)) {
    return smartQueryFeatureLockedMessage(parsed);
  }

  const raw = String(parsed?.error || parsed?.message || '').trim();
  const isAuthError =
    status === 401 ||
    parsed?.auth_required === true ||
    /giri[sş]\s*yap/i.test(raw);

  if (isAuthError) {
    return SMART_QUERY_AUTH_ERROR_MESSAGE;
  }

  return raw || `HTTP ${status}`;
}

function endpointChannel(endpoint: string): SmartQueryDebugChannel {
  if (endpoint.includes('speech')) return 'speech';
  if (endpoint.includes('image')) return 'image';
  return 'text';
}

async function postSmartQueryExtract(
  endpoint: string,
  body: Record<string, unknown>
): Promise<ApiResult<SmartQueryExtractResponse>> {
  const url = `${DJANGO_API_URL}${endpoint}`;
  const channel = endpointChannel(endpoint);
  const audioLen =
    typeof body.audio === 'string'
      ? body.audio.length
      : undefined;
  const textLen =
    typeof body.text === 'string'
      ? body.text.length
      : undefined;

  const refreshToken = normalizeToken(await storageService.getRefreshToken());
  let accessToken = await resolveAccessToken();
  const startedAt = Date.now();

  await logSmartQueryApiRequest(channel, {
    endpoint,
    mimeType: (body.mimeType ?? body.mime_type) as string | undefined,
    audioBase64Length: audioLen,
    textLength: textLen,
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
  });

  if (!accessToken && !refreshToken) {
    await logSmartQueryApiResponse(channel, {
      endpoint,
      httpStatus: 401,
      durationMs: Date.now() - startedAt,
      result: null,
      error: 'missing_tokens',
    });
    return {
      ok: false,
      status: 401,
      error: 'Oturum bulunamadı. Lütfen giriş yapın.',
    };
  }

  try {
    let headers = buildAuthHeaders(accessToken);
    let res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (res.status === 401 && endpoint !== '/api/auth/token/refresh/' && refreshToken) {
      const refreshed = await authService.refreshToken();
      accessToken = normalizeToken(
        refreshed?.access ?? (await storageService.getAccessToken())
      );
      if (accessToken) {
        headers = buildAuthHeaders(accessToken);
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
      const result = {
        ok: false as const,
        status: res.status,
        error: resolveSmartQueryApiError(res.status, parsed),
      };
      await logSmartQueryApiResponse(channel, {
        endpoint,
        httpStatus: res.status,
        durationMs: Date.now() - startedAt,
        result: parsed,
        error: result.error,
        responsePreview: text.slice(0, 500),
      });
      return result;
    }

    if (!parsed) {
      await logSmartQueryApiResponse(channel, {
        endpoint,
        httpStatus: res.status,
        durationMs: Date.now() - startedAt,
        result: null,
        error: 'Sunucu yanıtı boş.',
      });
      return { ok: false, error: 'Sunucu yanıtı boş.' };
    }

    await logSmartQueryApiResponse(channel, {
      endpoint,
      httpStatus: res.status,
      durationMs: Date.now() - startedAt,
      result: parsed,
    });

    return { ok: true, data: parsed };
  } catch (error: any) {
    const message = error?.message || 'Ağ hatası';
    await appendSmartQueryDebugLog('api_network_error', 'api', {
      channel,
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
