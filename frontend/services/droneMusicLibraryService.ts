import RNFS from "react-native-fs";

import { API_URL } from "../config/api";
import { getApiAuthHeaders } from "./apiClient";
import {
  buildSelectMusicTrackPayload,
  DEFAULT_DRONE_MUSIC_SELECT_SETTINGS,
  normalizeApiMusicTrack,
  normalizeLibraryTrack,
  PROPARCEL_MUSIC_PROVIDER,
  UPLOAD_MUSIC_PROVIDER,
  withAbsoluteMusicUrls,
  type DroneMusicTrack,
} from "./droneMusicLibraryContract";

export {
  buildMusicSelectSettings,
  buildSelectMusicTrackPayload,
  DEFAULT_DRONE_MUSIC_SELECT_SETTINGS,
  normalizeApiMusicTrack,
  normalizeLibraryTrack,
  PROPARCEL_MUSIC_PROVIDER,
  UPLOAD_MUSIC_PROVIDER,
  type DroneMusicTrack,
} from "./droneMusicLibraryContract";

const LIBRARY_CACHE_DIR = `${RNFS.DocumentDirectoryPath}/proparcel_drone_music_library`;

function safeTrackId(track: DroneMusicTrack): string {
  const raw = String(
    track.provider_track_id || track.id || track.filename || track.title || "track",
  ).trim();
  return raw.replace(/[^a-zA-Z0-9_.-]+/g, "_").slice(0, 120) || "track";
}

function cachePathForTrack(track: DroneMusicTrack, ext = ".mp3"): string {
  return `${LIBRARY_CACHE_DIR}/${safeTrackId(track)}${ext}`;
}

function fileUri(path: string): string {
  const p = String(path || "").trim();
  if (!p) return "";
  return p.startsWith("file://") ? p : `file://${p}`;
}

export async function ensureLibraryCacheDir(): Promise<void> {
  const exists = await RNFS.exists(LIBRARY_CACHE_DIR);
  if (!exists) {
    await RNFS.mkdir(LIBRARY_CACHE_DIR);
  }
}

export async function getCachedLibraryTrackUri(track: DroneMusicTrack): Promise<string | null> {
  for (const ext of [".mp3", ".m4a", ".wav", ".ogg"]) {
    const path = cachePathForTrack(track, ext);
    const exists = await RNFS.exists(path);
    if (!exists) continue;
    const stat = await RNFS.stat(path);
    if (stat?.size > 0) return fileUri(path);
  }
  return null;
}

export function libraryFileDownloadUrl(track: DroneMusicTrack): string {
  const id = String(track.provider_track_id || track.id || "").trim();
  const filename = String(track.filename || "").trim();
  if (id) {
    return `${API_URL}/api/drone-editor/music/library/file/?id=${encodeURIComponent(id)}`;
  }
  if (filename) {
    return `${API_URL}/api/drone-editor/music/library/file/?filename=${encodeURIComponent(filename)}`;
  }
  const rel = String(track.download_url || "").trim();
  if (rel) {
    if (rel.startsWith("http://") || rel.startsWith("https://")) return rel;
    return `${API_URL}${rel.startsWith("/") ? rel : `/${rel}`}`;
  }
  return "";
}

