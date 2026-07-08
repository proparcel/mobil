import { API_URL } from "../config/api";
import { authFormFetch, authJsonFetch } from "./apiClient";
import type { RunwayStatusResponse } from "./droneRunwayStatusParser";
import { fetchRunwayJobStatus, pollRunwayUntilDone } from "./droneRunwayService";
import { absoluteDroneApiUrl } from "./imageAnimationService";
import type { MobileUploadImage } from "./imageAnimationService";
import { appendOpenAiPreflightFormFields, openAiPreflightPrepJsonFields } from "./openAiPreflightApi";
import { DRONE_SCENE_INITIAL_COUNT } from "./droneSceneService";
import {
  appendRunwayPortraitClientFormFields,
  runwayPortraitClientJsonFields,
} from "./runwayPortraitClient";
import { storageService } from "./storageService";
import {
  buildMusicSelectSettings,
  buildSelectMusicTrackPayload,
  DEFAULT_DRONE_MUSIC_SELECT_SETTINGS,
  normalizeApiMusicTrack,
  UPLOAD_MUSIC_PROVIDER,
} from "./droneMusicLibraryContract";
import {
  DEFAULT_PORTRAIT_USER_CARD_POS,
  DRONE_SIMPLE_NARRATION_TEXT_MAX,
} from "../src/constants/aiDroneEditorTheme";
import {
  DEFAULT_USER_CARD_SCALE,
  userCardExportPointToUiCenter,
  userCardUiCenterToExportPoint,
} from "../src/utils/portraitOverlayContract";
export type {
  MergedRunwaySlotProgress,
  RunwayPollStatus,
  RunwaySlotProgressEntry,
  RunwaySlotProgressMap,
} from "./runwaySlotProgress";
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

export type DroneParcelQuery = {
  mahalleTkgmValue: number;
  mahalle: string;
  ada: string;
  parsel: string;
  city?: string;
  town?: string;
  cityId?: number;
  townId?: number;
  proparcelValue?: number;
};

/** `/api/drone-video-context/` + TKGM yedekleri — anlatım API girdisi */
export type DroneNarrationInputs = {
  city: string;
  district: string;
  quarter: string;
  parcelAreaM2: string;
  population: number | null;
  cityCenterKm: number | null;
  townCenterKm: number | null;
  priceInput?: string;
};

export function narrationInputsNeedGeographyRefresh(inputs: DroneNarrationInputs | null | undefined): boolean {
  if (!inputs) return true;
  return inputs.population == null || inputs.cityCenterKm == null || inputs.townCenterKm == null;
}

export async function enrichDroneNarrationInputs(
  parcel: DroneParcelQuery | null,
  tkgmData: { properties?: Record<string, unknown> } | null,
  parcelAreaM2: string,
  partial: DroneNarrationInputs | null,
): Promise<DroneNarrationInputs> {
  const area = String(parcelAreaM2 || partial?.parcelAreaM2 || "").trim();
  const base: DroneNarrationInputs = partial
    ? { ...partial, parcelAreaM2: partial.parcelAreaM2 || area }
    : {
        city: "",
        district: "",
        quarter: "",
        parcelAreaM2: area,
        population: null,
        cityCenterKm: null,
        townCenterKm: null,
      };

  if (!parcel) return base;

  if (!narrationInputsNeedGeographyRefresh(base)) {
    return base;
  }

  const fresh = await resolveDroneNarrationInputs(parcel, tkgmData, area);
  return {
    city: base.city || fresh.city,
    district: base.district || fresh.district,
    quarter: base.quarter || fresh.quarter,
    parcelAreaM2: base.parcelAreaM2 || fresh.parcelAreaM2,
    population: fresh.population ?? base.population,
    cityCenterKm: fresh.cityCenterKm ?? base.cityCenterKm,
    townCenterKm: fresh.townCenterKm ?? base.townCenterKm,
    priceInput: base.priceInput,
  };
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickTkgmString(props: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = props[key];
    if (v !== null && v !== undefined && String(v).trim()) return String(v).trim();
  }
  return "";
}

export type SubtitleSettings = {
  enabled: boolean;
  mode: string;
  x: number;
  y: number;
  textColor: string;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowStrength: number;
  fontSize: number;
  maxWords: number;
  textAlign: string;
  visibilityRanges: unknown[];
};

export type MusicTrack = {
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
  /** Yerel önizleme cache (cihaz). */
  local_preview_uri?: string;
  [key: string]: unknown;
};

export type UserCardInfo = {
  companyName: string;
  fullName: string;
  avatarUrl: string;
};

