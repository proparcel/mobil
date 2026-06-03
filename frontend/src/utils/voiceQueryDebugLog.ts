import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

/** Cihazda kalıcı ses sorgusu debug günlüğü (JSON Lines). */
export const VOICE_QUERY_DEBUG_LOG_PATH = `${RNFS.DocumentDirectoryPath}/voice-query-debug.log`;

const MAX_LOG_BYTES = 512 * 1024;

export type VoiceQueryLogSource = 'orb' | 'modal' | 'recorder' | 'api';

export type VoiceQueryLogEvent =
  | 'session_header'
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
  | 'api_network_error';

type LogPayload = Record<string, unknown>;

async function trimLogIfNeeded(): Promise<void> {
  const exists = await RNFS.exists(VOICE_QUERY_DEBUG_LOG_PATH);
  if (!exists) return;

  const stat = await RNFS.stat(VOICE_QUERY_DEBUG_LOG_PATH);
  if (stat.size <= MAX_LOG_BYTES) return;

  const content = await RNFS.readFile(VOICE_QUERY_DEBUG_LOG_PATH, 'utf8');
  const trimmed = content.slice(-Math.floor(MAX_LOG_BYTES / 2));
  await RNFS.writeFile(VOICE_QUERY_DEBUG_LOG_PATH, trimmed, 'utf8');
}

export function getVoiceQueryDebugLogPath(): string {
  return VOICE_QUERY_DEBUG_LOG_PATH;
}

export async function readVoiceQueryDebugLog(): Promise<string> {
  try {
    if (!(await RNFS.exists(VOICE_QUERY_DEBUG_LOG_PATH))) return '';
    return await RNFS.readFile(VOICE_QUERY_DEBUG_LOG_PATH, 'utf8');
  } catch {
    return '';
  }
}

export async function appendVoiceQueryDebugLog(
  event: VoiceQueryLogEvent,
  source: VoiceQueryLogSource,
  data?: LogPayload
): Promise<void> {
  const entry = {
    ts: new Date().toISOString(),
    event,
    source,
    platform: Platform.OS,
    platformVersion: String(Platform.Version),
    ...data,
  };

  const line = `${JSON.stringify(entry)}\n`;

  try {
    await trimLogIfNeeded();
    const exists = await RNFS.exists(VOICE_QUERY_DEBUG_LOG_PATH);
    if (exists) {
      await RNFS.appendFile(VOICE_QUERY_DEBUG_LOG_PATH, line, 'utf8');
    } else {
      await RNFS.writeFile(VOICE_QUERY_DEBUG_LOG_PATH, line, 'utf8');
    }

    if (__DEV__) {
      console.log('[VoiceQueryDebug]', event, source, data ?? {});
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[VoiceQueryDebug] yazılamadı:', error);
    }
  }
}

/** Yeni oturum başında dosya yolunu günlüğe yazar (adb pull / paylaşım için). */
export async function logVoiceQuerySessionHeader(context: VoiceQueryLogSource): Promise<void> {
  await appendVoiceQueryDebugLog('session_header', context, {
    logPath: VOICE_QUERY_DEBUG_LOG_PATH,
    hint: 'Android: adb pull ' + VOICE_QUERY_DEBUG_LOG_PATH.replace(/^\/data\//, '/data//'),
  });
}
