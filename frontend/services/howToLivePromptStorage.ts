import AsyncStorage from "@react-native-async-storage/async-storage";

const DISMISS_KEY = "proparcel_howto_live_dismissed_video_id";

export async function getDismissedLiveVideoId(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(DISMISS_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export async function setDismissedLiveVideoId(videoId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISS_KEY, videoId);
  } catch {
    // best-effort
  }
}