export type DroneEditorAnnotation = {
  id: number | string;
  annotation_type?: string;
  config_json?: {
    userInfoCard?: boolean;
    userInfo?: Partial<UserCardInfo> & Record<string, unknown>;
    point?: { x: number; y: number };
    userCardScale?: number;
  };
};

export type DroneEditorAnnotationsList = {
  annotations: DroneEditorAnnotation[];
  narration_text?: string;
  narration_last_saved_text?: string;
  narration_draft_text?: string;
  narration_editor_text?: string;
  runway_full_subtitle?: string;
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

export function droneRunwayVideoUrl(jobId: string, cacheBust?: number): string {
  const base = absoluteDroneApiUrl(
    `/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/?orientation=portrait`,
  );
  if (!cacheBust) return base;
  return `${base}&t=${cacheBust}`;
}

/** Ham önizleme — gömülü ProParcel/alt yazı olmadan (`output_clean_base.mp4`). */
export function droneRunwayRawPreviewVideoUrl(jobId: string, cacheBust?: number): string {
  const base = absoluteDroneApiUrl(
    `/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/?raw=1`,
  );
  if (!cacheBust) return base;
  return `${base}&t=${cacheBust}`;
}

/** Web editör ham video endpoint'i. */
export function droneEditorPreviewVideoUrl(jobId: string, cacheBust?: number): string {
  const base = absoluteDroneApiUrl(
    `/api/drone-editor/video/file/?job_id=${encodeURIComponent(jobId)}`,
  );
  if (!cacheBust) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}t=${cacheBust}`;
}

export function isRunwayCleanPreviewVideoUrl(url: string): boolean {
  const u = String(url || "");
  if (!u) return false;
  if (u.includes("raw=1") || u.includes("editor=1")) return true;
  return u.includes("/api/drone-editor/video/file");
}

/** Eski işler — portrait export yoksa `output.mp4` için orientation parametresi olmadan. */
export function droneRunwayLegacyVideoUrl(jobId: string, cacheBust?: number): string {
  const base = absoluteDroneApiUrl(`/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/`);
  if (!cacheBust) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}t=${cacheBust}`;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/** Portrait export dosyası sunucuda erişilebilir mi (Range isteği). */
export async function probeRunwayVideoFileReady(
  jobId: string,
  opts?: { cacheBust?: number; portrait?: boolean },
): Promise<boolean> {
  const trimmed = String(jobId || "").trim();
  if (!trimmed) return false;
  const token = await storageService.getAccessToken();
  if (!token) return false;
  const bust = opts?.cacheBust ?? Date.now();
  const portrait = opts?.portrait !== false;
  const url = portrait
    ? droneRunwayVideoUrl(trimmed, bust)
    : droneRunwayLegacyVideoUrl(trimmed, bust);
  return probeVideoFileUrl(url, token);
}

/** Portrait veya legacy endpoint'ten erişilebilir önizleme URL'si (dışa aktarım — gömülü katmanlar). */
export async function probeRunwayExportVideoReady(
  jobId: string,
  opts?: { cacheBust?: number; portrait?: boolean },
): Promise<boolean> {
  return probeRunwayVideoFileReady(jobId, opts);
}

/** Önizleme: önce ham video, yoksa dışa aktarım dosyası. */
export async function resolveDroneRunwayPreviewVideoUrl(jobId: string): Promise<string> {
  const trimmed = String(jobId || "").trim();
  if (!trimmed) return "";
  const token = await storageService.getAccessToken();
  if (!token) return droneRunwayRawPreviewVideoUrl(trimmed, Date.now());
  const bust = Date.now();
  const rawUrl = droneRunwayRawPreviewVideoUrl(trimmed, bust);
  if (await probeVideoFileUrl(rawUrl, token)) return rawUrl;
  const editorUrl = droneEditorPreviewVideoUrl(trimmed, bust);
  if (await probeVideoFileUrl(editorUrl, token)) return editorUrl;
  if (await probeRunwayVideoFileReady(trimmed, { cacheBust: bust, portrait: true })) {
    return droneRunwayVideoUrl(trimmed, bust);
  }
  if (await probeRunwayVideoFileReady(trimmed, { cacheBust: bust, portrait: false })) {
    return droneRunwayLegacyVideoUrl(trimmed, bust);
  }
  return rawUrl;
}

/** Poll tamamlandıktan sonra dosyanın gerçekten hazır olmasını bekler. */
export async function waitForRunwayVideoFile(
  jobId: string,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<boolean> {
  const trimmed = String(jobId || "").trim();
  if (!trimmed) return false;
  const timeoutMs = opts?.timeoutMs ?? 120000;
  const intervalMs = opts?.intervalMs ?? 2500;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probeRunwayVideoFileReady(trimmed, { portrait: false })) return true;
    const token = await storageService.getAccessToken();
    if (token) {
      const bust = Date.now();
      if (await probeVideoFileUrl(droneRunwayRawPreviewVideoUrl(trimmed, bust), token)) return true;
    }
    await sleepMs(intervalMs);
  }
  return false;
}

