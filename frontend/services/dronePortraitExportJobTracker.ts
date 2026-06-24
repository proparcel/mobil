import { Alert, AppState, type AppStateStatus } from "react-native";
import RNFS from "react-native-fs";

import { getApiAuthHeaders } from "./apiClient";
import {
  classifyPortraitExportStatus,
  getPortraitExportStatus,
  portraitExportDownloadUrl,
} from "./aiDroneSimpleEditorService";
import {
  clearActivePortraitExportJob,
  getActivePortraitExportJob,
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

const POLL_INTERVAL_MS = 2000;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollingJobId = null;
}

async function downloadPortraitExportToGallery(jobId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = portraitExportDownloadUrl(jobId);
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

async function handleExportReady(jobId: string): Promise<void> {
  stopPolling();
  const saved = await downloadPortraitExportToGallery(jobId);
  await clearActivePortraitExportJob();
  if (saved.ok) {
    showForegroundExportAlert(
      "Video galeriye kaydedildi",
      "Dikey drone videonuz telefon galerinize indirildi.",
    );
  } else {
    showForegroundExportAlert("Video dışa aktarılamadı", saved.error);
  }
}

async function handleExportFailed(jobId: string, reason?: string): Promise<void> {
  stopPolling();
  await clearActivePortraitExportJob();
  showForegroundExportAlert(
    "Video dışa aktarılamadı",
    reason?.trim() || "Dışa aktarma tamamlanamadı. Editörden tekrar deneyebilirsiniz.",
  );
}

async function pollOnce(jobId: string): Promise<void> {
  const active = await getActivePortraitExportJob();
  if (!active || active.jobId !== jobId) {
    stopPolling();
    return;
  }

  if (Date.now() - active.startedAt > DRONE_PORTRAIT_EXPORT_STALE_MS) {
    stopPolling();
    return;
  }

  const status = await getPortraitExportStatus(jobId);
  await updateActivePortraitExportJobStatus(status);

  const { isReady, isFailed } = classifyPortraitExportStatus(status);
  if (isFailed) {
    await handleExportFailed(jobId);
    return;
  }
  if (isReady) {
    await handleExportReady(jobId);
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

export async function beginDronePortraitExportJob(jobId: string): Promise<void> {
  const id = String(jobId || "").trim();
  if (!id) return;
  await setActivePortraitExportJob({ jobId: id, startedAt: Date.now() });
  startDronePortraitExportBackgroundPoll(id);
}

export async function resumeActivePortraitExportTracking(): Promise<void> {
  const active = await getActivePortraitExportJob();
  if (!active?.jobId) return;

  const status = await getPortraitExportStatus(active.jobId);
  const { isReady, isFailed } = classifyPortraitExportStatus(status);
  if (isFailed) {
    await handleExportFailed(active.jobId);
    return;
  }
  if (isReady) {
    await handleExportReady(active.jobId);
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
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  initialized = false;
}
