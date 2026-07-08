import { Alert, AppState, type AppStateStatus } from "react-native";
import RNFS from "react-native-fs";

import { getApiAuthHeaders } from "./apiClient";
import {
  classifyPortraitExportStatus,
  fetchPortraitExportStatus,
  portraitExportDownloadUrl,
} from "./aiDroneSimpleEditorService";
import {
  clearActivePortraitExportJob,
  getActivePortraitExportJob,
  patchActivePortraitExportJob,
  setActivePortraitExportJob,
  updateActivePortraitExportJobStatus,
} from "./dronePortraitExportActiveJobStorage";
import { saveVideoFileToPhotoLibrary } from "../src/utils/saveToDeviceGallery";

function showForegroundExportAlert(title: string, message: string): void {
  if (AppState.currentState !== "active") return;
  setTimeout(() => {
    Alert.alert(title, message);
  }, 400);
}

export const DRONE_PORTRAIT_EXPORT_STALE_MS = 2 * 60 * 60 * 1000;

let initialized = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollingJobId: string | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let terminalHandlingKey: string | null = null;

const POLL_INTERVAL_MS = 2000;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollingJobId = null;
}

function terminalKey(jobId: string, exportId: string | undefined, kind: "ready" | "failed"): string {
  return `${jobId}:${String(exportId || "").trim()}:${kind}`;
}

function tryAcquireTerminalHandling(jobId: string, exportId: string | undefined, kind: "ready" | "failed"): boolean {
  const key = terminalKey(jobId, exportId, kind);
  if (terminalHandlingKey && terminalHandlingKey !== key) {
    return false;
  }
  if (terminalHandlingKey === key) {
    return false;
  }
  terminalHandlingKey = key;
  return true;
}

function releaseTerminalHandling(): void {
  terminalHandlingKey = null;
}

function exportAlreadyCompleted(
  active: { exportId?: string; phase?: string; completedExportId?: string },
): boolean {
  if (active.phase === "done") return true;
  const expected = String(active.exportId || "").trim();
  const completed = String(active.completedExportId || "").trim();
  return Boolean(expected && completed && expected === completed);
}

function exportMatchesActive(
  activeExportId: string | undefined,
  snapshotExportId: string,
  status: string,
): boolean {
  const expected = String(activeExportId || "").trim();
  const current = String(snapshotExportId || "").trim();
  if (!expected) return true;
  if (!current) return status === "processing" || status === "queued";
  return current === expected;
}