export async function runwayPrepStartSimple(payload: {
  refFrameCount: number;
  promptText?: string;
  useOpenAiPreflight?: boolean;
  parcel?: DroneParcelQuery;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const json: Record<string, unknown> = {
    ref_frame_count: Math.max(2, Math.min(8, payload.refFrameCount || DRONE_SCENE_INITIAL_COUNT)),
    editor_mode: "ai_drone",
    prompt_text: (payload.promptText || "").slice(0, 2000),
    ...runwayPortraitClientJsonFields(),
    ...openAiPreflightPrepJsonFields(Boolean(payload.useOpenAiPreflight)),
  };
  if (payload.parcel) {
    json.mahalle = String(payload.parcel.mahalleTkgmValue || payload.parcel.mahalle || "");
    json.ada = String(payload.parcel.ada || "0").trim();
    json.parsel = String(payload.parcel.parsel || "").trim();
  }
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

export async function startDroneRunwayProduction(payload: {
  parcel: DroneParcelQuery;
  preparedJobId: string;
  refFrameCount: number;
  narrationText: string;
  parcelAreaLabelTr?: string;
  city?: string;
  district?: string;
  quarter?: string;
  fullSubtitleOnly?: boolean;
  useOpenAiPreflight?: boolean;
  narrCtx?: DroneNarrationInputs | null;
}): Promise<
  | { ok: true; jobId: string; pollMs: number }
  | { ok: false; error: string; licenseRequired?: boolean }
> {
  const form = new FormData();
  form.append("mahalle", String(payload.parcel.mahalleTkgmValue || payload.parcel.mahalle || ""));
  form.append("ada", payload.parcel.ada || "0");
  form.append("parsel", payload.parcel.parsel || "");
  form.append("prepared_job_id", payload.preparedJobId);
  form.append("ref_frame_count", String(payload.refFrameCount));
  appendRunwayPortraitClientFormFields(form);
  if (payload.narrationText.trim()) {
    form.append("narration_text", payload.narrationText.trim().slice(0, 8000));
  }
  if (payload.parcelAreaLabelTr) form.append("parcel_area_label_tr", payload.parcelAreaLabelTr.slice(0, 64));
  if (payload.city) form.append("runway_city", payload.city.slice(0, 64));
  if (payload.district) form.append("runway_district", payload.district.slice(0, 64));
  if (payload.quarter) form.append("runway_quarter", payload.quarter.slice(0, 64));
  if (payload.fullSubtitleOnly) form.append("runway_full_subtitle", "1");
  const ctx = payload.narrCtx;
  if (ctx?.population != null) form.append("population", String(ctx.population));
  if (ctx?.cityCenterKm != null) form.append("city_center_dist_km", String(ctx.cityCenterKm));
  if (ctx?.townCenterKm != null) form.append("town_center_dist_km", String(ctx.townCenterKm));
  appendOpenAiPreflightFormFields(form, Boolean(payload.useOpenAiPreflight));

  const res = await authFormFetch<{ async?: boolean; job_id?: string; poll_ms?: number; success?: boolean; error?: string }>(
    "/api/drone-recording-runway/",
    form,
  );
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

export async function getRunwayJobStatus(jobId: string): Promise<
  | { ok: true; poll: RunwayPollStatus }
  | { ok: false; error: string }
> {
  const res = await fetchRunwayJobStatus(jobId);
  if (!res.ok) return res;
  const status = res.status;
  return {
    ok: true,
    poll: {
      ...status,
      segmentSlotProgress: status.segment_slot_progress,
    },
  };
}

/** @deprecated pollRunwayUntilDone (droneRunwayService) kullanın */
export async function waitForRunwayVideoReady(
  jobId: string,
  pollMs = 1500,
  _maxAttempts = 180,
  onPoll?: (status: RunwayPollStatus) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await pollRunwayUntilDone({
    jobId,
    pollMs,
    maxWaitMs: 3 * 60 * 60 * 1000,
    onPoll: (status) => {
      onPoll?.({
        ...status,
        segmentSlotProgress: status.segment_slot_progress,
      });
    },
  });
  if (result.ok) return { ok: true };
  if ("background" in result && result.background) return { ok: true };
  return { ok: false, error: result.error || "Video üretilemedi." };
}

export async function fetchDroneVideoContext(params: {
  mahalleTkgmValue: number;
  cityId?: number;
  townId?: number;
  proparcelValue?: number;
}): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const q = new URLSearchParams();
  q.set("mahalle", String(params.mahalleTkgmValue));
  if (params.cityId) q.set("city_id", String(params.cityId));
  if (params.townId) q.set("town_id", String(params.townId));
  if (params.proparcelValue) q.set("proparcel_value", String(params.proparcelValue));
  const res = await authJsonFetch<Record<string, unknown>>(
    `/api/drone-video-context/?${q.toString()}`,
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Konum bilgisi alınamadı.") };
  const raw = (res.data || {}) as Record<string, unknown>;
  if (raw.success === false) {
    return { ok: false, error: errMessage(raw.error, "Konum bilgisi alınamadı.") };
  }
  const nested = raw.data;
  const data =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : raw;
  return { ok: true, data };
}

/** Web `loadRunwayNarrationFromApi` ile aynı bağlam: il/ilçe/mahalle + nüfus + merkez mesafeleri */
export async function resolveDroneNarrationInputs(
  parcel: DroneParcelQuery,
  tkgmData: { properties?: Record<string, unknown> } | null,
  parcelAreaM2: string,
): Promise<DroneNarrationInputs> {
  const ctx = await fetchDroneVideoContext({
    mahalleTkgmValue: parcel.mahalleTkgmValue,
    cityId: parcel.cityId,
    townId: parcel.townId,
    proparcelValue: parcel.proparcelValue,
  });
  const ctxData = ctx.ok ? ctx.data : {};
  const props = (tkgmData?.properties || {}) as Record<string, unknown>;

  const city = (
    String(ctxData.city_name || "").trim() ||
    pickTkgmString(props, ["ilAd", "il_ad", "il"]) ||
    String(parcel.city || "").trim()
  );
  const district = (
    String(ctxData.district_name || "").trim() ||
    pickTkgmString(props, ["ilceAd", "ilce_ad", "ilce"]) ||
    String(parcel.town || "").trim()
  );
  const quarter = (
    String(ctxData.quarter_name || "").trim() ||
    pickTkgmString(props, ["mahalleAd", "mahalle", "mahalleAdi"]) ||
    String(parcel.mahalle || "").trim()
  );

  return {
    city,
    district,
    quarter,
    parcelAreaM2: String(parcelAreaM2 || "").trim(),
    population: numOrNull(ctxData.population),
    cityCenterKm: numOrNull(ctxData.city_center_dist_km),
    townCenterKm: numOrNull(ctxData.town_center_dist_km),
  };
}

export function clampDroneSimpleNarrationText(
  text: string,
  maxChars: number = DRONE_SIMPLE_NARRATION_TEXT_MAX,
): string {
  return String(text || "").slice(0, Math.max(1, maxChars));
}

export async function generateRunwayNarration(
  payload: DroneNarrationInputs,
  options?: { maxChars?: number },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const maxChars = Math.max(1, Number(options?.maxChars) || DRONE_SIMPLE_NARRATION_TEXT_MAX);
  const form = new FormData();
  form.append("city", payload.city || "");
  form.append("district", payload.district || "");
  form.append("quarter", payload.quarter || "");
  form.append("parcel_area_m2", payload.parcelAreaM2 || "");
  if (payload.population != null) {
    form.append("population", String(payload.population));
  } else {
    form.append("population", "");
  }
  if (payload.cityCenterKm != null) {
    form.append("city_center_dist_km", String(payload.cityCenterKm));
  } else {
    form.append("city_center_dist_km", "");
  }
  if (payload.townCenterKm != null) {
    form.append("town_center_dist_km", String(payload.townCenterKm));
  } else {
    form.append("town_center_dist_km", "");
  }
  form.append("price_input", payload.priceInput || "");
  form.append("max_chars", String(maxChars));
  const res = await authFormFetch<{ success?: boolean; narration_text?: string; text?: string }>(
    "/api/drone-runway-narration/",
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Anlatım metni üretilemedi.") };
  }
  const raw = String((res.data as any)?.narration_text || (res.data as any)?.text || "").trim();
  if (!raw) return { ok: false, error: "Boş anlatım metni döndü." };
  const text = clampDroneSimpleNarrationText(raw, maxChars).trim();
  if (!text) return { ok: false, error: "Boş anlatım metni döndü." };
  return { ok: true, text };
}

export async function saveNarrationDraft(
  jobId: string,
  narrationDraftText: string,
  context?: Partial<DroneNarrationInputs>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const json: Record<string, unknown> = {
    job_id: jobId,
    narration_draft_text: clampDroneSimpleNarrationText(narrationDraftText),
  };
  if (context) {
    if (context.city) json.city = context.city.slice(0, 64);
    if (context.district) json.district = context.district.slice(0, 64);
    if (context.quarter) json.quarter = context.quarter.slice(0, 64);
    if (context.parcelAreaM2) json.parcel_area_m2 = context.parcelAreaM2.slice(0, 64);
    if (context.population != null) json.population = context.population;
    if (context.cityCenterKm != null) json.city_center_dist_km = context.cityCenterKm;
    if (context.townCenterKm != null) json.town_center_dist_km = context.townCenterKm;
  }
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-editor/narration-draft/", {
    method: "POST",
    json,
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Metin kaydedilemedi.") };
  }
  return { ok: true };
}

/** Metinden yeni TTS üretir ve videoya mux eder (web `refreshRunwayAudio`). */
export async function refreshRunwayAudio(payload: {
  jobId: string;
  narrationText: string;
  city?: string;
  district?: string;
  quarter?: string;
  parcelPrice?: string;
  voiceId?: string;
  voiceKey?: string;
  narrationAudioId?: string;
  narrationApplyOnly?: boolean;
  narrationForceTts?: boolean;
  narrationGenerateOnly?: boolean;
}): Promise<
  { ok: true; jobId: string; pollMs: number } | { ok: false; error: string }
> {
  const form = new FormData();
  form.append("job_id", String(payload.jobId || "").trim());
  form.append("narration_text", String(payload.narrationText || "").trim().slice(0, 8000));
  form.append("tts_language_code", "tr");
  form.append("parcel_price", String(payload.parcelPrice || "").trim().slice(0, 200));
  if (payload.city) form.append("runway_city", payload.city.trim().slice(0, 64));
  if (payload.district) form.append("runway_district", payload.district.trim().slice(0, 64));
  if (payload.quarter) form.append("runway_quarter", payload.quarter.trim().slice(0, 64));
  if (payload.voiceId) form.append("narration_voice_id", payload.voiceId.trim().slice(0, 80));
  if (payload.voiceKey) form.append("narration_voice_key", payload.voiceKey.trim().slice(0, 40));
  if (payload.narrationAudioId) {
    form.append("narration_audio_id", payload.narrationAudioId.trim().slice(0, 80));
  }
  if (payload.narrationApplyOnly) form.append("narration_apply_only", "1");
  if (payload.narrationForceTts) form.append("narration_force_tts", "1");
  if (payload.narrationGenerateOnly) form.append("narration_generate_only", "1");

  const res = await authFormFetch<{
    success?: boolean;
    async?: boolean;
    job_id?: string;
    poll_ms?: number;
    error?: string;
  }>("/api/drone-recording-runway/refresh-audio/", form);

  if (!res.ok || (res.data as any)?.success === false) {
    return {
      ok: false,
      error: errMessage(res.error || (res.data as any)?.error, "Ses oluşturma başlatılamadı."),
    };
  }
  const id = String((res.data as any)?.job_id || payload.jobId).trim();
  if (!id) return { ok: false, error: "İş kimliği alınamadı." };
  return {
    ok: true,
    jobId: id,
    pollMs: Number((res.data as any)?.poll_ms || 1500),
  };
}

export async function getSubtitleSettings(
  jobId: string,
): Promise<{ ok: true; settings: SubtitleSettings } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ subtitle_settings?: SubtitleSettings }>(
    `/api/drone-editor/subtitle-settings/?job_id=${encodeURIComponent(jobId)}&orientation=portrait`,
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Altyazı ayarı alınamadı.") };
  const settings = (res.data as any)?.subtitle_settings || (res.data as any);
  return { ok: true, settings: settings as SubtitleSettings };
}

export async function saveSubtitleSettings(
  jobId: string,
  subtitleSettings: SubtitleSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-editor/subtitle-settings/", {
    method: "POST",
    json: {
      job_id: jobId,
      orientation: "portrait",
      subtitle_settings: subtitleSettings,
    },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Altyazı kaydedilemedi.") };
  }
  return { ok: true };
}

