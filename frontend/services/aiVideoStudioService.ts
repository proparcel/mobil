import { authFormFetch, authJsonFetch } from "./apiClient";

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
  progress?: { step?: string; label?: string; detail?: string } | null;
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
    const maybe = error as { error?: unknown; message?: unknown; detail?: unknown };
    if (typeof maybe.error === "string") return maybe.error;
    if (typeof maybe.message === "string") return maybe.message;
    if (typeof maybe.detail === "string") return maybe.detail;
  }
  return fallback;
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
  return { ok: true, job: (res.data as any)?.data || (res.data as any) };
}

export async function generateAiVideoStudioScript(jobId: string): Promise<{ ok: true; job: AiVideoStudioJob; script: AiVideoStudioScript } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ data?: { job?: AiVideoStudioJob; script?: AiVideoStudioScript } }>(
    `/api/v1/self/ai-video-studio/jobs/${encodeURIComponent(jobId)}/script`,
    { method: "POST", json: {} },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Metin oluşturulamadı.") };
  const data = (res.data as any)?.data || {};
  return { ok: true, job: data.job, script: data.script };
}

export async function confirmAiVideoStudioJob(jobId: string, fullNarration: string): Promise<{ ok: true; job: AiVideoStudioJob } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ data?: AiVideoStudioJob }>(
    `/api/v1/self/ai-video-studio/jobs/${encodeURIComponent(jobId)}/confirm`,
    { method: "POST", json: { full_narration: fullNarration } },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Video üretimi başlatılamadı.") };
  return { ok: true, job: (res.data as any)?.data || (res.data as any) };
}

export async function deleteAiVideoStudioJob(jobId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch(`/api/v1/self/ai-video-studio/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  if (!res.ok) return { ok: false, error: errMessage(res.error, "İş silinemedi.") };
  return { ok: true };
}
