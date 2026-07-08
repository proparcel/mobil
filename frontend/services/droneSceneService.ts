import { authFormFetch, authJsonFetch } from "./apiClient";
import { absoluteDroneApiUrl } from "./imageAnimationService";
import type { MobileUploadImage } from "./imageAnimationService";
import { appendOpenAiPreflightFormFields } from "./openAiPreflightApi";
import {
  MOBILE_AI_VIDEO_NEW_CLIENT_SOURCE,
  MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
} from "../src/constants/aiDroneProductionPipeline";
import {
  buildCanonicalTimeline,
  timelineCoversSegments,
} from "./droneSceneTimeline";

export {
  buildCanonicalTimeline,
  buildMergeTimelineFromStripOrder,
  moveSceneTimelineByStep,
  normalizeSceneTimeline,
  reorderSceneTimeline,
  timelineCoversSegments,
} from "./droneSceneTimeline";

export const DRONE_EK_SAHNE_ACTION = "drone_video_ek_sahne";
export const DRONE_EK_SAHNE_2_ACTION = "drone_video_ek_sahne_2";
export const DRONE_SCENE_PACKAGE_ALLOWANCE = 5;
export const DRONE_SCENE_INITIAL_COUNT = 4;
export const DRONE_SCENE_MAX_CAPTURE_PER_PURCHASE = 2;

export type SceneGenerationRights = {
  enabled: boolean;
  included: number;
  extra_paid: number;
  used: number;
  allowance: number;
  remaining: number;
  can_create_n: number;
};

export type RunwaySegmentItem = {
  slot: number;
  exists: boolean;
  status: string;
  bytes: number;
  url: string;
  ref_url?: string;
  preflight_url?: string;
};

export type RunwaySegmentTimelineEntry = {
  id: string;
  slot: number;
  label?: string;
  enabled?: boolean;
};

export type RunwaySegmentsResponse = {
  segments: RunwaySegmentItem[];
  timeline: RunwaySegmentTimelineEntry[];
  scene_rights: SceneGenerationRights;
  total_frames?: number;
  progress?: { step?: string; label?: string; segment_slot?: number };
  job_error?: string;
};

function errMessage(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object" && "error" in raw) {
    const e = (raw as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e.trim();
  }
  return fallback;
}

export function defaultSceneRights(): SceneGenerationRights {
  return {
    enabled: false,
    included: 0,
    extra_paid: 0,
    used: 0,
    allowance: 0,
    remaining: 0,
    can_create_n: 0,
  };
}

function normalizeSceneRights(raw: SceneGenerationRights | null | undefined): SceneGenerationRights {
  if (!raw?.enabled) return defaultSceneRights();
  return raw;
}

export function segmentVideoAbsoluteUrl(relativeOrAbsolute: string): string {
  const raw = String(relativeOrAbsolute || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  return absoluteDroneApiUrl(raw);
}

export function segmentFileUrl(jobId: string, slot: number, cacheBust?: number): string {
  const bust = cacheBust ?? Date.now();
  return absoluteDroneApiUrl(
    `/api/drone-recording-runway/segment-file/${encodeURIComponent(jobId)}/${slot}/?t=${bust}`,
  );
}

export function referenceFileUrl(jobId: string, slot: number, cacheBust?: number): string {
  const bust = cacheBust ?? Date.now();
  return absoluteDroneApiUrl(
    `/api/drone-recording-runway/reference-file/${encodeURIComponent(jobId)}/${slot}/?t=${bust}`,
  );
}

export function resolveSceneReferenceThumbUrl(
  jobId: string,
  slot: number,
  segment?: Pick<RunwaySegmentItem, "ref_url" | "preflight_url"> | null,
  cacheBust?: number,
): string {
  const refRelative = String(segment?.ref_url || segment?.preflight_url || "").trim();
  if (refRelative) return segmentVideoAbsoluteUrl(refRelative);
  return referenceFileUrl(jobId, slot, cacheBust);
}

export async function fetchRunwaySegments(jobId: string): Promise<
  { ok: true; data: RunwaySegmentsResponse } | { ok: false; error: string }
> {
  const id = String(jobId || "").trim();
  if (!id) return { ok: false, error: "Job ID gerekli." };
  const res = await authJsonFetch<RunwaySegmentsResponse>(
    `/api/drone-recording-runway/segments/?job_id=${encodeURIComponent(id)}`,
    { method: "GET" },
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Sahneler yüklenemedi.") };
  }
  const data = res.data as RunwaySegmentsResponse;
  return {
    ok: true,
    data: {
      ...data,
      segments: Array.isArray(data.segments) ? data.segments : [],
      timeline: Array.isArray(data.timeline) ? data.timeline : [],
      scene_rights: normalizeSceneRights(data.scene_rights),
    },
  };
}

export async function getSceneRights(jobId: string): Promise<SceneGenerationRights> {
  const id = String(jobId || "").trim();
  if (!id) return defaultSceneRights();
  const res = await authJsonFetch<{ scene_rights?: SceneGenerationRights; success?: boolean }>(
    `/api/drone-recording-runway/scene-rights/?job_id=${encodeURIComponent(id)}`,
    { method: "GET" },
  );
  if (!res.ok || !res.data?.scene_rights) return defaultSceneRights();
  return normalizeSceneRights(res.data.scene_rights);
}

export async function updateSegmentTimeline(
  jobId: string,
  timeline: RunwaySegmentTimelineEntry[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-recording-runway/segments/timeline/", {
    method: "PATCH",
    json: { job_id: jobId, timeline },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Sahne sırası kaydedilemedi.") };
  }
  return { ok: true };
}

export async function finalizeSegmentTimeline(
  jobId: string,
  mergeTimeline?: RunwaySegmentTimelineEntry[],
): Promise<{ ok: true; pollMs: number } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("job_id", jobId);
  if (mergeTimeline?.length) {
    form.append("merge_timeline", JSON.stringify(mergeTimeline));
  }
  const res = await authFormFetch<{ success?: boolean; poll_ms?: number }>(
    "/api/drone-recording-runway/segments/finalize/",
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Sahneler birleştirilemedi.") };
  }
  return { ok: true, pollMs: Number((res.data as any)?.poll_ms || 1500) };
}

