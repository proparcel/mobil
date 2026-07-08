/**
 * Pro sorgu API — dağıtık mod (202) poll + DFA snapshot id çözümleme (web ile uyumlu).
 */

import { API_URL } from '../../config/api';
import { storageService } from '../../services/storageService';

export class ProQueryLimitError extends Error {
  dailyLimit: number;
  constructor(message: string, dailyLimit: number) {
    super(message);
    this.name = 'ProQueryLimitError';
    this.dailyLimit = dailyLimit;
  }
}

export class ProQueryFailedError extends Error {
  rawMessage: string;
  code?: string;
  stage?: string;
  failedTask?: string;

  constructor(message: string, rawMessage: string, meta?: { code?: string; stage?: string; failedTask?: string }) {
    super(message);
    this.name = 'ProQueryFailedError';
    this.rawMessage = rawMessage;
    this.code = meta?.code;
    this.stage = meta?.stage;
    this.failedTask = meta?.failedTask;
  }
}

export class ProQueryAuthRequiredError extends Error {
  constructor(message = 'Bu işlem için giriş yapmanız gerekmektedir.') {
    super(message);
    this.name = 'ProQueryAuthRequiredError';
  }
}

/** HTTP durum kodunu koruyan pro sorgu hatası (ör. 402 yetersiz kredi tespiti için). */
export class ProQueryHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ProQueryHttpError';
    this.status = status;
  }
}

const DEFAULT_AUTH_REQUIRED_MESSAGE = 'Bu işlem için giriş yapmanız gerekmektedir.';

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    const jsonStart = trimmed.indexOf('{');
    if (jsonStart < 0) return null;
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart));
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

function extractApiErrorMessage(
  status: number,
  text: string,
): { message: string; authRequired: boolean } {
  const parsed = tryParseJsonObject(text);
  if (parsed) {
    const authRequired = parsed.auth_required === true || status === 401;
    const message = String(parsed.error || parsed.detail || parsed.message || '').trim();
    if (message) {
      return { message, authRequired };
    }
  }

  const trimmed = String(text || '').trim();
  if (trimmed) {
    return {
      message: trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed,
      authRequired: status === 401,
    };
  }

  return {
    message: status === 401 ? DEFAULT_AUTH_REQUIRED_MESSAGE : `HTTP ${status}`,
    authRequired: status === 401,
  };
}

function throwHttpError(status: number, text: string): never {
  const { message, authRequired } = extractApiErrorMessage(status, text);
  if (authRequired) {
    throw new ProQueryAuthRequiredError(message || DEFAULT_AUTH_REQUIRED_MESSAGE);
  }
  throw new ProQueryHttpError(status, message || `HTTP ${status}`);
}

const TASK_LABEL_TR: Record<string, string> = {
  io_roads: 'yol ve cephe analizi',
  io_distances: 'mesafe analizi',
  io_price_km: 'fiyat/km analizi',
  geo_sales_grid: 'satış ızgarası',
  geo_edges: 'parsel kenarları',
  geo_sea_view: 'deniz manzarası',
  geo_electric_railway: 'elektrik / demiryolu',
  geo_slope_elevation: 'eğim ve yükseklik',
  geo_bundle: 'coğrafi katman paketi',
  prediction: 'yapay zekâ tahmini',
};