export async function getHideProparcelBrand(
  jobId: string,
): Promise<{ ok: true; hidden: boolean } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ hide_proparcel_brand?: boolean; success?: boolean }>(
    `/api/drone-editor/brand-settings/?job_id=${encodeURIComponent(jobId)}`,
    { method: "GET" },
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Etiket ayarı alınamadı.") };
  }
  return { ok: true, hidden: Boolean((res.data as any)?.hide_proparcel_brand) };
}

export async function saveHideProparcelBrand(
  jobId: string,
  hide: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-editor/brand-settings/", {
    method: "POST",
    json: {
      job_id: jobId,
      hide_proparcel_brand: hide,
    },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Etiket ayarı kaydedilemedi.") };
  }
  return { ok: true };
}

export function hideProparcelBrandFromMeta(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  if (!meta || typeof meta !== "object") return false;
  return Boolean(meta.hide_proparcel_brand);
}

export async function getRecommendedMusic(
  jobId: string,
  query = "",
): Promise<{ ok: true; tracks: MusicTrack[] } | { ok: false; error: string }> {
  const q = query.trim() ? `&query=${encodeURIComponent(query)}` : "";
  const res = await authJsonFetch<{ tracks?: MusicTrack[]; results?: MusicTrack[] }>(
    `/api/drone-editor/music/recommended/?job_id=${encodeURIComponent(jobId)}${q}`,
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Müzik listesi alınamadı.") };
  const tracks = (res.data as any)?.tracks || (res.data as any)?.results || [];
  return { ok: true, tracks: Array.isArray(tracks) ? tracks : [] };
}

export function musicTrackKey(track: MusicTrack, index = 0): string {
  const provider = String(track.provider || "proparcel").trim().toLowerCase();
  const id = String(
    track.provider_track_id || track.filename || track.id || track.track_id || track.title || "",
  ).trim();
  return `${provider}:${id || `track-${index}`}`;
}

export function musicFromJobMeta(meta: Record<string, unknown> | null | undefined): MusicTrack | null {
  const music = meta?.music;
  if (!music || typeof music !== "object") return null;
  const m = music as Record<string, unknown>;
  const provider = String(m.provider || "proparcel").trim().toLowerCase();
  return {
    ...m,
    provider,
    id: String(m.track_id || m.id || m.provider_track_id || "").trim(),
    provider_track_id: String(m.track_id || m.provider_track_id || m.id || "").trim(),
    filename: String(m.filename || "").trim(),
    title: String(m.title || m.name || "").trim(),
    artist:
      provider === UPLOAD_MUSIC_PROVIDER
        ? "Yüklenen"
        : String(m.artist || "ProParcel").trim(),
    preview_url: String(m.preview_url || "").trim(),
  };
}

export function musicVolumeFromJobMeta(
  meta: Record<string, unknown> | null | undefined,
): number {
  const music = meta?.music;
  if (!music || typeof music !== "object") {
    return DEFAULT_DRONE_MUSIC_SELECT_SETTINGS.volume;
  }
  const vol = Number((music as Record<string, unknown>).volume);
  return Number.isFinite(vol)
    ? Math.max(0, Math.min(100, Math.round(vol)))
    : DEFAULT_DRONE_MUSIC_SELECT_SETTINGS.volume;
}

export async function uploadDroneMusic(
  jobId: string,
  file: { uri: string; name?: string; type?: string },
  settings?: Record<string, unknown>,
): Promise<
  | { ok: true; track: MusicTrack; music: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const form = new FormData();
  form.append("job_id", jobId);
  form.append("file", {
    uri: file.uri,
    name: file.name || "music.mp3",
    type: file.type || "audio/mpeg",
  } as any);

  const normalized = buildMusicSelectSettings(
    settings?.volume as number | undefined,
  );
  const settingsPayload: Record<string, unknown> = {
    ...normalized,
    music_trim_start: normalized.trim_start,
    music_trim_end: normalized.trim_end,
    music_cut_ranges: normalized.cut_intervals,
  };
  Object.entries(settingsPayload).forEach(([key, value]) => {
    const serialized =
      Array.isArray(value) || (value && typeof value === "object")
        ? JSON.stringify(value)
        : String(value);
    form.append(key, serialized);
  });

  const res = await authFormFetch<{
    success?: boolean;
    track?: Record<string, unknown>;
    music?: Record<string, unknown>;
    error?: string;
  }>("/api/drone-editor/music/upload/", form);

  if (!res.ok || (res.data as any)?.success === false) {
    return {
      ok: false,
      error: errMessage(res.error || (res.data as any)?.error, "Müzik yüklenemedi."),
    };
  }

  const rawTrack = (res.data as any)?.track;
  if (!rawTrack || typeof rawTrack !== "object") {
    return { ok: false, error: "Yüklenen parça bilgisi alınamadı." };
  }

  const track = normalizeApiMusicTrack(rawTrack as Record<string, unknown>, jobId, API_URL);
  const music =
    (res.data as any)?.music && typeof (res.data as any).music === "object"
      ? ((res.data as any).music as Record<string, unknown>)
      : {};

  return { ok: true, track, music };
}

export async function selectMusic(
  jobId: string,
  track: MusicTrack,
  settings?: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const selectSettings =
    settings && typeof settings.volume === "number"
      ? buildMusicSelectSettings(settings.volume as number)
      : settings || DEFAULT_DRONE_MUSIC_SELECT_SETTINGS;
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-editor/music/select/", {
    method: "POST",
    json: {
      job_id: jobId,
      track: buildSelectMusicTrackPayload(track),
      settings: selectSettings,
      clear: false,
    },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Müzik seçilemedi.") };
  }
  return { ok: true };
}