/** Sahne strip — timeline entry sil; gerekirse önce meta bootstrap. */
export async function deleteRunwaySceneEntry(
  jobId: string,
  entryId: string,
  segments: RunwaySegmentItem[],
  timeline: RunwaySegmentTimelineEntry[],
): Promise<{ ok: true; deletedSlot: number } | { ok: false; error: string }> {
  const canonical = buildCanonicalTimeline(segments, timeline);
  const trimmedId = String(entryId || "").trim();
  let target =
    canonical.find((entry) => entry.id === trimmedId) ||
    canonical.find((entry) => trimmedId && entry.id === `slot-${trimmedId}`) ||
    null;

  if (!target && trimmedId.startsWith("slot-")) {
    const slotFromId = Number(trimmedId.replace(/^slot-/, ""));
    if (slotFromId > 0) {
      target = canonical.find((entry) => entry.slot === slotFromId) || null;
    }
  }

  if (!target) {
    return { ok: false, error: "Silinecek sahne bulunamadı." };
  }

  const next = canonical.filter((entry) => entry.id !== target!.id);
  if (next.length < 1) {
    return { ok: false, error: "En az bir sahne kalmalı." };
  }

  if (!timelineCoversSegments(segments, timeline)) {
    const bootstrap = await updateSegmentTimeline(jobId, canonical);
    if (!bootstrap.ok) return bootstrap;
  }

  const res = await updateSegmentTimeline(jobId, next);
  if (!res.ok) return res;
  return { ok: true, deletedSlot: target.slot };
}

/** @deprecated deleteRunwaySceneEntry kullanın */
export async function deleteRunwaySceneSlot(
  jobId: string,
  slot: number,
  timeline: RunwaySegmentTimelineEntry[],
  segments: RunwaySegmentItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const entryId =
    timeline.find((entry) => Number(entry.slot) === slot)?.id || `slot-${slot}`;
  const res = await deleteRunwaySceneEntry(jobId, entryId, segments, timeline);
  if (!res.ok) return res;
  return { ok: true };
}

export async function deleteRunwayReferenceSlots(
  jobId: string,
  slots: number[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success?: boolean }>("/api/drone-recording-runway/refs/delete/", {
    method: "POST",
    json: { job_id: jobId, slots },
  });
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Sahne silinemedi.") };
  }
  return { ok: true };
}

