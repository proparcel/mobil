import { Platform, Share } from 'react-native';
import RNFS from 'react-native-fs';
import { DJANGO_API_URL } from '../../config/api';
import type { SmartQueryExtractResult } from '../types/smartQuery';
import type { VoiceLocationResolveDebug } from './voiceLocationResolve';

/** Akıllı / sesli parsel sorgusu debug günlüğü (JSON Lines). */
export const SMART_QUERY_DEBUG_LOG_PATH = `${RNFS.DocumentDirectoryPath}/smart-query-debug.log`;

const MAX_LOG_BYTES = 768 * 1024;
const MAX_SHARE_LINES = 100;

export type SmartQueryDebugChannel = 'speech' | 'text' | 'image';

export type SmartQueryDebugEvent =
  | 'session_start'
  | 'recorder_start'
  | 'recorder_start_failed'
  | 'recorder_stop'
  | 'recorder_stop_failed'
  | 'recorder_payload_reuse'
  | 'recorder_clear'
  | 'flow_send_start'
  | 'flow_send_skip'
  | 'api_request'
  | 'api_response'
  | 'api_http_error'
  | 'api_network_error'
  | 'resolve_start'
  | 'resolve_success'
  | 'resolve_failed'
  | 'resolve_partial'
  | 'flow_partial_success'
  | 'flow_success'
  | 'flow_error'
  | 'permission_denied';

type LogPayload = Record<string, unknown>;

async function trimLogIfNeeded(): Promise<void> {
  const exists = await RNFS.exists(SMART_QUERY_DEBUG_LOG_PATH);
  if (!exists) return;

  const stat = await RNFS.stat(SMART_QUERY_DEBUG_LOG_PATH);
  if (stat.size <= MAX_LOG_BYTES) return;

  const content = await RNFS.readFile(SMART_QUERY_DEBUG_LOG_PATH, 'utf8');
  const trimmed = content.slice(-Math.floor(MAX_LOG_BYTES / 2));
  await RNFS.writeFile(SMART_QUERY_DEBUG_LOG_PATH, trimmed, 'utf8');
}

export function getSmartQueryDebugLogPath(): string {
  return SMART_QUERY_DEBUG_LOG_PATH;
}

export async function readSmartQueryDebugLog(): Promise<string> {
  try {
    if (!(await RNFS.exists(SMART_QUERY_DEBUG_LOG_PATH))) return '';
    return await RNFS.readFile(SMART_QUERY_DEBUG_LOG_PATH, 'utf8');
  } catch {
    return '';
  }
}

export async function readSmartQueryDebugLogTail(maxLines = MAX_SHARE_LINES): Promise<string> {
  const content = await readSmartQueryDebugLog();
  if (!content.trim()) return '(log dosyası boş)';
  const lines = content.trim().split('\n');
  return lines.slice(-maxLines).join('\n');
}

export async function appendSmartQueryDebugLog(
  event: SmartQueryDebugEvent,
  source: 'orb' | 'modal' | 'recorder' | 'api' | 'resolve',
  data?: LogPayload,
): Promise<void> {
  const entry = {
    ts: new Date().toISOString(),
    event,
    source,
    platform: Platform.OS,
    platformVersion: String(Platform.Version),
    djangoApi: DJANGO_API_URL,
    logPath: SMART_QUERY_DEBUG_LOG_PATH,
    ...data,
  };

  const line = `${JSON.stringify(entry)}\n`;

  try {
    await trimLogIfNeeded();
    const exists = await RNFS.exists(SMART_QUERY_DEBUG_LOG_PATH);
    if (exists) {
      await RNFS.appendFile(SMART_QUERY_DEBUG_LOG_PATH, line, 'utf8');
    } else {
      await RNFS.writeFile(SMART_QUERY_DEBUG_LOG_PATH, line, 'utf8');
    }

    if (__DEV__) {
      console.log('[SmartQueryDebug]', event, source, data ?? {});
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[SmartQueryDebug] yazılamadı:', error);
    }
  }
}