export async function clearMusic(jobId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-editor/music/select/", {
    method: "POST",
    json: { job_id: jobId, clear: true },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Müzik kaldırılamadı.") };
  }
  return { ok: true };
}

export function droneMusicFileUrl(jobId: string): string {
  return absoluteDroneApiUrl(`/api/drone-editor/music/file/?job_id=${encodeURIComponent(jobId)}`);
}

export async function startPortraitExport(
  jobId: string,
): Promise<{ ok: true; status: string; exportId: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{
    status?: string;
    success?: boolean;
    export_id?: string;
    active_export_id?: string;
  }>("/api/drone-editor/export/", {
    method: "POST",
    json: { job_id: jobId, orientation: "portrait" },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Dışa aktarma başlatılamadı.") };
  }
  const data = res.data as { status?: string; export_id?: string; active_export_id?: string };
  const exportId = String(data?.export_id || data?.active_export_id || "").trim();
  return { ok: true, status: String(data?.status || "queued"), exportId };
}

export type PortraitExportStatusSnapshot = {
  status: string;
  exportId: string;
  outputFile: string;
  finishedAt: string;
  transient?: boolean;
};

export async function fetchPortraitExportStatus(jobId: string): Promise<PortraitExportStatusSnapshot> {
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
    `/api/drone-editor/export/status/?job_id=${encodeURIComponent(jobId)}&orientation=portrait`,
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
    outputFile: String(exp.output_file || latest.portrait || "").trim(),
    finishedAt: String(exp.finished_at || "").trim(),
    transient: false,
  };
}

