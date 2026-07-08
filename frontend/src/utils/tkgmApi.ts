/**
 * TKGM API doğrudan çağrıları (mobil).
 * Basit sorgu TKGM istekleri yalnızca cbsapi.tkgm.gov.tr üzerinden yapılır; backend proxy yok.
 */

import {
  isPassiveParcelPayload,
  normalizeAndConfirm,
  type PassiveConfirmFn,
} from './tkgmPassiveParcel';
import { logSimpleQuery } from './simpleQueryLogger';

export { isPassiveParcelPayload } from './tkgmPassiveParcel';
export type { PassiveConfirmFn } from './tkgmPassiveParcel';

const TKGM_API_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/parsel';
const TKGM_TIMEOUT = 20000;

const TKGM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  Origin: 'https://parselsorgu.tkgm.gov.tr',
  Referer: 'https://parselsorgu.tkgm.gov.tr/',
};

export interface TkgmError {
  type: string;
  status?: number;
  message: string;
  detail?: unknown;
  originalError?: unknown;
}

export interface TkgmData {
  geometry: unknown;
  properties: unknown;
}

/** Parsel servisi yanıt vermiyor (HTTP 5xx) — kullanıcıya gösterilecek uyarı metni */
export const TKGM_NO_RESPONSE_MESSAGE =
  'Parsel servisi yanıt vermiyor. Lütfen sonra tekrar deneyin.';

/** HTTP 500+ veya TKGM_UNAVAILABLE → sunucu yanıt vermiyor sayılır */
export function isTkgmNoResponseError(error: unknown): boolean {
  const err = error as TkgmError;
  if (err?.type === 'TKGM_UNAVAILABLE') return true;
  if (err?.type === 'TKGM_ERROR' && typeof err.status === 'number' && err.status >= 500) {
    return true;
  }
  return false;
}

/** TKGM hatasını kullanıcıya gösterilecek Alert başlık + mesajına çevirir */
export function getTkgmUserAlert(error: unknown): { title: string; message: string } {
  const err = error as TkgmError;

  if (isTkgmNoResponseError(error)) {
    return { title: 'Uyarı', message: TKGM_NO_RESPONSE_MESSAGE };
  }
  if (err?.type === 'TKGM_PARCEL_NOT_FOUND') {
    return { title: 'Parsel Bulunamadı', message: err.message || 'Parsel bulunamadı.' };
  }
  if (err?.type === 'TKGM_RATE_LIMIT') {
    return {
      title: 'Günlük Sorgu Limiti',
      message: err.message || 'Günlük sorgu limiti aşıldı. Lütfen daha sonra tekrar deneyin.',
    };
  }
  if (err?.type === 'TIMEOUT') {
    return { title: 'Uyarı', message: TKGM_NO_RESPONSE_MESSAGE };
  }
  if (err?.type === 'CORS_OR_NETWORK_ERROR') {
    return {
      title: 'Bağlantı Hatası',
      message: err.message || 'Parsel servisine bağlanılamadı. İnternet bağlantınızı kontrol edin.',
    };
  }
  if (err?.type === 'TKGM_INVALID_DATA') {
    return { title: 'Uyarı', message: err.message || 'Beklenmeyen bir yanıt alındı.' };
  }
  if (err?.type === 'TKGM_ERROR' && err.message) {
    return { title: 'Uyarı', message: err.message };
  }
  return {
    title: 'Bağlantı Hatası',
    message: 'Parsel sorgusu tamamlanamadı. Lütfen internet bağlantınızı kontrol edin.',
  };
}

function normalizeTkgmFetchError(error: unknown): TkgmError {
  const err = error as { name?: string; type?: string; message?: string; status?: number; detail?: unknown; originalError?: unknown };
  if (err?.type) return err as TkgmError;

  if (err?.name === 'AbortError') {
    return { type: 'TIMEOUT', message: 'Parsel sorgusu zaman aşımına uğradı' };
  }

  if (
    err?.name === 'TypeError' ||
    err?.message?.includes('Failed to fetch') ||
    err?.message?.includes('NetworkError')
  ) {
    return {
      type: 'CORS_OR_NETWORK_ERROR',
      message: 'Parsel servisine bağlanılamadı. İnternet bağlantınızı kontrol edin.',
      originalError: err,
    };
  }

  return {
    type: 'UNKNOWN_ERROR',
    message: err?.message || 'Bilinmeyen hata',
    originalError: err,
  };
}