/** Celery / collector hata metinlerini kullanıcıya okunur Türkçe metne çevirir. */
export function formatProQueryError(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return 'Pro sorgu tamamlanamadı. Lütfen tekrar deneyin.';

  const httpJsonMatch = text.match(/^HTTP (\d+):\s*(\{[\s\S]+\})\s*$/);
  if (httpJsonMatch) {
    const parsed = tryParseJsonObject(httpJsonMatch[2]);
    const parsedMessage = String(parsed?.error || parsed?.detail || parsed?.message || '').trim();
    if (parsedMessage) return parsedMessage;
  }

  const upstream = text.match(/upstream task failure detected\s*\(([^:]+):FAILURE\)/i);
  if (upstream) {
    const taskKey = upstream[1].trim();
    const label = TASK_LABEL_TR[taskKey] || taskKey;
    return (
      `Pro sorgu tamamlanamadı: ${label} aşamasında sunucu hatası oluştu. ` +
      'Birkaç dakika sonra tekrar deneyin; sorun sürerse farklı bir parselle test edin.'
    );
  }

  if (/stale_distributed_job/i.test(text)) {
    return 'Eski bir arka plan işi bulundu. Uygulamayı yeniden başlatıp sorguyu tekrarlayın.';
  }
  if (/collector_timeout|missing_partials/i.test(text)) {
    return 'Pro sorgu zaman aşımına uğradı (sunucu tüm adımları bitiremedi). Lütfen tekrar deneyin.';
  }
  if (/Günlük sorgu limit|daily_limit|429/i.test(text)) {
    return text;
  }

  return text.length > 280 ? `${text.slice(0, 280)}…` : text;
}

export function getProQueryErrorAlert(
  error: unknown,
): { title: string; message: string; authRequired?: boolean } {
  if (error instanceof ProQueryLimitError) {
    return {
      title: 'Günlük Sorgu Limiti',
      message: `${error.message}\n\nGünlük ücretsiz sorgu hakkınız: ${error.dailyLimit}`,
    };
  }
  if (error instanceof ProQueryAuthRequiredError) {
    return {
      title: 'Giriş Gerekli',
      message: error.message || DEFAULT_AUTH_REQUIRED_MESSAGE,
      authRequired: true,
    };
  }
  if (error instanceof ProQueryFailedError) {
    return { title: 'Sorgu Hatası', message: error.message };
  }
  const msg = error instanceof Error ? error.message : String(error || '');
  if (/auth_required|giri[sş]\s*yapman/i.test(msg)) {
    return {
      title: 'Giriş Gerekli',
      message: formatProQueryError(msg),
      authRequired: true,
    };
  }
  if (/network request failed|failed to fetch|timed out|timeout|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
    return {
      title: 'Bağlantı Hatası',
      message: 'Backend sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.',
    };
  }
  return { title: 'Sorgu Hatası', message: formatProQueryError(msg) };
}

export function getProQueryAlertButtons(
  alert: { authRequired?: boolean },
  options: { isAuthenticated: boolean; onLogin: () => void },
) {
  if (alert.authRequired && !options.isAuthenticated) {
    return [
      { text: 'Kapat', style: 'cancel' as const },
      { text: 'Giriş Yap', onPress: options.onLogin },
    ];
  }
  return [{ text: 'Tamam' }];
}

function proQueryFailedFromBody(body: any, fallback: string): ProQueryFailedError {
  const raw = String(body?.error || body?.detail || fallback || 'Pro sorgu tamamlanamadı.');
  const upstream = raw.match(/upstream task failure detected\s*\(([^:]+):FAILURE\)/i);
  const failedTask = upstream?.[1]?.trim();
  return new ProQueryFailedError(formatProQueryError(raw), raw, {
    code: body?.code,
    stage: body?.error_stage,
    failedTask,
  });
}

const PRO_QUERY_POLL_MAX_MS = 120_000;
const SNAPSHOT_RESOLVE_BACKOFF_MS = [500, 800, 1200, 1600, 2000, 2500, 3000, 4000, 5000];

export const APIFY_PENDING_USER_MESSAGE =
  'Bu mahalle için güncel fiyat analizleri yapılması gerekmektedir. ' +
  'Bu işlem 1 dakika kadar vakit alabilir. ' +
  'İşlem tamamlandığında bildirim gönderilecektir.';

export type QuarterPricePrecheckResult = {
  success?: boolean;
  needs_apify: boolean;
  verified: boolean;
  proparcel_value?: number;
  user_message?: string | null;
};