export async function logSmartQuerySessionStart(
  source: 'orb' | 'modal' | 'recorder',
  channel: SmartQueryDebugChannel,
): Promise<void> {
  await appendSmartQueryDebugLog('session_start', source, {
    channel,
    adbHint: `adb shell run-as com.proparcel.mobile cat files/smart-query-debug.log`,
  });
}

function summarizeExtractResult(result: SmartQueryExtractResult | null | undefined): LogPayload {
  if (!result) return { result: null };
  return {
    ok: result.ok,
    error: result.error,
    engine: result.engine,
    il: result.il,
    ilce: result.ilce,
    mahalle: result.mahalle,
    city_id: result.city_id,
    town_id: result.town_id,
    quarter_id: result.quarter_id,
    tkgm_value: result.tkgm_value,
    proparcel_value: result.proparcel_value,
    ada_no: result.ada_no,
    parsel_no: result.parsel_no,
    transcribed_text: result.transcribed_text ?? null,
    refined_text: result.refined_text ?? null,
    confidence_score: result.confidence_score,
    analysis_notes: result.analysis_notes,
  };
}

export async function logSmartQueryApiRequest(
  channel: SmartQueryDebugChannel,
  detail: {
    endpoint: string;
    mimeType?: string;
    audioBase64Length?: number;
    textLength?: number;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
  },
): Promise<void> {
  await appendSmartQueryDebugLog('api_request', 'api', {
    channel,
    ...detail,
  });
}

export async function logSmartQueryApiResponse(
  channel: SmartQueryDebugChannel,
  detail: {
    endpoint: string;
    httpStatus: number;
    durationMs: number;
    result: SmartQueryExtractResult | null;
    error?: string;
    responsePreview?: string;
  },
): Promise<void> {
  const payload: LogPayload = {
    channel,
    endpoint: detail.endpoint,
    httpStatus: detail.httpStatus,
    durationMs: detail.durationMs,
    error: detail.error,
    ...summarizeExtractResult(detail.result),
  };

  if (detail.responsePreview) {
    payload.responsePreview = detail.responsePreview;
  }

  if (detail.httpStatus >= 400 || detail.error) {
    await appendSmartQueryDebugLog('api_http_error', 'api', payload);
    return;
  }

  if (detail.result && detail.result.ok === false) {
    await appendSmartQueryDebugLog('api_response', 'api', { ...payload, phase: 'data_not_ok' });
    return;
  }

  await appendSmartQueryDebugLog('api_response', 'api', payload);
}

export async function logSmartQueryResolveStart(
  source: 'orb' | 'modal' | 'resolve',
  channel: SmartQueryDebugChannel,
  result: SmartQueryExtractResult,
): Promise<void> {
  await appendSmartQueryDebugLog('resolve_start', source, {
    channel,
    ...summarizeExtractResult(result),
  });
}

export async function logSmartQueryResolveSuccess(
  source: 'orb' | 'modal' | 'resolve',
  channel: SmartQueryDebugChannel,
  detail: {
    summary: string;
    mahalleTkgmValue: number;
    quarterId?: number;
    cityName?: string;
    townName?: string;
    quarterName?: string;
  },
): Promise<void> {
  await appendSmartQueryDebugLog('resolve_success', source, {
    channel,
    ...detail,
  });
}

export async function logSmartQueryResolveFailed(
  source: 'orb' | 'modal' | 'resolve',
  channel: SmartQueryDebugChannel,
  detail: {
    error: string;
    result?: SmartQueryExtractResult;
    debug?: VoiceLocationResolveDebug;
  },
): Promise<void> {
  await appendSmartQueryDebugLog('resolve_failed', source, {
    channel,
    error: detail.error,
    ...(detail.result ? summarizeExtractResult(detail.result) : {}),
    locationDebug: detail.debug ?? null,
  });
}

export async function shareSmartQueryDebugLog(): Promise<void> {
  const tail = await readSmartQueryDebugLogTail();
  const message = [
    'ProParcel — Akıllı Sorgu debug log',
    `Dosya: ${SMART_QUERY_DEBUG_LOG_PATH}`,
    `Tarih: ${new Date().toISOString()}`,
    '',
    tail,
  ].join('\n');

  await Share.share({ message, title: 'Akıllı Sorgu log' }).catch(() => {});
}
