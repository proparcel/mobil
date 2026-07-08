/**
 * AI Video editör — landscape + editor_mode ai_video API katmanı.
 */

import { API_URL } from "../config/api";
import { authFormFetch, authJsonFetch } from "./apiClient";
import { fetchRunwayJobStatus, pollRunwayUntilDone } from "./droneRunwayService";
import { absoluteDroneApiUrl, type MobileUploadImage } from "./imageAnimationService";
import { appendOpenAiPreflightFormFields, openAiPreflightPrepJsonFields } from "./openAiPreflightApi";
import {
  appendRunwayLandscapeClientFormFields,
  RUNWAY_LANDSCAPE_ORIENTATION,
  runwayLandscapeClientJsonFields,
} from "./runwayLandscapeClient";
import { storageService } from "./storageService";
import {
  DEFAULT_DRONE_MUSIC_SELECT_SETTINGS,
  buildMusicSelectSettings,
  buildSelectMusicTrackPayload,
  normalizeApiMusicTrack,
  UPLOAD_MUSIC_PROVIDER,
} from "./droneMusicLibraryContract";
import { MOBILE_AI_VIDEO_NEW_CLIENT_SOURCE } from "../src/constants/aiDroneProductionPipeline";
import { DRONE_SCENE_INITIAL_COUNT } from "./droneSceneService";
import {
  defaultLandscapeSubtitleExportFontSize,
  normalizeLandscapeSubtitleExportFontSize,
} from "../src/utils/landscapeOverlayContract";

export { MOBILE_AI_VIDEO_NEW_CLIENT_SOURCE };

export type {
  MusicTrack,
  SubtitleSettings,
  RunwayPollStatus,
} from "./aiDroneSimpleEditorService";

export {
  clampDroneSimpleNarrationText,
  clearMusic,
  deleteDroneEditorAnnotation,
  droneMusicFileUrl,
  getHideProparcelBrand,
  getRecommendedMusic,
  hideProparcelBrandFromMeta,
  isRunwayCleanPreviewVideoUrl,
  musicFromJobMeta,
  musicTrackKey,
  musicVolumeFromJobMeta,
  refreshRunwayAudio,
  saveHideProparcelBrand,
  saveNarrationDraft,
  selectMusic,
  uploadDroneMusic,
  waitForRunwayVideoFile,
} from "./aiDroneSimpleEditorService";

export type AiVideoScript = {
  full_narration?: string;
  scene_prompts?: string[];
  scene_narrations?: string[];
  closing_caption?: string;
};

function errMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const maybe = error as { error?: unknown; message?: unknown; detail?: unknown };
    if (typeof maybe.message === "string") return maybe.message;
    if (typeof maybe.detail === "string") return maybe.detail;
    if (typeof maybe.error === "string") return maybe.error;
  }
  return fallback;
}

export function aiVideoReferenceId(jobId: string): string {
  return `ai_video_${String(jobId || "").trim()}`;
}

export function aiVideoRunwayVideoUrl(jobId: string, cacheBust?: number): string {
  const base = absoluteDroneApiUrl(
    `/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/?orientation=${RUNWAY_LANDSCAPE_ORIENTATION}`,
  );
  if (!cacheBust) return base;
  return `${base}&t=${cacheBust}`;
}

export function aiVideoRunwayRawPreviewVideoUrl(jobId: string, cacheBust?: number): string {
  const base = absoluteDroneApiUrl(
    `/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/?raw=1`,
  );
  if (!cacheBust) return base;
  return `${base}&t=${cacheBust}`;
}

export function aiVideoEditorPreviewVideoUrl(jobId: string, cacheBust?: number): string {
  const base = absoluteDroneApiUrl(
    `/api/drone-editor/video/file/?job_id=${encodeURIComponent(jobId)}`,
  );
  if (!cacheBust) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}t=${cacheBust}`;
}

export function aiVideoRunwayLegacyVideoUrl(jobId: string, cacheBust?: number): string {
  const base = absoluteDroneApiUrl(`/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/`);
  if (!cacheBust) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}t=${cacheBust}`;
}