/**
 * Pasif/toplulaştırılmış parsel ise onay (modal) sonrası normalize feature döndürür.
 * Pasif değilse data'yı olduğu gibi döner.
 */
export async function applyPassiveParcelIfNeeded(
  data: unknown,
  confirm?: PassiveConfirmFn,
): Promise<unknown> {
  if (isPassiveParcelPayload(data)) {
    return normalizeAndConfirm(data, confirm);
  }
  return data;
}

async function parseTkgmResponse(
  response: Response,
  confirm?: PassiveConfirmFn,
): Promise<TkgmData> {
  if (response.status === 404) {
    let errorData: Record<string, unknown> | null = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = { Message: 'Parsel Bulunamadı' };
    }
    // 404 yanıtı aslında pasif parsel payload'ı olabilir → kurtar (hata fırlatma).
    if (isPassiveParcelPayload(errorData)) {
      const normalized = await applyPassiveParcelIfNeeded(errorData, confirm);
      return normalized as TkgmData;
    }
    const msg =
      (errorData?.Message as string) ||
      (errorData?.message as string) ||
      'Parsel Bulunamadı';
    throw {
      type: 'TKGM_PARCEL_NOT_FOUND',
      status: 404,
      message: msg,
      detail: errorData,
    } as TkgmError;
  }

  if (response.status === 403) {
    let errorData: Record<string, unknown> | null = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = { Message: 'Günlük sorgu limitini aştınız.' };
    }
    const msg =
      (errorData?.Message as string) ||
      (errorData?.message as string) ||
      (errorData?.error as string) ||
      'Günlük sorgu limitini aştınız.';
    throw {
      type: 'TKGM_RATE_LIMIT',
      status: 403,
      message: msg,
      detail: errorData,
    } as TkgmError;
  }

  if (!response.ok) {
    const serverError = response.status >= 500;
    throw {
      type: serverError ? 'TKGM_UNAVAILABLE' : 'TKGM_ERROR',
      status: response.status,
      message: serverError ? TKGM_NO_RESPONSE_MESSAGE : `HTTP ${response.status}`,
    } as TkgmError;
  }

  let data = await response.json();
  // 200 yanıtında geometry yok ama gittigiParselListe/pp_tkgm_passive_redirect varsa pasif parsel.
  data = await applyPassiveParcelIfNeeded(data, confirm);
  if (!data?.geometry || !data?.properties) {
    const err = {
      type: 'TKGM_INVALID_DATA',
      message: 'Geçersiz veri formatı',
    } as TkgmError;
    logSimpleQuery('tkgm_invalid_data', { status: response.status, hasGeometry: !!data?.geometry, hasProperties: !!data?.properties });
    throw err;
  }

  return data as TkgmData;
}

async function fetchTkgmDirect(
  url: string,
  signal?: AbortSignal,
  confirm?: PassiveConfirmFn,
): Promise<TkgmData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TKGM_TIMEOUT);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: TKGM_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return await parseTkgmResponse(response, confirm);
  } catch (error) {
    clearTimeout(timeoutId);
    const normalized = normalizeTkgmFetchError(error);
    logSimpleQuery('tkgm_fetch_error', {
      url,
      errorType: normalized.type,
      errorMessage: normalized.message,
    });
    throw normalized;
  }
}

/** Koordinat ile doğrudan TKGM sorgusu */
export async function fetchTkgmByCoords(
  lat: number,
  lon: number,
  signal?: AbortSignal,
  confirm?: PassiveConfirmFn,
): Promise<TkgmData> {
  return fetchTkgmDirect(`${TKGM_API_BASE}/${lat}/${lon}/`, signal, confirm);
}

/** Ada/parsel ile doğrudan TKGM sorgusu */
export async function fetchTkgmByIds(
  mahalleTkgmValue: string | number,
  ada: string | number,
  parsel: string | number,
  signal?: AbortSignal,
  confirm?: PassiveConfirmFn,
): Promise<TkgmData> {
  const mahalle = String(mahalleTkgmValue).trim();
  const adaStr = String(ada).trim();
  const parselStr = String(parsel).trim();
  return fetchTkgmDirect(
    `${TKGM_API_BASE}/${mahalle}/${encodeURIComponent(adaStr)}/${encodeURIComponent(parselStr)}`,
    signal,
    confirm,
  );
}