export async function regenerateRunwaySegment(payload: {
  jobId: string;
  slot: number;
  image?: MobileUploadImage | null;
  promptText?: string;
  usePreflight?: boolean;
  append?: boolean;
  clientSource?: string;
}): Promise<{ ok: true; pollMs: number } | { ok: false; error: string; licenseRequired?: boolean }> {
  const form = new FormData();
  form.append("job_id", payload.jobId);
  form.append("slot", String(payload.slot));
  if (payload.promptText?.trim()) {
    form.append("prompt_text", payload.promptText.trim().slice(0, 2000));
  }
  if (payload.usePreflight) form.append("use_preflight", "1");
  if (payload.append) form.append("append", "1");
  if (payload.image?.uri) {
    form.append("image", {
      uri: payload.image.uri,
      name: payload.image.name || `reference_${payload.slot}.jpg`,
      type: payload.image.type || "image/jpeg",
    } as any);
  }
  const source = String(payload.clientSource || MOBILE_DRONE_RUNWAY_CLIENT_SOURCE).trim();
  appendOpenAiPreflightFormFields(form, Boolean(payload.usePreflight), source);
  form.append("source", source);
  const res = await authFormFetch<{ success?: boolean; poll_ms?: number; error?: string }>(
    "/api/drone-recording-runway/segments/regenerate/",
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    const err = errMessage(res.error || (res.data as any)?.error, "Sahne üretilemedi.");
    return {
      ok: false,
      error: err,
      licenseRequired: err === "sahne_hakki_yok" || err === "lisans_yok",
    };
  }
  return { ok: true, pollMs: Number((res.data as any)?.poll_ms || 1500) };
}

export function computeNextAppendSlot(data: RunwaySegmentsResponse): number {
  const segmentMax = data.segments.reduce((max, item) => Math.max(max, Number(item.slot) || 0), 0);
  const totalFrames = Math.max(2, Number(data.total_frames) || 0, segmentMax);
  return totalFrames + 1;
}

export async function preflightRunwaySegment(payload: {
  jobId: string;
  slot: number;
  image?: MobileUploadImage | null;
  promptText?: string;
  append?: boolean;
  clientSource?: string;
}): Promise<{ ok: true; pollMs: number } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("job_id", payload.jobId);
  form.append("slot", String(payload.slot));
  if (payload.append) form.append("append", "1");
  if (payload.promptText?.trim()) {
    form.append("prompt_text", payload.promptText.trim().slice(0, 2000));
  }
  if (payload.image?.uri) {
    form.append("image", {
      uri: payload.image.uri,
      name: payload.image.name || `segment_${payload.slot}.jpg`,
      type: payload.image.type || "image/jpeg",
    } as any);
  }
  const source = String(payload.clientSource || MOBILE_DRONE_RUNWAY_CLIENT_SOURCE).trim();
  form.append("source", source);
  const res = await authFormFetch<{ success?: boolean; poll_ms?: number }>(
    "/api/drone-recording-runway/segments/preflight/",
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Resim canlandırılamadı.") };
  }
  return { ok: true, pollMs: Number((res.data as any)?.poll_ms || 10000) };
}

export function buildSceneTimelineFromSlots(
  slots: number[],
  enabledSlots: Set<number>,
): RunwaySegmentTimelineEntry[] {
  return slots.map((slot, index) => ({
    id: `slot-${slot}`,
    slot,
    label: String(index + 1),
    enabled: enabledSlots.has(slot),
  }));
}

export function freeSceneRemaining(rights: SceneGenerationRights): number {
  const included = Math.max(0, Number(rights.included) || 0);
  const used = Math.max(0, Number(rights.used) || 0);
  return Math.max(0, included - used);
}

export function maxCaptureCountForRights(rights: SceneGenerationRights): number {
  const remaining = Math.max(0, Number(rights.remaining) || 0);
  if (remaining <= 0) return 0;
  return Math.min(DRONE_SCENE_MAX_CAPTURE_PER_PURCHASE, remaining);
}

/** Tek oturumda eklenebilecek sahne: hak tavanı + strip boş slot */
export function maxAppendCountForSession(
  rights: SceneGenerationRights,
  existingSceneCount: number,
): number {
  const byRights = maxCaptureCountForRights(rights);
  const stripSlots = Math.max(
    0,
    DRONE_SCENE_PACKAGE_ALLOWANCE - Math.max(0, Number(existingSceneCount) || 0),
  );
  return Math.min(byRights, stripSlots);
}

export function countExistingScenes(segments: RunwaySegmentItem[]): number {
  return segments.filter((s) => s.exists && s.slot > 0).length;
}

/** Devam öncesi: ek sahne için yeterli hak var mı? */
export function needsExtraScenePurchaseForAppend(
  rights: SceneGenerationRights,
  scenesToAdd: number,
): boolean {
  const remaining = Math.max(0, Number(rights.remaining) || 0);
  const count = Math.max(1, Number(scenesToAdd) || 1);
  return remaining < count;
}

export function resolveEkSahneActionForCount(
  count: number,
): typeof DRONE_EK_SAHNE_ACTION | typeof DRONE_EK_SAHNE_2_ACTION {
  return count >= 2 ? DRONE_EK_SAHNE_2_ACTION : DRONE_EK_SAHNE_ACTION;
}

export { MOBILE_AI_VIDEO_NEW_CLIENT_SOURCE, MOBILE_DRONE_RUNWAY_CLIENT_SOURCE };