export async function getPortraitExportStatus(jobId: string): Promise<string> {
  const snap = await fetchPortraitExportStatus(jobId);
  return snap.status;
}

export function classifyPortraitExportStatus(status: string): { isReady: boolean; isFailed: boolean } {
  const s = String(status || "").trim().toLowerCase();
  const isReady = s === "success" || s === "ready" || s === "done";
  const isFailed = s === "failed" || s === "cancelled" || s === "enqueue_failed";
  return { isReady, isFailed };
}

export function userCardFromProfileContext(data: Record<string, unknown>): UserCardInfo {
  const profile = (data.profile || {}) as Record<string, unknown>;
  const companyProfile = (data.company_profile || {}) as Record<string, unknown>;
  const company = (data.company || {}) as Record<string, unknown>;
  const media = (data.media || {}) as Record<string, unknown>;
  const user = (data.user || {}) as Record<string, unknown>;
  const firstName = String(profile.first_name || user.first_name || "").trim();
  const lastName = String(profile.last_name || user.last_name || "").trim();
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(user.full_name || "").trim() ||
    String(user.email || "").trim();
  const companyName =
    String(
      company.company_name ||
        companyProfile.company_name ||
        companyProfile.trade_name ||
        profile.company_name ||
        "",
    ).trim() || "ProParcel";
  const avatarUrl = String(
    media.avatar_url ||
      media.pending_avatar_url ||
      profile.avatar_url ||
      profile.pending_avatar_url ||
      user.avatar_url ||
      "",
  ).trim();
  return { companyName, fullName, avatarUrl };
}

