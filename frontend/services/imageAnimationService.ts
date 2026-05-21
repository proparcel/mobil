import { API_URL } from "../config/api";
import { authFormFetch, authJsonFetch } from "./apiClient";

export type MobileUploadImage = {
  uri: string;
  name: string;
  type: string;
};

export type ImageAnimationLicenseRow = {
  reference_id: string;
  label: string;
  image_animation_title?: string;
  created_at?: string | null;
};

export type ImageAnimationCreditCosts = {
  image_animation: number;
  frame: number;
};

export type DroneMyVideoRow = {
  job_id: string;
  reference_id?: string;
  status?: string;
  label?: string;
  is_license_placeholder?: boolean;
  meta?: {
    editor_mode?: string;
    image_animation_title?: string;
    reference_id?: string;
    action_type?: string;
  };
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

export function absoluteDroneApiUrl(path: string): string {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = API_URL.replace(/\/$/, "");
  return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
}

export function imageAnimationResultUrl(jobId: string, slot: number): string {
  return absoluteDroneApiUrl(
    `/api/drone-recording-runway/segment-preflight-file/${encodeURIComponent(jobId)}/${slot}/?t=${Date.now()}`,
  );
}

export async function getImageAnimationCreditCosts(): Promise<
  { ok: true; costs: ImageAnimationCreditCosts } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ costs?: ImageAnimationCreditCosts }>(
    "/api/drone-recording-runway/credit-costs/",
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Maliyet alınamadı.") };
  const costs = (res.data as any)?.costs || {};
  return {
    ok: true,
    costs: {
      image_animation: Number(costs.image_animation ?? costs.realimg ?? 1),
      frame: Number(costs.frame ?? 2),
    },
  };
}

export async function listImageAnimationLicenses(): Promise<
  { ok: true; items: ImageAnimationLicenseRow[] } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ videos?: DroneMyVideoRow[] }>(
    "/api/drone-recording-runway/my-videos/",
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Lisanslar yüklenemedi.") };
  const videos = Array.isArray((res.data as any)?.videos) ? (res.data as any).videos : [];
  const items: ImageAnimationLicenseRow[] = videos
    .filter(
      (row: DroneMyVideoRow) =>
        row.is_license_placeholder &&
        (row.meta?.editor_mode === "image_animation" || row.meta?.action_type === "ai_img"),
    )
    .map((row: DroneMyVideoRow) => ({
      reference_id: String(row.reference_id || row.meta?.reference_id || "").trim(),
      label: String(row.label || row.meta?.image_animation_title || "AI Resim Canlandırma").trim(),
      image_animation_title: row.meta?.image_animation_title,
      created_at: (row as any).created_at ?? null,
    }))
    .filter((row) => row.reference_id);
  return { ok: true, items };
}

export async function runwayPrepStart(payload: {
  refFrameCount: number;
  title: string;
  licenseRef?: string;
  promptText?: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ job_id?: string; success?: boolean }>("/api/drone-recording-runway/prep/", {
    method: "POST",
    json: {
      ref_frame_count: Math.max(1, Math.min(32, payload.refFrameCount || 1)),
      editor_mode: "image_animation",
      ai_video_title: payload.title.slice(0, 120),
      license_ref: payload.licenseRef || "",
      prompt_text: payload.promptText || "",
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

export async function startImageAnimationAnimate(payload: {
  jobId: string;
  slot: number;
  promptText: string;
  image?: MobileUploadImage | null;
}): Promise<
  | { ok: true; async: boolean; pollMs: number }
  | { ok: false; error: string }
> {
  const form = new FormData();
  form.append("job_id", payload.jobId);
  form.append("slot", String(payload.slot));
  form.append("prompt_text", payload.promptText.slice(0, 2000));
  if (payload.image?.uri) {
    form.append("image", {
      uri: payload.image.uri,
      name: payload.image.name || `segment_${payload.slot}.jpg`,
      type: payload.image.type || "image/jpeg",
    } as any);
  }
  const res = await authFormFetch<{ async?: boolean; poll_ms?: number; success?: boolean }>(
    "/api/drone-recording-runway/segments/preflight/",
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Canlandırma başlatılamadı.") };
  }
  return {
    ok: true,
    async: Boolean((res.data as any)?.async),
    pollMs: Number((res.data as any)?.poll_ms || 1500),
  };
}

export async function getRunwayJobStatus(jobId: string): Promise<
  | {
      ok: true;
      state: string;
      ready: boolean;
      progress?: { step?: string; label?: string; segment_slot?: number };
      error?: string;
    }
  | { ok: false; error: string }
> {
  const res = await authJsonFetch<{
    state?: string;
    ready?: boolean;
    progress?: { step?: string; label?: string; segment_slot?: number };
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

export async function waitForImageAnimationReady(
  jobId: string,
  slot: number,
  pollMs = 1500,
  maxAttempts = 120,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const interval = Math.max(600, Math.min(5000, pollMs));
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((r) => setTimeout(r, interval));
    const status = await getRunwayJobStatus(jobId);
    if (!status.ok) return status;
    const step = String(status.progress?.step || "");
    const progressSlot = Number(status.progress?.segment_slot || slot);
    if (status.state === "FAILURE" || step === "failed") {
      return { ok: false, error: status.error || status.progress?.label || "Resim canlandırılamadı." };
    }
    if (step === "openai_ready" && (!slot || progressSlot === slot)) {
      return { ok: true };
    }
  }
  return { ok: false, error: "Resim canlandırma zaman aşımına uğradı." };
}
