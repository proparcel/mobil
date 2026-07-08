import AsyncStorage from "@react-native-async-storage/async-storage";

export type HowToLiveSession = {
  videoId: string;
  title?: string;
  youtubeUrl?: string;
};

const SESSION_KEY = "proparcel_howto_live_session";

export async function getHowToLiveSession(): Promise<HowToLiveSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HowToLiveSession;
    const videoId = String(parsed?.videoId || "").trim();
    if (!videoId) return null;
    return {
      videoId,
      title: parsed.title?.trim() || undefined,
      youtubeUrl: parsed.youtubeUrl?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

export async function saveHowToLiveSession(session: HowToLiveSession): Promise<void> {
  const videoId = session.videoId.trim();
  if (!videoId) return;
  try {
    await AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        videoId,
        title: session.title?.trim() || "",
        youtubeUrl: session.youtubeUrl?.trim() || "",
      }),
    );
  } catch {
    /* best-effort */
  }
}

export async function clearHowToLiveSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    /* best-effort */
  }
}