async function probeVideoFileUrl(url: string, token: string): Promise<boolean> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Range: "bytes=0-1",
  };
  try {
    let res = await fetch(url, { method: "GET", headers });
    if (res.ok || res.status === 206) return true;
    res = await fetch(url, { method: "HEAD", headers: { Authorization: headers.Authorization } });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

export async function probeAiVideoRunwayFileReady(
  jobId: string,
  opts?: { cacheBust?: number; landscape?: boolean },
): Promise<boolean> {
  const trimmed = String(jobId || "").trim();
  if (!trimmed) return false;
  const token = await storageService.getAccessToken();
  if (!token) return false;
  const bust = opts?.cacheBust ?? Date.now();
  const landscape = opts?.landscape !== false;
  const url = landscape
    ? aiVideoRunwayVideoUrl(trimmed, bust)
    : aiVideoRunwayLegacyVideoUrl(trimmed, bust);
  return probeVideoFileUrl(url, token);
}

export async function resolveAiVideoRunwayPreviewVideoUrl(jobId: string): Promise<string> {
  const trimmed = String(jobId || "").trim();
  if (!trimmed) return "";
  const token = await storageService.getAccessToken();
  if (!token) return aiVideoRunwayRawPreviewVideoUrl(trimmed, Date.now());
  const bust = Date.now();
  const rawUrl = aiVideoRunwayRawPreviewVideoUrl(trimmed, bust);
  if (await probeVideoFileUrl(rawUrl, token)) return rawUrl;
  const editorUrl = aiVideoEditorPreviewVideoUrl(trimmed, bust);
  if (await probeVideoFileUrl(editorUrl, token)) return editorUrl;
  if (await probeAiVideoRunwayFileReady(trimmed, { cacheBust: bust, landscape: true })) {
    return aiVideoRunwayVideoUrl(trimmed, bust);
  }
  if (await probeAiVideoRunwayFileReady(trimmed, { cacheBust: bust, landscape: false })) {
    return aiVideoRunwayLegacyVideoUrl(trimmed, bust);
  }
  return rawUrl;
}

export async function generateAiVideoScript(payload: {
  title: string;
  imageCount: number;
  bodyText?: string;
  highlightTexts?: string[];
}): Promise<{ ok: true; script: AiVideoScript; text: string } | { ok: false; error: string }> {
  const keywords = (payload.highlightTexts || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 12);
  const res = await authJsonFetch<{ success?: boolean; script?: AiVideoScript }>(
    "/api/drone-editor/ai-video-script/",
    {
      method: "POST",
      json: {
        title: payload.title.slice(0, 120),
        image_count: Math.max(2, Math.min(32, payload.imageCount || DRONE_SCENE_INITIAL_COUNT)),
        body_text: (payload.bodyText || keywords.join(", ")).slice(0, 600),
        highlight_texts: keywords,
        language: "tr",
      },
    },
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Video metni üretilemedi.") };
  }
  const script = ((res.data as any)?.script || {}) as AiVideoScript;
  const text = String(script.full_narration || "").trim();
  return { ok: true, script, text };
}

export async function runwayPrepStartAiVideo(payload: {
  refFrameCount: number;
  aiVideoTitle: string;
  licenseRef?: string;
  promptText?: string;
  useOpenAiPreflight?: boolean;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const json: Record<string, unknown> = {
    ref_frame_count: Math.max(2, Math.min(8, payload.refFrameCount || DRONE_SCENE_INITIAL_COUNT)),
    editor_mode: "ai_video",
    prompt_profile: "ai_video",
    ai_video_title: payload.aiVideoTitle.slice(0, 120),
    prompt_text: (payload.promptText || "").slice(0, 2000),
    ...runwayLandscapeClientJsonFields(),
    ...openAiPreflightPrepJsonFields(Boolean(payload.useOpenAiPreflight)),
  };
  const licenseRef = String(payload.licenseRef || "").trim();
  if (licenseRef) json.license_ref = licenseRef.slice(0, 160);

  const res = await authJsonFetch<{ job_id?: string; success?: boolean }>("/api/drone-recording-runway/prep/", {
    method: "POST",
    json,
  });
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Hazırlık başlatılamadı.") };
  const jobId = String((res.data as any)?.job_id || "").trim();
  if (!jobId || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage((res.data as any)?.error, "Job oluşturulamadı.") };
  }
  return { ok: true, jobId };
}

export async function runwayPrepPushRef(
  jobId: string,
  slot: number,
  image: MobileUploadImage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("image", {
    uri: image.uri,
    name: image.name || `reference_${String(slot).padStart(2, "0")}.jpg`,
    type: image.type || "image/jpeg",
  } as any);
  const res = await authFormFetch<{ success?: boolean }>(
    `/api/drone-recording-runway/prep/${encodeURIComponent(jobId)}/ref/${slot}/`,
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Görsel yüklenemedi.") };
  }
  return { ok: true };
}

export async function startAiVideoRunwayProduction(payload: {
  preparedJobId: string;
  refFrameCount: number;
  narrationText: string;
  aiVideoTitle: string;
  licenseRef?: string;
  scenePrompts?: string[];
  scriptPreview?: AiVideoScript | null;
  fullSubtitleOnly?: boolean;
  useOpenAiPreflight?: boolean;
}): Promise<
  | { ok: true; jobId: string; pollMs: number }
  | { ok: false; error: string; licenseRequired?: boolean }
> {
  const form = new FormData();
  form.append("prepared_job_id", payload.preparedJobId);
  form.append("ref_frame_count", String(payload.refFrameCount));
  form.append("editor_mode", "ai_video");
  form.append("prompt_profile", "ai_video");
  form.append("ai_video_title", payload.aiVideoTitle.slice(0, 120));
  appendRunwayLandscapeClientFormFields(form);
  if (payload.narrationText.trim()) {
    form.append("narration_text", payload.narrationText.trim().slice(0, 8000));
  }
  const licenseRef = String(payload.licenseRef || "").trim();
  if (licenseRef) form.append("license_ref", licenseRef.slice(0, 160));
  if (payload.fullSubtitleOnly) form.append("runway_full_subtitle", "1");
  if (payload.scenePrompts?.length) {
    form.append("scene_prompts", JSON.stringify(payload.scenePrompts.slice(0, payload.refFrameCount)));
  }
  if (payload.scriptPreview && typeof payload.scriptPreview === "object") {
    form.append("script_preview", JSON.stringify(payload.scriptPreview));
  }
  appendOpenAiPreflightFormFields(form, Boolean(payload.useOpenAiPreflight));

  const res = await authFormFetch<{
    async?: boolean;
    job_id?: string;
    poll_ms?: number;
    success?: boolean;
    error?: string;
  }>("/api/drone-recording-runway/", form);

  if (!res.ok || (res.data as any)?.success === false) {
    const apiError = String((res.data as any)?.error || res.error || "").trim();
    const licenseRequired = res.status === 403 && apiError === "lisans_yok";
    return {
      ok: false,
      error: errMessage(res.error || (res.data as any)?.error, "Video üretimi başlatılamadı."),
      licenseRequired,
    };
  }
  const jobId = String((res.data as any)?.job_id || payload.preparedJobId).trim();
  if (!jobId) return { ok: false, error: "İş kimliği alınamadı." };
  return {
    ok: true,
    jobId,
    pollMs: Number((res.data as any)?.poll_ms || 1500),
  };
}

export async function getRunwayJobStatus(jobId: string) {
  return fetchRunwayJobStatus(jobId);
}

export { pollRunwayUntilDone };

export async function getSubtitleSettings(
  jobId: string,
): Promise<{ ok: true; settings: import("./aiDroneSimpleEditorService").SubtitleSettings } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ subtitle_settings?: import("./aiDroneSimpleEditorService").SubtitleSettings }>(
    `/api/drone-editor/subtitle-settings/?job_id=${encodeURIComponent(jobId)}&orientation=${RUNWAY_LANDSCAPE_ORIENTATION}`,
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Altyazı ayarı alınamadı.") };
  const settings = (res.data as any)?.subtitle_settings || (res.data as any);
  return { ok: true, settings: settings as import("./aiDroneSimpleEditorService").SubtitleSettings };
}

