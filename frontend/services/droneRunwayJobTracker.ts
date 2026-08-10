import { AppState, type AppStateStatus } from "react-native";

import {
  classifyRunwayStatus,
  DRONE_RUNWAY_STALE_MS,
  fetchRunwayJobStatus,
  isMyVideoReady,
  listDroneMyVideos,
  resolveDroneProjectDisplayName,
  runwayProgressLabel,
} from "./droneRunwayService";
import {
  clearActiveDroneJob,
  getActiveDroneJob,
  updateActiveDroneJobProgress,
} from "./droneRunwayActiveJobStorage";
import { notifyDroneVideoReady } from "./droneRunwayLocalNotification";

type DroneRunwayJobReadyListener = (jobId: string) => void;
const jobReadyListeners = new Set<DroneRunwayJobReadyListener>();

export function subscribeDroneRunwayJobReady(listener: DroneRunwayJobReadyListener): () => void {
  jobReadyListeners.add(listener);
  return () => jobReadyListeners.delete(listener);
}

function emitDroneRunwayJobReady(jobId: string): void {
  for (const listener of jobReadyListeners) {
    try {
      listener(jobId);
    } catch {
      /* UI listener */
    }
  }
}

let initialized = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollingJobId: string | null = null;
let appStateSubscription: { remove: () => void } | null = null;

const POLL_INTERVAL_MS = 2000;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollingJobId = null;
}

async function handleJobReady(jobId: string, label?: string): Promise<void> {
  stopPolling();
  await clearActiveDroneJob();
  emitDroneRunwayJobReady(jobId);
  await notifyDroneVideoReady(jobId, label);
}

async function handleJobFailed(): Promise<void> {
  stopPolling();
  await clearActiveDroneJob();
}

async function pollOnce(jobId: string): Promise<void> {
  const active = await getActiveDroneJob();
  if (!active || active.jobId !== jobId) {
    stopPolling();
    return;
  }

  if (Date.now() - active.startedAt > DRONE_RUNWAY_STALE_MS) {
    // 24 saat — storage tut, failed sayma
    stopPolling();
    return;
  }

  const statusRes = await fetchRunwayJobStatus(jobId);
  if (!statusRes.ok) return;

  const status = statusRes.status;
  const label = runwayProgressLabel(status);
  await updateActiveDroneJobProgress(label);

  const { isReady, isFailed } = classifyRunwayStatus(status);
  if (isFailed) {
    await handleJobFailed();
    return;
  }
  if (isReady) {
    await handleJobReady(jobId, label);
  }
}

async function tryResolveFromMyVideos(jobId: string): Promise<boolean> {
  const list = await listDroneMyVideos();
  if (!list.ok) return false;
  const row = list.videos.find((v) => String(v.job_id) === jobId);
  if (!row) return false;
  if (isMyVideoReady(row)) {
    await handleJobReady(jobId, resolveDroneProjectDisplayName(row));
    return true;
  }
  if (isMyVideoFailed(row)) {
    await handleJobFailed();
    return true;
  }
  return false;
}

export function startDroneRunwayBackgroundPoll(jobId: string): void {
  const id = String(jobId || "").trim();
  if (!id) return;
  if (pollingJobId === id && pollTimer) return;

  stopPolling();
  pollingJobId = id;

  void (async () => {
    if (await tryResolveFromMyVideos(id)) return;
    await pollOnce(id);
  })();

  pollTimer = setInterval(() => {
    void pollOnce(id);
  }, POLL_INTERVAL_MS);
}

export async function resumeActiveDroneJobTracking(): Promise<void> {
  const active = await getActiveDroneJob();
  if (!active?.jobId) return;

  if (await tryResolveFromMyVideos(active.jobId)) return;

  const statusRes = await fetchRunwayJobStatus(active.jobId);
  if (statusRes.ok) {
    const { isReady, isFailed } = classifyRunwayStatus(statusRes.status);
    if (isFailed) {
      await handleJobFailed();
      return;
    }
    if (isReady) {
      await handleJobReady(active.jobId, runwayProgressLabel(statusRes.status));
      return;
    }
  }

  if (AppState.currentState === "active") {
    startDroneRunwayBackgroundPoll(active.jobId);
  }
}

function onAppStateChange(next: AppStateStatus) {
  if (next === "active") {
    void resumeActiveDroneJobTracking();
  } else {
    stopPolling();
  }
}

export function initDroneRunwayJobTracker(): void {
  if (initialized) return;
  initialized = true;
  appStateSubscription = AppState.addEventListener("change", onAppStateChange);
  void resumeActiveDroneJobTracking();
}

export function teardownDroneRunwayJobTracker(): void {
  stopPolling();
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  initialized = false;
}