async function downloadUrlToTrackCache(
  track: DroneMusicTrack,
  url: string,
): Promise<{ ok: true; uri: string } | { ok: false; error: string }> {
  const cached = await getCachedLibraryTrackUri(track);
  if (cached) return { ok: true, uri: cached };

  if (!url) {
    return { ok: false, error: "İndirme adresi bulunamadı." };
  }

  await ensureLibraryCacheDir();
  const tmpPath = `${LIBRARY_CACHE_DIR}/tmp_${Date.now()}_${safeTrackId(track)}`;
  const headers = await getApiAuthHeaders();

  try {
    const dl = await RNFS.downloadFile({ fromUrl: url, toFile: tmpPath, headers }).promise;
    const statusCode = dl?.statusCode;
    if (statusCode && statusCode >= 400) {
      await RNFS.unlink(tmpPath).catch(() => {});
      return { ok: false, error: `İndirme başarısız (HTTP ${statusCode})` };
    }
    const exists = await RNFS.exists(tmpPath);
    if (!exists) {
      return { ok: false, error: "Müzik dosyası indirilemedi." };
    }
    const stat = await RNFS.stat(tmpPath);
    if (!stat?.size) {
      await RNFS.unlink(tmpPath).catch(() => {});
      return { ok: false, error: "İndirilen dosya boş." };
    }

    let ext = ".mp3";
    const urlPath = url.split("?")[0].toLowerCase();
    if (urlPath.endsWith(".wav")) ext = ".wav";
    else if (urlPath.endsWith(".m4a")) ext = ".m4a";
    else if (urlPath.endsWith(".ogg")) ext = ".ogg";

    const finalPath = cachePathForTrack(track, ext);
    const finalExists = await RNFS.exists(finalPath);
    if (finalExists) await RNFS.unlink(finalPath).catch(() => {});
    await RNFS.moveFile(tmpPath, finalPath);
    return { ok: true, uri: fileUri(finalPath) };
  } catch (e: unknown) {
    await RNFS.unlink(tmpPath).catch(() => {});
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Müzik indirilemedi." };
  }
}

export async function downloadLibraryTrackToCache(
  track: DroneMusicTrack,
): Promise<{ ok: true; uri: string } | { ok: false; error: string }> {
  return downloadUrlToTrackCache(track, libraryFileDownloadUrl(track));
}

export async function resolveMusicPreviewUri(
  track: DroneMusicTrack,
): Promise<{ ok: true; uri: string } | { ok: false; error: string }> {
  const provider = String(track.provider || PROPARCEL_MUSIC_PROVIDER).trim().toLowerCase();
  if (provider === PROPARCEL_MUSIC_PROVIDER) {
    return downloadLibraryTrackToCache(track);
  }
  const direct = String(track.local_preview_uri || track.preview_url || track.download_url || "").trim();
  if (direct.startsWith("file://")) {
    return { ok: true, uri: direct };
  }
  let remoteUrl = direct;
  if (remoteUrl && !remoteUrl.startsWith("http://") && !remoteUrl.startsWith("https://")) {
    remoteUrl = `${API_URL}${remoteUrl.startsWith("/") ? remoteUrl : `/${remoteUrl}`}`;
  }
  if (provider === UPLOAD_MUSIC_PROVIDER && remoteUrl) {
    return downloadUrlToTrackCache(track, remoteUrl);
  }
  if (remoteUrl) {
    if (remoteUrl.includes("/api/drone-editor/")) {
      return downloadUrlToTrackCache(track, remoteUrl);
    }
    return { ok: true, uri: remoteUrl };
  }
  return { ok: false, error: "Önizleme adresi bulunamadı." };
}

export async function getDroneMusicLibrary(): Promise<
  { ok: true; tracks: DroneMusicTrack[]; count: number } | { ok: false; error: string }
> {
  const url = `${API_URL}/api/drone-editor/music/library/`;
  const headers = await getApiAuthHeaders();
  try {
    let res = await fetch(url, { method: "GET", headers });
    if (res.status === 401) {
      const { authService } = await import("./authService");
      const refreshed = await authService.refreshToken();
      if (refreshed) {
        const retryHeaders = await getApiAuthHeaders();
        res = await fetch(url, { method: "GET", headers: retryHeaders });
      }
    }
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    if (!res.ok || parsed.success === false) {
      const err =
        String(parsed.error || parsed.detail || parsed.message || "").trim() ||
        `HTTP ${res.status}`;
      return { ok: false, error: err };
    }
    const rawTracks = Array.isArray(parsed.tracks) ? parsed.tracks : [];
    const tracks = rawTracks
      .filter((item) => item && typeof item === "object")
      .map((item) =>
        withAbsoluteMusicUrls(
          normalizeLibraryTrack(item as Record<string, unknown>),
          API_URL,
        ),
      );
    const count = Number(parsed.count);
    return {
      ok: true,
      tracks,
      count: Number.isFinite(count) ? count : tracks.length,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Müzik kütüphanesi alınamadı." };
  }
}
