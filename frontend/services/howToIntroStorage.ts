import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "proparcel_howto_intro_seen_user_";

function storageKey(userId: number): string {
  return `${KEY_PREFIX}${userId}`;
}

export async function hasSeenHowToIntro(userId: number): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(storageKey(userId));
    return value === "1";
  } catch {
    return false;
  }
}

export async function markHowToIntroSeen(userId: number): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), "1");
  } catch {
    // best-effort
  }
}
