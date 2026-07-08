import * as FileSystem from "expo-file-system";
import { getApiAuthHeaders } from "./apiClient";
import { normalizeLocalMediaUri } from "../src/utils/normalizeLocalMediaUri";
import {
  segmentFileUrl,
  segmentVideoAbsoluteUrl,
  type RunwaySegmentItem,
} from "./droneSceneService";

export { normalizeLocalMediaUri } from "../src/utils/normalizeLocalMediaUri";

export type ScenePreviewSource = {
  uri: string;
  headers?: Record<string, string>;
};

export type BuildScenePreviewSourceParams = {
  jobId: string;
  slot: number;
  segment?: Pick<RunwaySegmentItem, "url" | "exists"> | null;
  authHeader?: Record<string, string>;
  cacheBust?: number;
};

function appendCacheBust(url: string, cacheBust?: number): string {
  const raw = String(url || "").trim();
  if (!raw || cacheBust == null) return raw;
  const sep = raw.includes("?") ? "&" : "?";
  return `${raw}${sep}t=${cacheBust}`;
}

function resolveRemoteSegmentUrl(params: BuildScenePreviewSourceParams): string {
  const jobId = String(params.jobId || "").trim();
  const slot = Number(params.slot);
  const bust = params.cacheBust ?? Date.now();
  const segmentUrl = String(params.segment?.url || "").trim();
  if (segmentUrl) {
    return appendCacheBust(segmentVideoAbsoluteUrl(segmentUrl), bust);
  }
  if (jobId && slot > 0) {
    return segmentFileUrl(jobId, slot, bust);
  }
  return "";
}

function withAuthHeaders(
  uri: string,
  authHeader?: Record<string, string>,
): ScenePreviewSource {
  const trimmed = String(uri || "").trim();
  if (!trimmed) return { uri: "" };
  const local =
    trimmed.startsWith("file://") ||
    trimmed.startsWith("content://") ||
    trimmed.startsWith("/");
  if (local) {
    return { uri: normalizeLocalMediaUri(trimmed) };
  }
  if (authHeader?.Authorization) {
    return { uri: trimmed, headers: authHeader };
  }
  return { uri: trimmed };
}

/** Web handleSegmentPlay ile aynı: remote segment URL + auth. */
export function buildScenePreviewSource(params: BuildScenePreviewSourceParams): ScenePreviewSource {
  const remoteUri = resolveRemoteSegmentUrl(params);
  return withAuthHeaders(remoteUri, params.authHeader);
}

async function downloadSegmentToCache(
  jobId: string,
  slot: number,
  cacheBust: number,
): Promise<string | null> {
  const remoteUrl = segmentFileUrl(jobId, slot, cacheBust);
  const headers = await getApiAuthHeaders();
  if (!headers.Authorization) return null;

  const cachePath = `${FileSystem.cacheDirectory}drone-seg-play-${jobId}-${slot}-${cacheBust}.mp4`;

  try {
    const cached = await FileSystem.getInfoAsync(cachePath);
    if (cached.exists && typeof cached.size === "number" && cached.size > 1024) {
      return normalizeLocalMediaUri(cachePath);
    }
  } catch {
    /* cache miss */
  }

  try {
    const downloaded = await FileSystem.downloadAsync(remoteUrl, cachePath, { headers });
    if (downloaded.status >= 200 && downloaded.status < 300 && downloaded.uri) {
      return normalizeLocalMediaUri(downloaded.uri || cachePath);
    }
  } catch {
    return null;
  }

  return null;
}

/** Remote başarısız olursa yerel indirme fallback (normalize edilmiş URI). */
export async function resolveScenePreviewSourceAsync(
  params: BuildScenePreviewSourceParams,
): Promise<ScenePreviewSource> {
  const primary = buildScenePreviewSource(params);
  if (!primary.uri) return primary;

  const isRemote =
    !primary.uri.startsWith("file://") &&
    !primary.uri.startsWith("content://") &&
    !primary.uri.startsWith("/");

  if (!isRemote) return primary;

  const jobId = String(params.jobId || "").trim();
  const slot = Number(params.slot);
  const bust = params.cacheBust ?? Date.now();
  if (!jobId || slot < 1) return primary;

  const localUri = await downloadSegmentToCache(jobId, slot, bust);
  if (localUri) return { uri: localUri };
  return primary;
}

export function scenePreviewSourceToPlayerSource(
  source: ScenePreviewSource | null | undefined,
): { uri: string; headers?: Record<string, string> } | null {
  const uri = String(source?.uri || "").trim();
  if (!uri) return null;
  if (source?.headers) return { uri, headers: source.headers };
  return { uri };
}
