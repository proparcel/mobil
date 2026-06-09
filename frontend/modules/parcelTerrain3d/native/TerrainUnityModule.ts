import { Alert, NativeModules, Platform } from 'react-native';

type TerrainUnityNativeModule = {
  isAvailable: () => Promise<boolean>;
  openTerrainActivity: (
    attemptId: string | null,
    terrainJson: string | null,
    embeddedDemo: boolean,
    titleAda: string | null,
    titleParsel: string | null,
  ) => Promise<void>;
};

const nativeModule: TerrainUnityNativeModule | undefined =
  NativeModules.TerrainUnityModule as TerrainUnityNativeModule | undefined;

export async function isTerrainUnityAvailable(): Promise<boolean> {
  if (!nativeModule?.isAvailable) return false;
  try {
    return await nativeModule.isAvailable();
  } catch {
    return false;
  }
}

export type OpenTerrainActivityOptions = {
  ada?: string | null;
  parsel?: string | null;
  /** true: Unity gomulu demo sahne (JSON yok) */
  embeddedDemo?: boolean;
};

/** Tam ekran native Activity — gercek terrain JSON veya gomulu demo. */
export async function openTerrainActivity(
  attemptId?: string,
  terrainJson?: string | null,
  options?: OpenTerrainActivityOptions,
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    Alert.alert('3D eğim', 'Tam ekran terrain viewer şu an yalnızca Android Activity ile açılır.');
    return false;
  }
  if (!nativeModule?.openTerrainActivity) {
    if (__DEV__) console.warn('[TerrainUnityModule] openTerrainActivity yok');
    return false;
  }

  const embeddedDemo = options?.embeddedDemo === true || !terrainJson?.trim();

  try {
    await nativeModule.openTerrainActivity(
      attemptId ?? null,
      embeddedDemo ? null : terrainJson ?? null,
      embeddedDemo,
      options?.ada ?? null,
      options?.parsel ?? null,
    );
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[TerrainUnityModule:openTerrainActivity]', err);
    return false;
  }
}

/** @deprecated RN embed viewer — Activity mimarisine gecildi. */
export async function openTerrainUnityViewer(_jsonPayload: string): Promise<boolean> {
  return false;
}

/** @deprecated Activity finish() ile kapanir. */
export async function closeTerrainUnityViewer(): Promise<void> {}

/** @deprecated Activity lifecycle kullanilir. */
export async function resumeTerrainUnityViewer(): Promise<void> {}

export function hasTerrainUnityNativeBridge(): boolean {
  return Boolean(nativeModule?.isAvailable);
}
