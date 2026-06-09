export type TerrainAttemptLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type TerrainAttemptLogSource = 'rn' | 'kotlin' | 'unity';

export type TerrainAttemptStatus = 'running' | 'success' | 'error' | 'closed';

export type TerrainAttemptLogEvent = {
  t: string;
  ms: number;
  source: TerrainAttemptLogSource;
  level: TerrainAttemptLogLevel;
  message: string;
  data?: Record<string, unknown>;
};

export type TerrainAttemptLogMeta = {
  snapshotId?: number;
  mock?: boolean;
  embeddedDemo?: boolean;
  ada?: string | null;
  parsel?: string | null;
};

export type TerrainAttemptLogFile = {
  attemptId: string;
  startedAt: string;
  finishedAt?: string;
  status: TerrainAttemptStatus;
  meta: TerrainAttemptLogMeta;
  devicePath?: string;
  events: TerrainAttemptLogEvent[];
};
