type SimpleQueryLogEntry = {
  ts: string;
  event: string;
  data?: Record<string, unknown>;
};

const LOG_PREFIX = '[SimpleQuery]';
const MAX_ENTRIES = 200;
const buffer: SimpleQueryLogEntry[] = [];

function safeData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  try {
    JSON.parse(JSON.stringify(data));
    return data;
  } catch {
    return { note: 'unserializable_data' };
  }
}

export function logSimpleQuery(event: string, data?: Record<string, unknown>): void {
  const entry: SimpleQueryLogEntry = {
    ts: new Date().toISOString(),
    event,
    data: safeData(data),
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
  if (entry.data) {
    console.log(`${LOG_PREFIX} ${event}`, entry.data);
  } else {
    console.log(`${LOG_PREFIX} ${event}`);
  }
}

export function getSimpleQueryLogs(): SimpleQueryLogEntry[] {
  return [...buffer];
}

export function dumpSimpleQueryLogs(): string {
  return buffer
    .map((entry) => `${entry.ts} ${entry.event} ${JSON.stringify(entry.data ?? {})}`)
    .join('\n');
}

export function logSimpleQueryAlert(
  source: string,
  title: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  logSimpleQuery('alert_shown', {
    source,
    title,
    message,
    ...extra,
  });
}

const RECENT_SUCCESS_SUPPRESS_MS = 5000;
let lastSimpleQuerySuccessAt = 0;

export function markSimpleQuerySuccess(source: string, extra?: Record<string, unknown>): void {
  lastSimpleQuerySuccessAt = Date.now();
  logSimpleQuery('simple_query_mark_success', { source, at: lastSimpleQuerySuccessAt, ...extra });
}

export function shouldSuppressQueryErrorAlert(source: string, extra?: Record<string, unknown>): boolean {
  const ageMs = Date.now() - lastSimpleQuerySuccessAt;
  if (lastSimpleQuerySuccessAt > 0 && ageMs < RECENT_SUCCESS_SUPPRESS_MS) {
    logSimpleQuery('alert_suppressed_after_recent_success', { source, ageMs, ...extra });
    return true;
  }
  return false;
}