export async function saveSubtitleSettings(
  jobId: string,
  subtitleSettings: import("./aiDroneSimpleEditorService").SubtitleSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = {
    ...subtitleSettings,
    fontSize: normalizeLandscapeSubtitleExportFontSize(subtitleSettings.fontSize),
  };
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-editor/subtitle-settings/", {
    method: "POST",
    json: {
      job_id: jobId,
      orientation: RUNWAY_LANDSCAPE_ORIENTATION,
      subtitle_settings: normalized,
    },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Altyazı kaydedilemedi.") };
  }
  return { ok: true };
}

export function defaultAiVideoSubtitleSettings(): import("./aiDroneSimpleEditorService").SubtitleSettings {
  return {
    enabled: true,
    mode: "plain",
    x: 0.5,
    y: 0.82,
    textColor: "#ffffff",
    shadowEnabled: true,
    shadowColor: "#020617",
    shadowStrength: 0.85,
    fontSize: defaultLandscapeSubtitleExportFontSize(),
    maxWords: 5,
    textAlign: "center",
    visibilityRanges: [],
  };
}

function landscapeExportStartError(error: unknown, code?: string): string {
  const token = String(code || error || "").trim();
  if (token === "remote_worker_required") {
    return "Video dışa aktarma sunucusu yapılandırılmamış. Lütfen daha sonra tekrar deneyin.";
  }
  if (token === "remote_worker_enqueue_failed") {
    return "Video dışa aktarma kuyruğa alınamadı. Sunucu yeniden başlatıldıktan sonra tekrar deneyin.";
  }
  return errMessage(error, "Dışa aktarma başlatılamadı.");
}

export async function startLandscapeExport(
  jobId: string,
): Promise<{ ok: true; status: string; exportId: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{
    status?: string;
    success?: boolean;
    export_id?: string;
    active_export_id?: string;
  }>("/api/drone-editor/export/", {
    method: "POST",
    json: { job_id: jobId, orientation: RUNWAY_LANDSCAPE_ORIENTATION },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: landscapeExportStartError(res.error, res.code) };
  }
  const data = res.data as { status?: string; export_id?: string; active_export_id?: string };
  const exportId = String(data?.export_id || data?.active_export_id || "").trim();
  return {
    ok: true,
    status: String(data?.status || "queued"),
    exportId,
  };
}

