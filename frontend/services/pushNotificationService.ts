/**
 * Expo push bildirim kaydı ve yönlendirme.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import { DJANGO_API_URL } from "../config/api";
import { getApiAuthHeaders } from "./apiClient";

export type PushNotificationData = {
  type?: string;
  video_id?: string;
  deep_link?: string;
  dfa_snapshot_id?: string | number;
  snapshotId?: string | number;
  job_id?: string;
  commentId?: string | number;
  ratingId?: string | number;
};

function optionalString(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

function optionalId(raw: unknown): string | number | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return n;
  return s;
}

export function shouldOpenHowToLiveTab(data: PushNotificationData | null | undefined): boolean {
  if (!data) return false;
  const type = String(data.type || "").toLowerCase();
  const deepLink = String(data.deep_link || "");
  if (type === "youtube_live") return true;
  if (deepLink.includes("proje-olustur") && deepLink.includes("tab=live")) return true;
  if (deepLink.includes("nasil-yapilir") && deepLink.includes("tab=live")) return true;
  return false;
}

export function getNotificationDataFromContent(content: unknown): PushNotificationData {
  const raw = (content as { data?: Record<string, unknown> })?.data || {};
  return {
    type: optionalString(raw.type),
    video_id: optionalString(raw.video_id),
    deep_link: optionalString(raw.deep_link ?? raw.deepLink),
    dfa_snapshot_id: optionalId(raw.dfa_snapshot_id),
    snapshotId: optionalId(raw.snapshotId ?? raw.snapshot_id),
    job_id: optionalString(raw.job_id),
    commentId: optionalId(raw.commentId ?? raw.comment_id),
    ratingId: optionalId(raw.ratingId ?? raw.rating_id),
  };
}

let Notifications: typeof import("expo-notifications") | null = null;

function loadNotificationsModule() {
  if (Notifications) return Notifications;
  try {
    Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("default", {
        name: "ProParcel",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
    return Notifications;
  } catch (e) {
    if (__DEV__) console.warn("[pushNotificationService] expo-notifications yüklenemedi", e);
    return null;
  }
}

async function getProjectId(): Promise<string | undefined> {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const fromEas = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return fromExtra || fromEas;
}

export async function registerPushToken(): Promise<string | null> {
  const mod = loadNotificationsModule();
  if (!mod) {
    console.warn("[pushNotificationService] expo-notifications modülü yok — yeni native build gerekir");
    return null;
  }

  try {
    const { status: existing } = await mod.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await mod.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("[pushNotificationService] bildirim izni verilmedi:", finalStatus);
      return null;
    }

    const projectId = await getProjectId();
    if (!projectId) {
      console.warn("[pushNotificationService] EAS projectId bulunamadı (app.config.js extra.eas.projectId)");
    }

    const tokenResult = await mod.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult?.data?.trim();
    if (!token) {
      console.warn("[pushNotificationService] Expo push token alınamadı");
      return null;
    }

    const platform =
      Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown";

    const headers = await getApiAuthHeaders({
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      "X-Requested-With": "XMLHttpRequest",
    });

    const response = await fetch(`${DJANGO_API_URL}/api/push/register/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        expo_push_token: token,
        platform,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(
        "[pushNotificationService] sunucu kaydı başarısız:",
        response.status,
        body.slice(0, 200),
      );
      return null;
    }

    if (__DEV__) console.log("[pushNotificationService] token kaydedildi:", token);
    else console.log("[pushNotificationService] token kaydedildi:", token.slice(0, 28) + "…");
    return token;
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (msg.includes("FirebaseApp") || msg.includes("fcm-credentials")) {
      console.warn(
        "[pushNotificationService] Firebase/FCM yapılandırması eksik. frontend/google-services.json indirip android/app/ altına kopyalayın, sonra run-android.",
      );
    }
    console.warn("[pushNotificationService] register failed", e);
    return null;
  }
}

export function addNotificationResponseListener(
  handler: (data: PushNotificationData) => void,
): () => void {
  const mod = loadNotificationsModule();
  if (!mod) return () => {};

  const sub = mod.addNotificationResponseReceivedListener((response) => {
    const content = response?.notification?.request?.content;
    const data = getNotificationDataFromContent(content);
    handler(data);
  });
  return () => sub.remove();
}

export function getNotificationDataFromResponse(response: unknown): PushNotificationData {
  const mod = loadNotificationsModule();
  if (!mod || !response) return {};
  try {
    const content = (response as { notification?: { request?: { content?: unknown } } })
      ?.notification?.request?.content;
    return getNotificationDataFromContent(content);
  } catch {
    return {};
  }
}

export async function getInitialNotificationData(): Promise<PushNotificationData | null> {
  const mod = loadNotificationsModule();
  if (!mod) return null;
  try {
    const response = await mod.getLastNotificationResponseAsync();
    if (!response) return null;
    return getNotificationDataFromResponse(response);
  } catch {
    return null;
  }
}
