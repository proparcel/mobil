import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "proparcel_active_drone_job";

export type ActiveDroneJobRecord = {
  jobId: string;
  projectId?: string;
  referenceId?: string;
  startedAt: number;
  lastProgressLabel?: string;
  refFrameCount?: number;
  source?: "mobile_drone_simple_editor";
};

export async function getActiveDroneJob(): Promise<ActiveDroneJobRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveDroneJobRecord;
    if (!parsed?.jobId || !parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setActiveDroneJob(record: ActiveDroneJobRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn("[droneRunwayActiveJob] set failed", error);
  }
}

export async function clearActiveDroneJob(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[droneRunwayActiveJob] clear failed", error);
  }
}

export async function updateActiveDroneJobProgress(label: string): Promise<void> {
  const current = await getActiveDroneJob();
  if (!current) return;
  await setActiveDroneJob({
    ...current,
    lastProgressLabel: label,
  });
}
