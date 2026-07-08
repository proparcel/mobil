import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "proparcel_active_landscape_export_job";

export type LandscapeExportJobPhase = "polling" | "downloading" | "done";

export type ActiveLandscapeExportJobRecord = {
  jobId: string;
  startedAt: number;
  exportId?: string;
  phase?: LandscapeExportJobPhase;
  completedExportId?: string;
  lastStatus?: string;
};

export async function getActiveLandscapeExportJob(): Promise<ActiveLandscapeExportJobRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveLandscapeExportJobRecord;
    if (!parsed?.jobId || !parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setActiveLandscapeExportJob(record: ActiveLandscapeExportJobRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn("[droneLandscapeExportActiveJob] set failed", error);
  }
}

export async function clearActiveLandscapeExportJob(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[droneLandscapeExportActiveJob] clear failed", error);
  }
}

export async function updateActiveLandscapeExportJobStatus(status: string): Promise<void> {
  const current = await getActiveLandscapeExportJob();
  if (!current) return;
  await setActiveLandscapeExportJob({
    ...current,
    lastStatus: status,
  });
}

export async function patchActiveLandscapeExportJob(
  patch: Partial<ActiveLandscapeExportJobRecord>,
): Promise<void> {
  const current = await getActiveLandscapeExportJob();
  if (!current) return;
  await setActiveLandscapeExportJob({
    ...current,
    ...patch,
  });
}
