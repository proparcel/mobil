/**
 * ProjeOlustur — YouTube tutorial videoları.
 */

import { DJANGO_API_URL } from "../config/api";

export type HowToVideoCategory = {
  id: number;
  name: string;
  sort_order: number;
};

export type HowToVideoItem = {
  id: number;
  title: string;
  youtube_url: string;
  youtube_video_id: string;
  thumbnail_url: string;
  description: string;
  sort_order: number;
  category: HowToVideoCategory | null;
};

export type HowToLiveStatus = {
  is_live: boolean;
  title: string;
  youtube_video_id: string;
  youtube_url: string;
  thumbnail_url: string;
  started_at: string | null;
  viewer_count?: number;
};

const ENDPOINT = "/api/how-to-videos/";
const LIVE_STATUS_ENDPOINT = "/api/how-to-live/status/";
const LIVE_PING_ENDPOINT = "/api/how-to-live/ping/";
const LIVE_VIEW_CLIENT_KEY = "proparcel_live_view_client_key";

async function publicFetch<T>(endpoint: string): Promise<T | null> {
  const url = `${DJANGO_API_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        "ngrok-skip-browser-warning": "true",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch (error) {
    console.error(`[howToVideoService] API hatası (${endpoint}):`, error);
    return null;
  }
}

class HowToVideoService {
  async listVideos(): Promise<HowToVideoItem[]> {
    const data = await publicFetch<{ videos?: HowToVideoItem[] }>(ENDPOINT);
    return Array.isArray(data?.videos) ? data.videos : [];
  }

  async getLiveStatus(): Promise<HowToLiveStatus | null> {
    return publicFetch<HowToLiveStatus>(LIVE_STATUS_ENDPOINT);
  }

  async getLiveViewClientKey(): Promise<string> {
    try {
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      let key = await AsyncStorage.getItem(LIVE_VIEW_CLIENT_KEY);
      if (!key) {
        key = `lv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(LIVE_VIEW_CLIENT_KEY, key);
      }
      return key;
    } catch {
      return `lv_${Date.now().toString(36)}`;
    }
  }

  async pingLiveView(videoId: string): Promise<number | null> {
    const clientKey = await this.getLiveViewClientKey();
    const url = `${DJANGO_API_URL}${LIVE_PING_ENDPOINT}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ client_key: clientKey, video_id: videoId }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { viewer_count?: number; skipped?: boolean };
      if (data.skipped || typeof data.viewer_count !== "number") return null;
      return data.viewer_count;
    } catch {
      return null;
    }
  }
}

export const howToVideoService = new HowToVideoService();