async function downloadPortraitExportToGallery(
  jobId: string,
  outputFile?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = portraitExportDownloadUrl(jobId, outputFile);
  const cachePath = `${RNFS.CachesDirectoryPath}/drone_portrait_export_${jobId}_${Date.now()}.mp4`;
  const headers = await getApiAuthHeaders();

  try {
    const dl = await RNFS.downloadFile({ fromUrl: url, toFile: cachePath, headers }).promise;
    const statusCode = dl?.statusCode;
    if (statusCode && statusCode >= 400) {
      return { ok: false, error: `İndirme başarısız (HTTP ${statusCode})` };
    }

    const exists = await RNFS.exists(cachePath);
    if (!exists) {
      return { ok: false, error: "Video dosyası indirilemedi." };
    }

    const stat = await RNFS.stat(cachePath);
    if (!stat?.size) {
      return { ok: false, error: "İndirilen video dosyası boş." };
    }

    const fileUri = cachePath.startsWith("file://") ? cachePath : `file://${cachePath}`;
    const saved = await saveVideoFileToPhotoLibrary(fileUri);
    if (!saved.ok) {
      return { ok: false, error: saved.error || "Galeriye kayıt başarısız." };
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Video indirilemedi." };
  } finally {
    try {
      const exists = await RNFS.exists(cachePath);
      if (exists) await RNFS.unlink(cachePath);
    } catch {
      /* cache temizliği */
    }
  }
}

async function handleExportReady(
  jobId: string,
  exportId: string | undefined,
  outputFile?: string,
): Promise<void> {
  if (!tryAcquireTerminalHandling(jobId, exportId, "ready")) return;

  stopPolling();
  await patchActivePortraitExportJob({ phase: "downloading" });

  try {
    const saved = await downloadPortraitExportToGallery(jobId, outputFile);
    if (saved.ok) {
      await patchActivePortraitExportJob({
        phase: "done",
        completedExportId: String(exportId || "").trim() || undefined,
      });
      await clearActivePortraitExportJob();
      showForegroundExportAlert(
        "Video galeriye kaydedildi",
        "Dikey drone videonuz telefon galerinize indirildi.",
      );
    } else {
      showForegroundExportAlert("Video dışa aktarılamadı", saved.error);
      await clearActivePortraitExportJob();
    }
  } finally {
    releaseTerminalHandling();
  }
}

async function handleExportFailed(
  jobId: string,
  exportId: string | undefined,
  reason?: string,
): Promise<void> {
  if (!tryAcquireTerminalHandling(jobId, exportId, "failed")) return;

  stopPolling();
  await clearActivePortraitExportJob();
  showForegroundExportAlert(
    "Video dışa aktarılamadı",
    reason?.trim() || "Dışa aktarma tamamlanamadı. Editörden tekrar deneyebilirsiniz.",
  );
  releaseTerminalHandling();
}

async function pollOnce(jobId: string): Promise<void> {
  if (terminalHandlingKey) return;

  const active = await getActivePortraitExportJob();
  if (!active || active.jobId !== jobId) {
    stopPolling();
    return;
  }

  if (exportAlreadyCompleted(active) || active.phase === "downloading") {
    return;
  }

  if (Date.now() - active.startedAt > DRONE_PORTRAIT_EXPORT_STALE_MS) {
    stopPolling();
    return;
  }

  const snapshot = await fetchPortraitExportStatus(jobId);
  if (snapshot.transient) {
    return;
  }

  await updateActivePortraitExportJobStatus(snapshot.status);

  if (!exportMatchesActive(active.exportId, snapshot.exportId, snapshot.status)) {
    return;
  }

  const { isReady, isFailed } = classifyPortraitExportStatus(snapshot.status);
  if (isFailed) {
    await handleExportFailed(jobId, active.exportId);
    return;
  }
  if (isReady) {
    await handleExportReady(jobId, active.exportId, snapshot.outputFile || undefined);
  }
}

export function startDronePortraitExportBackgroundPoll(jobId: string): void {
  const id = String(jobId || "").trim();
  if (!id) return;
  if (pollingJobId === id && pollTimer) return;

  stopPolling();
  pollingJobId = id;

  void pollOnce(id);

  pollTimer = setInterval(() => {
    void pollOnce(id);
  }, POLL_INTERVAL_MS);
}

export async function beginDronePortraitExportJob(jobId: string, exportId?: string): Promise<void> {
  const id = String(jobId || "").trim();
  if (!id) return;
  releaseTerminalHandling();
  await setActivePortraitExportJob({
    jobId: id,
    startedAt: Date.now(),
    exportId: String(exportId || "").trim() || undefined,
    phase: "polling",
  });
  startDronePortraitExportBackgroundPoll(id);
}

export async function resumeActivePortraitExportTracking(): Promise<void> {
  const active = await getActivePortraitExportJob();
  if (!active?.jobId) return;

  if (exportAlreadyCompleted(active) || active.phase === "downloading") {
    return;
  }

  if (terminalHandlingKey) return;

  const snapshot = await fetchPortraitExportStatus(active.jobId);
  if (snapshot.transient) {
    if (AppState.currentState === "active") {
      startDronePortraitExportBackgroundPoll(active.jobId);
    }
    return;
  }

  if (!exportMatchesActive(active.exportId, snapshot.exportId, snapshot.status)) {
    if (AppState.currentState === "active") {
      startDronePortraitExportBackgroundPoll(active.jobId);
    }
    return;
  }

  const { isReady, isFailed } = classifyPortraitExportStatus(snapshot.status);
  if (isFailed) {
    await handleExportFailed(active.jobId, active.exportId);
    return;
  }
  if (isReady) {
    await handleExportReady(active.jobId, active.exportId, snapshot.outputFile || undefined);
    return;
  }

  if (AppState.currentState === "active") {
    startDronePortraitExportBackgroundPoll(active.jobId);
  }
}

function onAppStateChange(next: AppStateStatus) {
  if (next === "active") {
    void resumeActivePortraitExportTracking();
  } else {
    stopPolling();
  }
}

export function initDronePortraitExportJobTracker(): void {
  if (initialized) return;
  initialized = true;
  appStateSubscription = AppState.addEventListener("change", onAppStateChange);
  void resumeActivePortraitExportTracking();
}

export function teardownDronePortraitExportJobTracker(): void {
  stopPolling();
  releaseTerminalHandling();
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  initialized = false;
}
