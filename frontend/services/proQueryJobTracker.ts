import { AppState, type AppStateStatus } from 'react-native';

import { API_URL } from '../config/api';
import {
  extractSnapshotIdFromPayload,
  markProQueryNotifyOnComplete,
  resolveBackendApiUrl,
  type BackgroundProQueryPending,
} from '../src/utils/proQueryApi';
import { storageService } from './storageService';

export type ProQueryJobCompletePayload = {
  jobId: string;
  snapshotId: number | null;
  deepLink?: string;
  result: Record<string, unknown> | null;
  queuedReason?: string;
};

type ProQueryJobCompleteListener = (payload: ProQueryJobCompletePayload) => void;

const completeListeners = new Set<ProQueryJobCompleteListener>();
const activeWatches = new Map<string, () => void>();

const POLL_MS_QUEUED = 3500;
const POLL_MS_ACTIVE = 2000;

let initialized = false;
let appStateSubscription: { remove: () => void } | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function authFetch(url: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-PP-Client': 'mobile',
  };
  try {
    const tokens = await storageService.getTokens();
    if (tokens?.access) headers.Authorization = `Bearer ${tokens.access}`;
  } catch {
    // anonim
  }
  return fetch(url, { method: 'GET', headers });
}

export function subscribeProQueryJobComplete(listener: ProQueryJobCompleteListener): () => void {
  completeListeners.add(listener);
  return () => completeListeners.delete(listener);
}

/** Push / in-app bildirimden tamamlanma modalını tetikler. */
export function notifyProQueryJobComplete(payload: ProQueryJobCompletePayload): void {
  emitComplete(payload);
}

function emitComplete(payload: ProQueryJobCompletePayload): void {
  for (const listener of completeListeners) {
    try {
      listener(payload);
    } catch {
      /* UI listener */
    }
  }
}

function extractSnapshotId(obj: Record<string, unknown> | null | undefined): number | null {
  if (!obj) return null;
  const raw =
    (obj.parameters_data as any)?.dfa_snapshot_id ??
    obj.dfa_snapshot_id ??
    obj.snapshot_id ??
    null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchJobPayload(resultUrl: string): Promise<{ resp: Response; body: any }> {
  const resp = await authFetch(resultUrl);
  let body: any = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  return { resp, body };
}

export function startProQueryBackgroundWatch(pending: BackgroundProQueryPending): void {
  const jobId = String(pending?.job_id || '').trim();
  if (!jobId || activeWatches.has(jobId)) return;

  void markProQueryNotifyOnComplete(jobId);

  const backendUrl = (API_URL || '').replace(/\/$/, '');
  const resultUrl =
    resolveBackendApiUrl(backendUrl, pending.result_url) ||
    `${backendUrl}/api/get_parcel_result/${encodeURIComponent(jobId)}/`;

  let stopped = false;
  const stop = () => {
    stopped = true;
    activeWatches.delete(jobId);
  };
  activeWatches.set(jobId, stop);

  void (async function loop() {
    while (!stopped) {
      try {
        const { resp, body } = await fetchJobPayload(resultUrl);
        if (resp.status === 200 && body && typeof body === 'object' && !body.error) {
          stop();
          emitComplete({
            jobId,
            snapshotId: extractSnapshotId(body) ?? extractSnapshotIdFromPayload(body),
            result: body,
            queuedReason: pending.queued_reason,
          });
          return;
        }
        if (resp.status === 504 || resp.status === 410) {
          stop();
          return;
        }
        const st = String(body?.status || '');
        const queued =
          Boolean(body?.queued) ||
          st === 'queued_admission' ||
          st === 'queued_backpressure' ||
          st === 'queued_apify';
        await sleep(queued ? POLL_MS_QUEUED : POLL_MS_ACTIVE);
      } catch {
        if (stopped) return;
        await sleep(POLL_MS_QUEUED);
      }
    }
  })();
}

export function stopProQueryBackgroundWatch(jobId: string): void {
  const stop = activeWatches.get(String(jobId || '').trim());
  if (stop) stop();
}

export function initProQueryJobTracker(): void {
  if (initialized) return;
  initialized = true;
  appStateSubscription = AppState.addEventListener('change', (_state: AppStateStatus) => {
    // Poll döngüleri zaten aktif; ek işlem gerekmez.
  });
}

export function teardownProQueryJobTracker(): void {
  for (const stop of activeWatches.values()) stop();
  activeWatches.clear();
  appStateSubscription?.remove();
  appStateSubscription = null;
  initialized = false;
}