export type BackgroundProQueryPending = {
  job_id: string;
  result_url?: string;
  status_url?: string;
  status?: string;
  queued_reason?: string;
  user_message?: string;
  show_apify_pending_modal?: boolean;
  show_completion_modal?: boolean;
  retry_after_seconds?: number;
};

export function isBackgroundDeferredProQuery(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const reason = String(data.queued_reason || '').toLowerCase();
  const status = String(data.status || '').toLowerCase();
  return (
    Boolean(data.show_apify_pending_modal) ||
    reason === 'quarter_price_refresh' ||
    status === 'queued_apify'
  );
}

export function extractSnapshotIdFromPayload(obj: any): number | null {
  if (!obj || typeof obj !== 'object') return null;
  const pd = obj.parameters_data || {};
  const raw = pd.dfa_snapshot_id ?? obj.dfa_snapshot_id ?? obj.snapshot_id ?? null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Backend göreli path döner (/api/...); mobilde mutlak URL gerekir. */
export function resolveBackendApiUrl(backendUrl: string, pathOrUrl: string | null | undefined): string | null {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return null;
  const base = (backendUrl || '').replace(/\/$/, '');
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${base}${raw}`;
  return `${base}/${raw}`;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-PP-Client': 'mobile',
    ...(options.headers as Record<string, string> | undefined),
  };
  try {
    const tokens = await storageService.getTokens();
    if (tokens?.access) headers.Authorization = `Bearer ${tokens.access}`;
  } catch {
    // anonim
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 429) {
    let msg = 'Günlük sorgu limitinize ulaştınız.';
    let limit = 10;
    try {
      const body = await response.json();
      if (body.error) msg = body.error;
      if (body.daily_limit) limit = body.daily_limit;
    } catch {
      // ignore
    }
    throw new ProQueryLimitError(msg, limit);
  }
  return response;
}

export function extractProQueryCityId(data: any): number | null {
  const pd = data?.parameters_data || {};
  const pv = pd?.parcel_values || {};
  const props = data?.properties || pd?.tkgm_data?.properties || {};
  const raw =
    pd.city_id ??
    data.city_id ??
    props.cityId ??
    props.city_id ??
    pv.cityId ??
    null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type ProQueryIdentifiers = {
  proparcel_value?: number | null;
  ada?: string;
  parsel?: string;
};

export function extractProQueryIdentifiers(data: any): ProQueryIdentifiers {
  const pd = data?.parameters_data || {};
  const pv = pd?.parcel_values || data?.properties || {};
  const parcel = data?.parcel || {};
  const proparcelValue = Number(
    pv.Proparcel_value ?? pv.proparcel_value ?? pd.proparcel_value ?? data?.proparcel_value ?? 0,
  );
  const ada = String(parcel.ada ?? pv.adaNo ?? pv.ada ?? pd.ada ?? '').trim();
  const parsel = String(parcel.parsel ?? pv.parselNo ?? pv.parsel ?? pd.parsel ?? '').trim();
  return {
    proparcel_value: Number.isFinite(proparcelValue) && proparcelValue > 0 ? proparcelValue : null,
    ada,
    parsel,
  };
}

async function pollDistributedProQuery(
  backendUrl: string,
  initial: any,
): Promise<any> {
  const jobId = String(initial?.job_id || '').trim();
  const resultUrl = resolveBackendApiUrl(
    backendUrl,
    initial?.result_url ||
      (jobId ? `/api/get_parcel_result/${encodeURIComponent(jobId)}/` : null),
  );
  if (!resultUrl) {
    throw new Error('Dağıtık pro sorgu sonuç URL’si yok.');
  }

  console.log('[proQueryApi] Dağıtık poll başlıyor', { jobId, resultUrl });

  const deadline = Date.now() + PRO_QUERY_POLL_MAX_MS;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    let resp: Response;
    try {
      resp = await authFetch(resultUrl, { method: 'GET' });
    } catch (e) {
      await sleep(2000);
      continue;
    }

    if (resp.status === 504 || resp.status === 410) {
      let failBody: any = null;
      try {
        failBody = await resp.json();
      } catch {
        // ignore
      }
      throw proQueryFailedFromBody(failBody, 'Pro sorgu tamamlanamadı.');
    }

    if (resp.status === 202) {
      let pending: any = null;
      try {
        pending = await resp.json();
      } catch {
        // ignore
      }
      const retryAfter = Math.max(
        1,
        Number(resp.headers.get('Retry-After') || pending?.retry_after_seconds || initial?.retry_after_seconds || 2),
      );
      if (attempts % 5 === 1) {
        console.log('[proQueryApi] Dağıtık poll bekleniyor', {
          attempt: attempts,
          jobId,
          status: pending?.status,
          done: pending?.done_count,
          expected: pending?.expected_tasks,
          dfa_ready: pending?.dfa_snapshot_ready,
        });
      }
      await sleep(retryAfter * 1000);
      continue;
    }

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      const failBody = tryParseJsonObject(t);
      if (failBody?.error || failBody?.status === 'failed') {
        throw proQueryFailedFromBody(failBody, t.slice(0, 200));
      }
      if (resp.status === 401 || failBody?.auth_required === true) {
        throwHttpError(resp.status, t);
      }
      throw new ProQueryFailedError(
        formatProQueryError(`Pro sorgu sonuç HTTP ${resp.status}`),
        t.slice(0, 400),
      );
    }

    const text = await resp.text();
    const payload = text ? JSON.parse(text) : null;
    if (!payload || typeof payload !== 'object') {
      throw new Error('Pro sorgu sonucu boş.');
    }
    if (payload.error || payload.status === 'failed') {
      throw proQueryFailedFromBody(payload, String(payload.error || 'Pro sorgu tamamlanamadı.'));
    }
    console.log('[proQueryApi] Dağıtık pro sorgu tamamlandı', {
      attempts,
      jobId,
      keys: Object.keys(payload),
      dfa_snapshot_id: extractSnapshotIdFromPayload(payload),
    });
    return payload;
  }

  throw new Error('Pro sorgu zaman aşımına uğradı. Lütfen tekrar deneyin.');
}

export async function precheckQuarterPrice(
  requestBody: Record<string, unknown>,
): Promise<QuarterPricePrecheckResult> {
  const backendUrl = (API_URL || '').replace(/\/$/, '');
  const response = await authFetch(`${backendUrl}/api/get_parcel_info/`, {
    method: 'POST',
    body: JSON.stringify({ ...requestBody, precheck_only: true }),
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throwHttpError(response.status, errorBody);
  }
  const data = await response.json();
  return {
    success: data?.success === true,
    needs_apify: Boolean(data?.needs_apify),
    verified: Boolean(data?.verified),
    proparcel_value: data?.proparcel_value,
    user_message: data?.user_message,
  };
}

export type ProQueryApifyDefer = {
  deferred: true;
  message: string;
  body: Record<string, unknown>;
};

export type ProQueryApifyPrecheckResult = ProQueryApifyDefer | { deferred: false };

/** Verified yoksa Apify arka plan akışına yönlendir (tüm pro sorgu tipleri). */
export async function shouldDeferProQueryForApify(
  requestBody: Record<string, unknown>,
): Promise<ProQueryApifyPrecheckResult> {
  const precheck = await precheckQuarterPrice(requestBody);
  if (!precheck.needs_apify) {
    return { deferred: false };
  }
  return {
    deferred: true,
    message: String(precheck.user_message || APIFY_PENDING_USER_MESSAGE),
    body: requestBody,
  };
}

export async function markProQueryNotifyOnComplete(jobId: string): Promise<void> {
  const id = String(jobId || '').trim();
  if (!id) return;
  const backendUrl = (API_URL || '').replace(/\/$/, '');
  try {
    await authFetch(`${backendUrl}/api/pro-query/jobs/${encodeURIComponent(id)}/notify-on-complete/`, {
      method: 'POST',
      body: '{}',
    });
  } catch {
    // best-effort
  }
}

/**
 * Pro sorguyu arka planda başlatır — poll yapmaz (Apify / kuyruk modu).
 */
export async function startProParcelQueryBackground(
  requestBody: Record<string, unknown>,
): Promise<BackgroundProQueryPending> {
  const backendUrl = (API_URL || '').replace(/\/$/, '');
  const response = await authFetch(`${backendUrl}/api/get_parcel_info/`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (response.status === 202) {
    const initial = (await response.json()) as BackgroundProQueryPending;
    if (initial?.job_id) {
      await markProQueryNotifyOnComplete(String(initial.job_id));
    }
    return initial;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throwHttpError(response.status, errorBody);
  }

  const data = await response.json();
  if (data?.job_id && !data?.parameters_data) {
    const pending = data as BackgroundProQueryPending;
    if (pending.job_id) {
      await markProQueryNotifyOnComplete(String(pending.job_id));
    }
    return pending;
  }
  throw new Error('Arka plan pro sorgu yanıtı beklenen formatta değil.');
}

/**
 * POST /api/get_parcel_info/ — 202 ise sonuç gelene kadar bekler.
 */
export async function runProParcelQuery(requestBody: Record<string, unknown>): Promise<any> {
  const backendUrl = (API_URL || '').replace(/\/$/, '');
  const response = await authFetch(`${backendUrl}/api/get_parcel_info/`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (response.status === 202) {
    const initial = await response.json();
    return pollDistributedProQuery(backendUrl, initial);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throwHttpError(response.status, errorBody);
  }

  const data = await response.json();
  if (data?.job_id && !data?.parameters_data) {
    return pollDistributedProQuery(backendUrl, data);
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return data;
}

export async function resolveDfaSnapshotId(
  data: any,
  ids?: ProQueryIdentifiers,
): Promise<number | null> {
  const direct = extractSnapshotIdFromPayload(data);
  if (direct) return direct;

  const idents = ids || extractProQueryIdentifiers(data);
  const backendUrl = (API_URL || '').replace(/\/$/, '');
  const distributed = data?.__distributed || {};
  const jobId = distributed.job_id || data?.job_id || null;
  const resultUrl = resolveBackendApiUrl(
    backendUrl,
    distributed.result_url ||
      data?.result_url ||
      (jobId ? `/api/get_parcel_result/${encodeURIComponent(jobId)}/` : null),
  );

  for (let i = 0; i < SNAPSHOT_RESOLVE_BACKOFF_MS.length; i += 1) {
    if (resultUrl) {
      try {
        const rr = await authFetch(resultUrl, { method: 'GET' });
        if (rr.ok) {
          const rj = await rr.json();
          const resolved = extractSnapshotIdFromPayload(rj);
          if (resolved) return resolved;
        }
      } catch {
        // continue
      }
    }

    if (idents.proparcel_value && idents.parsel) {
      try {
        const qs = new URLSearchParams();
        qs.set('proparcel_value', String(idents.proparcel_value));
        if (idents.ada) qs.set('ada', idents.ada);
        qs.set('parsel', idents.parsel);
        const ds = await authFetch(`${backendUrl}/api/dfa-snapshot/?${qs.toString()}`, {
          method: 'GET',
        });
        if (ds.ok) {
          const dj = await ds.json();
          const resolved = extractSnapshotIdFromPayload(dj);
          if (resolved) return resolved;
        }
      } catch {
        // continue
      }
    }

    await sleep(SNAPSHOT_RESOLVE_BACKOFF_MS[i]);
  }

  console.warn('[proQueryApi] dfa_snapshot_id çözülemedi', idents);
  return null;
}

/** Pro sorgu yanıtından snapshot kimliğini çöz (doğrudan alan + poll). */
export async function resolveProQuerySnapshotId(data: any): Promise<number | null> {
  const direct = extractSnapshotIdFromPayload(data);
  if (direct) return direct;
  return resolveDfaSnapshotId(data, extractProQueryIdentifiers(data));
}
