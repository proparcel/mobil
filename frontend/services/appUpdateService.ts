import { Platform } from 'react-native';
import { API_URL } from '../config/api';
import { compareSemver } from '../src/utils/compareSemver';
import { getInstalledAppVersion, getInstalledBuildNumber } from '../src/utils/appVersion';
import { getDismissedOptionalUpdateVersion } from '../src/utils/appUpdateStorage';

type PlatformPolicy = {
  min_version: string;
  latest_version: string;
  min_build?: number;
  latest_build?: number;
  force_message?: string;
  optional_message?: string;
};

type AppVersionApiResponse = {
  ios?: PlatformPolicy;
  android?: PlatformPolicy;
};

export type AppUpdateCheckResult =
  | { kind: 'none' }
  | { kind: 'force'; message: string }
  | { kind: 'optional'; message: string; latestVersion: string };

const DEFAULT_FORCE_MESSAGE = 'Uygulamayı güncellemeniz gerekiyor.';
const DEFAULT_OPTIONAL_MESSAGE = 'Yeni sürüm mevcut. Güncellemek ister misiniz?';

function getPlatformPolicy(data: AppVersionApiResponse): PlatformPolicy | null {
  const policy = Platform.OS === 'ios' ? data.ios : data.android;
  if (!policy?.min_version || !policy?.latest_version) return null;
  return policy;
}

function isBelowMin(policy: PlatformPolicy, currentVersion: string, currentBuild: number): boolean {
  if (compareSemver(currentVersion, policy.min_version) < 0) return true;
  if (Platform.OS === 'android' && policy.min_build != null && currentBuild < policy.min_build) {
    return true;
  }
  return false;
}

function hasOptionalUpdate(policy: PlatformPolicy, currentVersion: string, currentBuild: number): boolean {
  if (compareSemver(currentVersion, policy.latest_version) < 0) return true;
  if (Platform.OS === 'android' && policy.latest_build != null && currentBuild < policy.latest_build) {
    return true;
  }
  return false;
}

export async function checkAppUpdate(): Promise<AppUpdateCheckResult> {
  if (__DEV__) return { kind: 'none' };

  let data: AppVersionApiResponse;
  try {
    const res = await fetch(`${API_URL}/api/mobile/app-version/`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { kind: 'none' };
    data = (await res.json()) as AppVersionApiResponse;
  } catch {
    return { kind: 'none' };
  }

  const policy = getPlatformPolicy(data);
  if (!policy) return { kind: 'none' };

  const currentVersion = getInstalledAppVersion();
  const currentBuild = getInstalledBuildNumber();

  if (isBelowMin(policy, currentVersion, currentBuild)) {
    return {
      kind: 'force',
      message: policy.force_message?.trim() || DEFAULT_FORCE_MESSAGE,
    };
  }

  if (!hasOptionalUpdate(policy, currentVersion, currentBuild)) {
    return { kind: 'none' };
  }

  const dismissed = await getDismissedOptionalUpdateVersion();
  if (dismissed && compareSemver(dismissed, policy.latest_version) >= 0) {
    return { kind: 'none' };
  }

  return {
    kind: 'optional',
    message: policy.optional_message?.trim() || DEFAULT_OPTIONAL_MESSAGE,
    latestVersion: policy.latest_version,
  };
}
