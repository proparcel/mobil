import { API_URL } from "../config/api";
import { authFormFetch, authJsonFetch } from "./apiClient";

export type AiVideoStudioQuote = {
  image_count: number;
  total: number;
  base_action: string;
  base_credits: number;
  included_images: number;
  extra_frames: number;
  extra_unit_credits: number;
  extra_action: string;
  current_balance?: number;
  has_enough?: boolean;
};

export type AiVideoStudioJob = {
  job_id: string;
  status: string;
  source?: string;
  title?: string;
  body_text?: string;
  image_items?: Array<{ image_id?: string; url?: string; relative_path?: string; filename?: string }>;
  processed_url?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  error_message?: string | null;
  scene_metadata?: Record<string, any> | null;
  progress?: { step?: string; label?: string; detail?: string; index?: number; total?: number } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AiVideoStudioScript = {
  full_narration: string;
  scene_narrations: string[];
  scene_captions: string[];
  scene_prompts: string[];
  closing_caption: string;
};

export type MobileUploadImage = {
  uri: string;
  name: string;
  type: string;
};

function errMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const maybe = error as {
      error?: unknown;
      message?: unknown;
      detail?: unknown;
      user_message?: unknown;
    };
    if (typeof maybe.message === "string") return maybe.message;
    if (typeof maybe.detail === "string") return maybe.detail;
    if (typeof maybe.user_message === "string") return maybe.user_message;
    if (typeof maybe.error === "string") return maybe.error;
    if (maybe.error && typeof maybe.error === "object") {
      const nested = maybe.error as { message?: unknown; code?: unknown };
      if (typeof nested.message === "string") return nested.message;
      if (typeof nested.code === "string") return nested.code;
    }
  }
  return fallback;
}

export function absoluteStudioMediaUrl(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = API_URL.replace(/\/$/, "");
  return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
}

export async function getAiVideoStudioQuote(
  imageCount: number,
): Promise<{ ok: true; quote: AiVideoStudioQuote } | { ok: false; error: string; status?: number }> {
  const res = await authJsonFetch<{ data?: AiVideoStudioQuote }>(
    `/api/v1/self/ai-video-studio/quote?image_count=${encodeURIComponent(String(imageCount))}`,
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Fiyat alınamadı."), status: res.status };
  const quote = ((res.data as any)?.data || res.data) as AiVideoStudioQuote;
  return { ok: true, quote };
}

export async function listAiVideoStudioJobs(): Promise<{ ok: true; items: AiVideoStudioJob[] } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ items?: AiVideoStudioJob[] }>("/api/v1/self/ai-video-studio/jobs", { method: "GET" });
  if (!res.ok) return { ok: false, error: errMessage(res.error, "İşler yüklenemedi.") };
  return { ok: true, items: Array.isArray(res.data?.items) ? res.data.items : [] };
}

export async function createAiVideoStudioJob(payload: {
  title: string;
  bodyText: string;
  images: MobileUploadImage[];
}): Promise<{ ok: true; job: AiVideoStudioJob } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("title", payload.title || "");
  form.append("body_text", payload.bodyText || "");
  (payload.images || []).forEach((image) => {
    form.append("images", {
      uri: image.uri,
      name: image.name,
      type: image.type || "image/jpeg",
    } as any);
  });
  const res = await authFormFetch<{ data?: AiVideoStudioJob }>("/api/v1/self/ai-video-studio/jobs/create", form);
  if (!res.ok) return { ok: false, error: errMessage(res.error, "İş oluşturulamadı.") };
  const job = (res.data as any)?.data || (res.data as any);
  return { ok: true, job };
}

export async function generateAiVideoStudioScript(
  jobId: string,
): Promise<{ ok: true; job: AiVideoStudioJob; script: AiVideoStudioScript } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ data?: { job?: AiVideoStudioJob; script?: AiVideoStudioScript } }>(
    `/api/v1/self/ai-video-studio/jobs/${encodeURIComponent(jobId)}/script`,
    { method: "POST", json: {} },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Metin oluşturulamadı.") };
  const data = (res.data as any)?.data || {};
  return { ok: true, job: data.job, script: data.script };
}

export async function confirmAiVideoStudioJob(
  jobId: string,
  fullNarration: string,
): Promise<{ ok: true; job: AiVideoStudioJob } | { ok: false; error: string; status?: number }> {
  const res = await authJsonFetch<{ data?: AiVideoStudioJob }>(
    `/api/v1/self/ai-video-studio/jobs/${encodeURIComponent(jobId)}/confirm`,
    { method: "POST", json: { full_narration: fullNarration } },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Video üretimi başlatılamadı."), status: res.status };
  return { ok: true, job: (res.data as any)?.data || (res.data as any) };
}

export async function deleteAiVideoStudioJob(jobId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch(`/api/v1/self/ai-video-studio/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  if (!res.ok) return { ok: false, error: errMessage(res.error, "İş silinemedi.") };
  return { ok: true };
}

export function formatStudioQuoteSummary(quote: AiVideoStudioQuote | null): string {
  if (!quote) return "";
  const parts: string[] = [];
  parts.push(`Paket (${quote.included_images} görsele kadar): ${quote.base_credits} Tepe Kredi`);
  if ((quote.extra_frames || 0) > 0) {
    parts.push(
      `Ek ${quote.extra_frames} görsel × ${quote.extra_unit_credits} = ${(quote.extra_frames || 0) * (quote.extra_unit_credits || 0)} Tepe Kredi`,
    );
  }
  parts.push(`Toplam: ${quote.total} Tepe Kredi`);
  return parts.join("\n");
}
