import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISSED_OPTIONAL_VERSION_KEY = 'proparcel_dismissed_optional_update_version';

export async function getDismissedOptionalUpdateVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(DISMISSED_OPTIONAL_VERSION_KEY);
  } catch {
    return null;
  }
}

export async function setDismissedOptionalUpdateVersion(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_OPTIONAL_VERSION_KEY, version);
  } catch {
    // best-effort
  }
}
