import AsyncStorage from '@react-native-async-storage/async-storage';

/** Web ile aynı anahtar — sticky Doğrulama toggle tercihi. */
export const DOGRULAMA_TOGGLE_STORAGE_KEY = 'pp_dogrulama_toggle';

export async function readDogrulamaToggle(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(DOGRULAMA_TOGGLE_STORAGE_KEY);
    return value === '1';
  } catch {
    return false;
  }
}

export async function writeDogrulamaToggle(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(DOGRULAMA_TOGGLE_STORAGE_KEY, on ? '1' : '0');
  } catch {
    // best-effort
  }
}
