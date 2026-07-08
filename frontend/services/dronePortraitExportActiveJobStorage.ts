import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "proparcel_active_portrait_export_job";

export type PortraitExportJobPhase = "polling" | "downloading" | "done";

export type ActivePortraitExportJobRecord = {
  jobId: string;
  startedAt: number;
  exportId?: string;
  phase?: PortraitExportJobPhase;
  completedExportId?: string;
  lastStatus?: string;
};

export async function getActivePortraitExportJob(): Promise<ActivePortraitExportJobRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActivePortraitExportJobRecord;
    if (!parsed?.jobId || !parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setActivePortraitExportJob(record: ActivePortraitExportJobRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn("[dronePortraitExportActiveJob] set failed", error);
  }
}

export async function clearActivePortraitExportJob(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[dronePortraitExportActiveJob] clear failed", error);
  }
}

export async function updateActivePortraitExportJobStatus(status: string): Promise<void> {
  const current = await getActivePortraitExportJob();
  if (!current) return;
  await setActivePortraitExportJob({
    ...current,
    lastStatus: status,
  });
}

export async function patchActivePortraitExportJob(
  patch: Partial<ActivePortraitExportJobRecord>,
): Promise<void> {
  const current = await getActivePortraitExportJob();
  if (!current) return;
  await setActivePortraitExportJob({
    ...current,
    ...patch,
  });
}
