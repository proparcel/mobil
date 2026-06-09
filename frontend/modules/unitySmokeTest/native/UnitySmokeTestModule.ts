import { NativeModules, Platform } from 'react-native';

type UnitySmokeTestNativeModule = {
  isAvailable: () => Promise<boolean>;
  ping: (message: string) => Promise<void>;
};

const nativeModule: UnitySmokeTestNativeModule | undefined =
  NativeModules.UnitySmokeTestModule as UnitySmokeTestNativeModule | undefined;

export async function isUnitySmokeTestAvailable(): Promise<boolean> {
  if (!nativeModule?.isAvailable) return false;
  try {
    return await nativeModule.isAvailable();
  } catch {
    return false;
  }
}

export async function pingUnitySmokeTest(message: string): Promise<boolean> {
  if (!nativeModule?.ping) {
    if (__DEV__) console.warn('[UnitySmokeTestModule] native module yok');
    return false;
  }
  try {
    await nativeModule.ping(message);
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[UnitySmokeTestModule.ping]', err);
    return false;
  }
}

export function getUnitySmokePlatformHint(): string {
  if (Platform.OS !== 'android') {
    return 'Smoke test su an yalnizca Android embed icin hazirlandi.';
  }
  return 'Unity export (UnitySmokeTestScene index 0) + npm run android gerekir.';
}