export function normalizeUserCardInfo(raw: Record<string, unknown> | null | undefined): UserCardInfo {
  const src = raw || {};
  const companyName = String(
    src.companyName || src.company_name || src.company || "",
  ).trim() || "ProParcel";
  const fullName = String(
    src.fullName || src.full_name || src.person || "",
  ).trim();
  const avatarUrl = String(src.avatarUrl || src.avatar_url || "").trim();
  return { companyName, fullName, avatarUrl };
}

export async function fetchProfileUserCardInfo(): Promise<
  { ok: true; userInfo: UserCardInfo } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ success?: boolean; data?: Record<string, unknown> }>(
    "/api/profile/context/?sections=base",
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Profil alınamadı.") };
  const data = ((res.data as any)?.data || {}) as Record<string, unknown>;
  return { ok: true, userInfo: userCardFromProfileContext(data) };
}

export async function listDroneEditorAnnotations(
  jobId: string,
  orientation = "portrait",
): Promise<{ ok: true; data: DroneEditorAnnotationsList } | { ok: false; error: string }> {
  const res = await authJsonFetch<DroneEditorAnnotationsList>(
    `/api/drone-editor/annotations/list/?job_id=${encodeURIComponent(jobId)}&orientation=${encodeURIComponent(orientation)}`,
    { method: "GET" },
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Anotasyonlar alınamadı.") };
  }
  const raw = (res.data || {}) as DroneEditorAnnotationsList;
  return {
    ok: true,
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

export function findUserCardAnnotation(annotations: DroneEditorAnnotation[]): DroneEditorAnnotation | null {
  return (
    annotations.find(
      (ann) =>
        ann.annotation_type === "text_box" &&
        Boolean(ann.config_json?.userInfoCard),
    ) || null
  );
}

export async function deleteDroneEditorAnnotation(
  annotationId: number | string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-editor/annotations/delete/", {
    method: "POST",
    json: { id: annotationId },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Anotasyon silinemedi.") };
  }
  return { ok: true };
}

export async function updateDroneEditorAnnotation(
  annotationId: number | string,
  payload: {
    config_json?: Record<string, unknown>;
    label?: string;
    orientation?: string;
    annotation_type?: string;
  },
): Promise<{ ok: true; annotation?: DroneEditorAnnotation } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success?: boolean; annotation?: DroneEditorAnnotation }>(
    "/api/drone-editor/annotations/update/",
    {
      method: "PUT",
      json: { id: annotationId, ...payload },
    },
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Anotasyon güncellenemedi.") };
  }
  return { ok: true, annotation: (res.data as any)?.annotation };
}