export type LandscapeExportStatusSnapshot = {
  status: string;
  exportId: string;
  outputFile: string;
  finishedAt: string;
  /** HTTP/network poll failure — retry, do not show fail modal */
  transient?: boolean;
};

export async function fetchLandscapeExportStatus(jobId: string): Promise<LandscapeExportStatusSnapshot> {
  const res = await authJsonFetch<{
    status?: string;
    effective_status?: string;
    active_export_id?: string;
    export?: {
      export_id?: string;
      output_file?: string;
      finished_at?: string;
      effective_status?: string;
      status?: string;
    };
    latest_output_files?: Record<string, string>;
  }>(
    `/api/drone-editor/export/status/?job_id=${encodeURIComponent(jobId)}&orientation=${RUNWAY_LANDSCAPE_ORIENTATION}`,
    { method: "GET" },
  );
  if (!res.ok) {
    return { status: "pending", exportId: "", outputFile: "", finishedAt: "", transient: true };
  }
  const data = res.data || {};
  const exp = (data.export || {}) as Record<string, unknown>;
  const latest = (data.latest_output_files || {}) as Record<string, string>;
  return {
    status: String(
      exp.effective_status || exp.status || data.effective_status || data.status || "idle",
    ),
    exportId: String(exp.export_id || data.active_export_id || "").trim(),
    outputFile: String(exp.output_file || latest.landscape || "").trim(),
    finishedAt: String(exp.finished_at || "").trim(),
    transient: false,
  };
}

export function classifyLandscapeExportStatus(status: string): { isReady: boolean; isFailed: boolean } {
  const s = String(status || "").trim().toLowerCase();
  const isReady = s === "success" || s === "ready" || s === "done";
  const isFailed = s === "failed" || s === "cancelled" || s === "enqueue_failed";
  return { isReady, isFailed };
}

export async function getLandscapeExportStatus(jobId: string): Promise<string> {
  const snap = await fetchLandscapeExportStatus(jobId);
  return snap.status;
}

export function landscapeExportDownloadUrl(jobId: string, outputFile?: string): string {
  const file = String(outputFile || "").trim();
  const fileQuery = file ? `&output_file=${encodeURIComponent(file)}` : "";
  return absoluteDroneApiUrl(
    `/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/?orientation=${RUNWAY_LANDSCAPE_ORIENTATION}&download=1${fileQuery}`,
  );
}

export async function listDroneEditorAnnotations(jobId: string) {
  const res = await authJsonFetch<import("./aiDroneSimpleEditorService").DroneEditorAnnotationsList>(
    `/api/drone-editor/annotations/list/?job_id=${encodeURIComponent(jobId)}&orientation=${RUNWAY_LANDSCAPE_ORIENTATION}`,
    { method: "GET" },
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false as const, error: errMessage(res.error, "Anotasyonlar alınamadı.") };
  }
  const raw = (res.data || {}) as import("./aiDroneSimpleEditorService").DroneEditorAnnotationsList;
  return {
    ok: true as const,
    data: {
      annotations: Array.isArray(raw.annotations) ? raw.annotations : [],
      narration_text: raw.narration_text,
      narration_last_saved_text: raw.narration_last_saved_text,
      narration_draft_text: raw.narration_draft_text,
      narration_editor_text: raw.narration_editor_text,
      runway_full_subtitle: raw.runway_full_subtitle,
    },
  };
}

export async function setActiveAiVideoJob(payload: {
  jobId: string;
  referenceId: string;
  startedAt: number;
  refFrameCount: number;
  source?: string;
}): Promise<void> {
  const { setActiveDroneJob } = await import("./droneRunwayActiveJobStorage");
  await setActiveDroneJob({
    ...payload,
    source: payload.source || MOBILE_AI_VIDEO_NEW_CLIENT_SOURCE,
  });
}

export {
  applyAggregateFrameLabelToSlots,
  finalizeAllRunwaySlots,
  formatRunwaySlotProgressSummary,
  initialRunwaySlotProgressMap,
  initialRunwaySlotProgressForSlot,
  mergeRunwaySlotProgressEntry,
  mergeRunwaySlotProgressFromPoll,
  normalizeRunwayProgressPercent,
  parseRunwayFrameCounts,
  shouldFinalizeRunwaySlotsFromPoll,
  toPipelineSlotProgressItems,
  toPipelineSlotProgressItemsForSlots,
} from "./runwaySlotProgress";

export type { RunwaySlotProgressMap } from "./runwaySlotProgress";
