import { API_URL } from "../config/api";
import { authFormFetch, authJsonFetch } from "./apiClient";
import { absoluteDroneApiUrl } from "./imageAnimationService";
import type { MobileUploadImage } from "./imageAnimationService";

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
  artist?: string;
  preview_url?: string;
  duration?: number;
  [key: string]: unknown;
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

export function droneRunwayVideoUrl(jobId: string): string {
  return absoluteDroneApiUrl(`/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/`);
}

export async function runwayPrepStartSimple(payload: {
  refFrameCount: number;
  promptText?: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ job_id?: string; success?: boolean }>("/api/drone-recording-runway/prep/", {
    method: "POST",
    json: {
      ref_frame_count: Math.max(2, Math.min(8, payload.refFrameCount || 3)),
      editor_mode: "ai_drone",
      prompt_text: (payload.promptText || "").slice(0, 2000),
    },
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
}): Promise<
  | { ok: true; jobId: string; pollMs: number }
  | { ok: false; error: string }
> {
  const form = new FormData();
  form.append("mahalle", String(payload.parcel.mahalleTkgmValue || payload.parcel.mahalle || ""));
  form.append("ada", payload.parcel.ada || "0");
  form.append("parsel", payload.parcel.parsel || "");
  form.append("prepared_job_id", payload.preparedJobId);
  form.append("ref_frame_count", String(payload.refFrameCount));
  if (payload.narrationText.trim()) {
    form.append("narration_text", payload.narrationText.trim().slice(0, 8000));
  }
  if (payload.parcelAreaLabelTr) form.append("parcel_area_label_tr", payload.parcelAreaLabelTr.slice(0, 64));
  if (payload.city) form.append("runway_city", payload.city.slice(0, 64));
  if (payload.district) form.append("runway_district", payload.district.slice(0, 64));
  if (payload.quarter) form.append("runway_quarter", payload.quarter.slice(0, 64));
  if (payload.fullSubtitleOnly) form.append("runway_full_subtitle", "1");

  const res = await authFormFetch<{ async?: boolean; job_id?: string; poll_ms?: number; success?: boolean; error?: string }>(
    "/api/drone-recording-runway/",
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Video üretimi başlatılamadı.") };
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
  | {
      ok: true;
      state: string;
      ready: boolean;
      progress?: { step?: string; label?: string };
      error?: string;
    }
  | { ok: false; error: string }
> {
  const res = await authJsonFetch<{
    state?: string;
    ready?: boolean;
    progress?: { step?: string; label?: string };
    error?: string;
  }>(`/api/drone-recording-runway/status/?job_id=${encodeURIComponent(jobId)}`, { method: "GET" });
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Durum alınamadı.") };
  return {
    ok: true,
    state: String((res.data as any)?.state || ""),
    ready: Boolean((res.data as any)?.ready),
    progress: (res.data as any)?.progress,
    error: (res.data as any)?.error,
  };
}

export async function waitForRunwayVideoReady(
  jobId: string,
  pollMs = 1500,
  maxAttempts = 180,
  onPoll?: (status: {
    state: string;
    ready: boolean;
    progress?: { step?: string; label?: string };
  }) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const interval = Math.max(800, Math.min(4000, pollMs));
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((r) => setTimeout(r, interval));
    const status = await getRunwayJobStatus(jobId);
    if (!status.ok) return status;
    onPoll?.({
      state: status.state,
      ready: status.ready,
      progress: status.progress,
    });
    const step = String(status.progress?.step || "");
    if (status.state === "FAILURE" || step === "failed") {
      return { ok: false, error: status.error || status.progress?.label || "Video üretilemedi." };
    }
    if (status.ready || step === "ready" || step === "done") {
      return { ok: true };
    }
  }
  return { ok: false, error: "Video üretimi zaman aşımına uğradı." };
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

export async function generateRunwayNarration(
  payload: DroneNarrationInputs,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
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
  const res = await authFormFetch<{ success?: boolean; narration_text?: string; text?: string }>(
    "/api/drone-runway-narration/",
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Anlatım metni üretilemedi.") };
  }
  const text = String((res.data as any)?.narration_text || (res.data as any)?.text || "").trim();
  if (!text) return { ok: false, error: "Boş anlatım metni döndü." };
  return { ok: true, text };
}

export async function saveNarrationDraft(
  jobId: string,
  narrationDraftText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-editor/narration-draft/", {
    method: "POST",
    json: {
      job_id: jobId,
      narration_draft_text: narrationDraftText.slice(0, 8000),
    },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Metin kaydedilemedi.") };
  }
  return { ok: true };
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

export async function selectMusic(
  jobId: string,
  track: MusicTrack,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-editor/music/select/", {
    method: "POST",
    json: { job_id: jobId, track, settings: {}, clear: false },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Müzik seçilemedi.") };
  }
  return { ok: true };
}

export async function startPortraitExport(jobId: string): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ status?: string; success?: boolean }>("/api/drone-editor/export/", {
    method: "POST",
    json: { job_id: jobId, orientation: "portrait" },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Dışa aktarma başlatılamadı.") };
  }
  return { ok: true, status: String((res.data as any)?.status || "queued") };
}

export async function getPortraitExportStatus(jobId: string): Promise<string> {
  const res = await authJsonFetch<{ status?: string }>(
    `/api/drone-editor/export/status/?job_id=${encodeURIComponent(jobId)}&orientation=portrait`,
    { method: "GET" },
  );
  if (!res.ok) return "error";
  return String((res.data as any)?.status || "idle");
}

export async function fetchProfileUserCardInfo(): Promise<
  { ok: true; userInfo: Record<string, unknown> } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ success?: boolean; data?: Record<string, unknown> }>(
    "/api/profile/context/?sections=base",
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Profil alınamadı.") };
  const data = ((res.data as any)?.data || {}) as Record<string, unknown>;
  const prof = (data.profile || {}) as Record<string, unknown>;
  const co = (data.company_profile || {}) as Record<string, unknown>;
  const u = (data.user || {}) as Record<string, unknown>;
  const company = String(co.company_name || co.trade_name || prof.company_name || "").trim();
  const person = [prof.first_name, prof.last_name].filter(Boolean).join(" ").trim() || String(u.full_name || "").trim();
  const avatarUrl = String(prof.avatar_url || u.avatar_url || "").trim();
  return {
    ok: true,
    userInfo: {
      company,
      person,
      avatarUrl,
      userInfoCard: true,
    },
  };
}

export async function createUserCardAnnotation(jobId: string, userInfo: Record<string, unknown>): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ annotation?: unknown; success?: boolean }>("/api/drone-editor/annotations/create/", {
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
        point: { x: 0.5, y: 0.88 },
        userInfoCard: true,
        userInfo,
        fontSize: 20,
      },
    },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error, "Kullanıcı kartı eklenemedi.") };
  }
  return { ok: true };
}

export function portraitExportDownloadUrl(jobId: string): string {
  return `${API_URL}/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/?orientation=portrait`;
}
