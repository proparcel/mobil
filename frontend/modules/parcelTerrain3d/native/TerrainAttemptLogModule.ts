import { NativeModules, Platform } from 'react-native';
import type {
  TerrainAttemptLogFile,
  TerrainAttemptLogLevel,
  TerrainAttemptLogMeta,
  TerrainAttemptLogSource,
  TerrainAttemptStatus,
} from '../logging/terrainAttemptLog.types';

type TerrainAttemptLogNative = {
  beginAttempt: (attemptId: string, metaJson: string) => Promise<string>;
  appendEvent: (
    attemptId: string,
    source: string,
    level: string,
    message: string,
    dataJson: string,
  ) => Promise<void>;
  finishAttempt: (attemptId: string, status: string, summaryJson: string) => Promise<string>;
  readAttempt: (attemptId: string) => Promise<string>;
  listRecentAttempts: (limit: number) => Promise<string>;
  getLogsDirectory: () => Promise<string>;
  setActiveAttempt: (attemptId: string) => void;
};

const native: TerrainAttemptLogNative | undefined =
  NativeModules.TerrainAttemptLogModule as TerrainAttemptLogNative | undefined;

export function hasTerrainAttemptLogNative(): boolean {
  return Platform.OS === 'android' && Boolean(native?.beginAttempt);
}

export async function nativeBeginAttempt(
  attemptId: string,
  meta: TerrainAttemptLogMeta,
): Promise<string | null> {
  if (!native?.beginAttempt) return null;
  return native.beginAttempt(attemptId, JSON.stringify(meta));
}

export async function nativeAppendEvent(
  attemptId: string,
  source: TerrainAttemptLogSource,
  level: TerrainAttemptLogLevel,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!native?.appendEvent) return;
  await native.appendEvent(attemptId, source, level, message, JSON.stringify(data ?? {}));
}

export async function nativeFinishAttempt(
  attemptId: string,
  status: TerrainAttemptStatus,
  summary?: Record<string, unknown>,
): Promise<string | null> {
  if (!native?.finishAttempt) return null;
  return native.finishAttempt(attemptId, status, JSON.stringify(summary ?? {}));
}

export async function nativeReadAttempt(attemptId: string): Promise<TerrainAttemptLogFile | null> {
  if (!native?.readAttempt) return null;
  const raw = await native.readAttempt(attemptId);
  if (!raw) return null;
  return JSON.parse(raw) as TerrainAttemptLogFile;
}

export async function nativeListRecentAttempts(limit = 20): Promise<TerrainAttemptLogFile[]> {
  if (!native?.listRecentAttempts) return [];
  const raw = await native.listRecentAttempts(limit);
  if (!raw) return [];
  return JSON.parse(raw) as TerrainAttemptLogFile[];
}

export function nativeSetActiveAttempt(attemptId: string): void {
  native?.setActiveAttempt?.(attemptId);
}

export async function nativeGetLogsDirectory(): Promise<string | null> {
  if (!native?.getLogsDirectory) return null;
  return native.getLogsDirectory();
}
