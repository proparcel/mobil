import Constants from 'expo-constants';
import { Platform } from 'react-native';

function readExpoConfig(): Record<string, unknown> | undefined {
  const cfg = Constants.expoConfig as Record<string, unknown> | null | undefined;
  if (cfg) return cfg;
  const manifest = (Constants as { manifest?: Record<string, unknown> }).manifest;
  return manifest;
}

/** Kullanıcıya görünen sürüm (versionName / CFBundleShortVersionString). */
export function getInstalledAppVersion(): string {
  const cfg = readExpoConfig();
  const version = cfg?.version;
  if (typeof version === 'string' && version.trim()) return version.trim();
  return '0.0.0';
}

/** Native build numarası (Android versionCode / iOS buildNumber). */
export function getInstalledBuildNumber(): number {
  const cfg = readExpoConfig();
  if (Platform.OS === 'android') {
    const code = (cfg?.android as { versionCode?: number } | undefined)?.versionCode;
    if (typeof code === 'number' && Number.isFinite(code)) return code;
  }
  if (Platform.OS === 'ios') {
    const build = (cfg?.ios as { buildNumber?: string | number } | undefined)?.buildNumber;
    const n = typeof build === 'string' ? parseInt(build, 10) : build;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return 0;
}
