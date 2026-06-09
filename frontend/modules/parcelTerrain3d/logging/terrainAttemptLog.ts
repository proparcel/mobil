import { NativeModules, Platform } from 'react-native';
import type {
  TerrainAttemptLogFile,
  TerrainAttemptLogLevel,
  TerrainAttemptLogMeta,
  TerrainAttemptLogSource,
  TerrainAttemptStatus,
} from './terrainAttemptLog.types';
import {
  hasTerrainAttemptLogNative,
  nativeAppendEvent,
  nativeBeginAttempt,
  nativeFinishAttempt,
  nativeGetLogsDirectory,
  nativeReadAttempt,
  nativeSetActiveAttempt,
} from '../native/TerrainAttemptLogModule';

const WORKSPACE_LOG_HINT = 'frontend/logs/terrain3d/{attemptId}.json';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function createTerrainAttemptId(): string {
  const d = new Date();
  const stamp =
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_` +
    `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `ta_${stamp}_${rand}`;
}

function resolveMetroHost(): string | null {
  try {
    const scriptURL: string | undefined = NativeModules.SourceCode?.scriptURL;
    if (!scriptURL) return null;
    const match = scriptURL.match(/^https?:\/\/([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function syncAttemptToWorkspace(log: TerrainAttemptLogFile): Promise<string | null> {
  if (!__DEV__) return null;
  const host = resolveMetroHost();
  if (!host) return null;
  try {
    const res = await fetch(`http://${host}/terrain-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; file?: string };
    return json.file ?? null;
  } catch {
    return null;
  }
}

export async function beginTerrainAttempt(meta: TerrainAttemptLogMeta): Promise<string> {
  const attemptId = createTerrainAttemptId();
  if (hasTerrainAttemptLogNative()) {
    await nativeBeginAttempt(attemptId, meta);
    nativeSetActiveAttempt(attemptId);
  }
  await logTerrainAttempt(attemptId, 'rn', 'info', 'attempt.begin', {
    meta,
    workspaceHint: WORKSPACE_LOG_HINT,
  });
  return attemptId;
}

export async function logTerrainAttempt(
  attemptId: string,
  source: TerrainAttemptLogSource,
  level: TerrainAttemptLogLevel,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (__DEV__) {
    console.log(`[TerrainAttempt ${attemptId}] ${source}/${level}: ${message}`, data ?? '');
  }
  if (hasTerrainAttemptLogNative()) {
    await nativeAppendEvent(attemptId, source, level, message, data);
  }
}

export async function finishTerrainAttempt(
  attemptId: string,
  status: TerrainAttemptStatus,
  summary?: Record<string, unknown>,
): Promise<TerrainAttemptLogFile | null> {
  await logTerrainAttempt(attemptId, 'rn', status === 'error' ? 'error' : 'info', 'attempt.finish', {
    status,
    ...summary,
  });

  if (hasTerrainAttemptLogNative()) {
    await nativeFinishAttempt(attemptId, status, summary);
    nativeSetActiveAttempt('');
  }

  const log = await nativeReadAttempt(attemptId);
  if (log) {
    const workspaceFile = await syncAttemptToWorkspace(log);
    if (__DEV__) {
      console.log(
        `[TerrainAttempt ${attemptId}] saved device=${log.devicePath ?? '?'} workspace=${workspaceFile ?? 'sync-failed (Metro acik mi?)'}`,
      );
    }
  }
  return log;
}

export async function readTerrainAttemptLog(attemptId: string): Promise<TerrainAttemptLogFile | null> {
  return nativeReadAttempt(attemptId);
}

export async function getTerrainAttemptLogsDirectory(): Promise<string | null> {
  return nativeGetLogsDirectory();
}

export function getTerrainWorkspaceLogPath(attemptId: string): string {
  return `mobile/mobil_github/frontend/logs/terrain3d/${attemptId}.json`;
}
