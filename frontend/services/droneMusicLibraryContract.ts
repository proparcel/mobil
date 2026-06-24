export const PROPARCEL_MUSIC_PROVIDER = "proparcel";
export const UPLOAD_MUSIC_PROVIDER = "upload";

export type DroneMusicTrack = {
  id?: string;
  title?: string;
  name?: string;
  artist?: string;
  preview_url?: string;
  download_url?: string;
  duration?: number;
  provider?: string;
  provider_track_id?: string;
  track_id?: string;
  filename?: string;
  local_preview_uri?: string;
  [key: string]: unknown;
};

export const DEFAULT_DRONE_MUSIC_SELECT_SETTINGS = {
  volume: 45,
  fade_in: 2,
  fade_out: 3,
  auto_ducking: true,
  highlight_ducking: true,
  ending_boost: true,
  trim_start: 0,
  trim_end: "",
  cut_intervals: [] as Array<{ start: number; end: number }>,
};

export function normalizeLibraryTrack(raw: Record<string, unknown>): DroneMusicTrack {
  const providerTrackId = String(
    raw.provider_track_id || raw.id || raw.track_id || raw.filename || "",
  ).trim();
  const filename = String(raw.filename || "").trim();
  const title = String(raw.title || raw.name || filename || "Parça").trim();
  return {
    provider: PROPARCEL_MUSIC_PROVIDER,
    provider_track_id: providerTrackId,
    filename,
    title,
    name: title,
    artist: String(raw.artist || "ProParcel").trim(),
    duration: typeof raw.duration === "number" ? raw.duration : undefined,
    download_url: String(raw.download_url || "").trim(),
    preview_url: String(raw.preview_url || raw.download_url || "").trim(),
  };
}

export function buildMusicSelectSettings(volume?: number) {
  const vol = Number(volume);
  return {
    ...DEFAULT_DRONE_MUSIC_SELECT_SETTINGS,
    volume: Number.isFinite(vol)
      ? Math.max(0, Math.min(100, Math.round(vol)))
      : DEFAULT_DRONE_MUSIC_SELECT_SETTINGS.volume,
  };
}

export function buildSelectMusicTrackPayload(track: DroneMusicTrack): Record<string, string> {
  const provider = String(track.provider || PROPARCEL_MUSIC_PROVIDER).trim().toLowerCase();
  const providerTrackId = String(
    track.provider_track_id || track.id || track.track_id || "",
  ).trim();
  const filename = String(track.filename || "").trim();
  const title = String(track.title || track.name || "Parça").trim();
  const payload: Record<string, string> = {
    provider,
    provider_track_id: providerTrackId,
    title,
  };
  if (filename && provider === PROPARCEL_MUSIC_PROVIDER) {
    payload.filename = filename;
  }
  return payload;
}

export function normalizeApiMusicTrack(
  raw: Record<string, unknown>,
  jobId?: string,
  apiBaseUrl = "",
): DroneMusicTrack {
  const provider = String(raw.provider || PROPARCEL_MUSIC_PROVIDER).trim().toLowerCase();
  const providerTrackId = String(
    raw.provider_track_id || raw.id || raw.track_id || "",
  ).trim();
  const title = String(raw.title || raw.name || "Parça").trim();
  let previewUrl = String(raw.preview_url || raw.local_url || "").trim();
  if (provider === UPLOAD_MUSIC_PROVIDER && jobId) {
    previewUrl = `/api/drone-editor/music/file/?job_id=${encodeURIComponent(jobId)}`;
  }
  if (previewUrl) {
    previewUrl = absoluteMusicLibraryUrl(previewUrl, apiBaseUrl);
  }
  return {
    provider,
    provider_track_id: providerTrackId,
    id: providerTrackId,
    title,
    name: title,
    artist:
      provider === UPLOAD_MUSIC_PROVIDER
        ? "Yüklenen"
        : String(raw.artist || "ProParcel").trim(),
    preview_url: previewUrl,
    duration: typeof raw.duration === "number" ? raw.duration : undefined,
  };
}

export function absoluteMusicLibraryUrl(
  pathOrUrl: string,
  apiBaseUrl: string,
): string {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = String(apiBaseUrl || "").replace(/\/$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return base ? `${base}${path}` : path;
}

export function withAbsoluteMusicUrls(
  track: DroneMusicTrack,
  apiBaseUrl: string,
): DroneMusicTrack {
  return {
    ...track,
    download_url: absoluteMusicLibraryUrl(String(track.download_url || ""), apiBaseUrl),
    preview_url: absoluteMusicLibraryUrl(
      String(track.preview_url || track.download_url || ""),
      apiBaseUrl,
    ),
  };
}