export async function uploadUserCardAvatar(
  jobId: string,
  image: { uri: string; name?: string; type?: string },
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("job_id", jobId);
  form.append("image", {
    uri: image.uri,
    name: image.name || "user-card-avatar.jpg",
    type: image.type || "image/jpeg",
  } as any);
  const res = await authFormFetch<{ success?: boolean; url?: string; image_url?: string }>(
    "/api/drone-editor/user-card-avatar/upload/",
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Resim yüklenemedi.") };
  }
  const url = String((res.data as any)?.url || (res.data as any)?.image_url || "").trim();
  if (!url) return { ok: false, error: "Resim URL alınamadı." };
  return { ok: true, url };
}

const DEFAULT_USER_CARD_POS = DEFAULT_PORTRAIT_USER_CARD_POS;

export async function createUserCardAnnotation(
  jobId: string,
  userInfo: UserCardInfo,
  centerPoint = DEFAULT_USER_CARD_POS,
  cardScale = DEFAULT_USER_CARD_SCALE,
): Promise<{ ok: true; annotation?: DroneEditorAnnotation } | { ok: false; error: string }> {
  const exportPoint = userCardUiCenterToExportPoint(centerPoint, cardScale);
  const res = await authJsonFetch<{ annotation?: DroneEditorAnnotation; success?: boolean }>(
    "/api/drone-editor/annotations/create/",
    {
      method: "POST",
      json: {
        job_id: jobId,
        annotation_type: "text_box",
        start_time: 0,
        pause_duration: 999,
        color: "#ffffff",
        line_width: 2,
        label: "Kullanıcı",
        animation_in: "fade",
        animation_out: "fade",
        orientation: "portrait",
        config_json: {
          point: exportPoint,
          userInfoCard: true,
          userInfo: normalizeUserCardInfo(userInfo),
          fontSize: 20,
          userCardScale: cardScale,
        },
      },
    },
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Kullanıcı kartı eklenemedi.") };
  }
  return { ok: true, annotation: (res.data as any)?.annotation };
}

export async function upsertUserCardAnnotation(
  jobId: string,
  userInfo: UserCardInfo,
  existingAnnotationId?: number | string | null,
  centerPoint = DEFAULT_USER_CARD_POS,
  cardScale = DEFAULT_USER_CARD_SCALE,
): Promise<{ ok: true; annotation?: DroneEditorAnnotation } | { ok: false; error: string }> {
  const normalized = normalizeUserCardInfo(userInfo);
  const exportPoint = userCardUiCenterToExportPoint(centerPoint, cardScale);
  if (existingAnnotationId) {
    const updated = await updateDroneEditorAnnotation(existingAnnotationId, {
      annotation_type: "text_box",
      orientation: "portrait",
      config_json: {
        point: exportPoint,
        userInfoCard: true,
        userInfo: normalized,
        fontSize: 20,
        userCardScale: cardScale,
      },
    });
    if (!updated.ok) return updated;
    return { ok: true, annotation: updated.annotation };
  }
  return createUserCardAnnotation(jobId, normalized, centerPoint, cardScale);
}

export function portraitExportDownloadUrl(jobId: string, outputFile?: string): string {
  const file = String(outputFile || "").trim();
  const fileQuery = file ? `&output_file=${encodeURIComponent(file)}` : "";
  return absoluteDroneApiUrl(
    `/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/?orientation=portrait&download=1${fileQuery}`,
  );
}
