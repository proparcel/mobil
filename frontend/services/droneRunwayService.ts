import { userFacingPipelineDetail } from "../src/constants/aiDroneProductionPipeline";
import {
  formatDroneProjectListLabel,
  resolveDroneProjectDisplayName,
  resolveProjectId,
} from "../src/utils/droneProjectContract";
import { authJsonFetch } from "./apiClient";
import {
  classifyRunwayStatus,
  type DroneMyVideoItem,
  type RunwayProgressPayload,
  type RunwaySlotProgressMap,
  type RunwayStatusResponse,
  runwayProgressLabel,
} from "./droneRunwayStatusParser";

/** Foreground bekleme — sonrası arka plan takip (hata değil). */
export const DRONE_RUNWAY_SOFT_UI_WAIT_MS = 3 * 60 * 1000;
/** Web ile uyumlu üst poll süresi — hâlâ running ise arka plana düş. */
export const DRONE_RUNWAY_MAX_POLL_MS = 3 * 60 * 60 * 1000;
/** 24 saat sonra hâlâ processing — failed sayılmaz. */
export const DRONE_RUNWAY_STALE_MS = 24 * 60 * 60 * 1000;

export type {
  DroneMyVideoItem,
  RunwayJobState,
  RunwayProgressPayload,
  RunwayStatusClassification,
  RunwayStatusResponse,
} from "./droneRunwayStatusParser";

export {
  classifyRunwayStatus,
  isMyVideoFailed,
  isMyVideoProcessing,
  isMyVideoReady,
  runwayProgressLabel,
} from "./droneRunwayStatusParser";

export {
  formatDroneProjectListLabel,
  resolveDroneProjectDisplayName,
  resolveProjectId,
} from "../src/utils/droneProjectContract";

export type RunwaySlotProgressMap = Record<string, RunwayProgressPayload>;

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

function normalizePollInterval(pollMs: number): number {
  return Math.max(600, Math.min(5000, pollMs || 1500));
}

function parseStatusResponse(data: Record<string, unknown>): RunwayStatusResponse {
  return {
    state: String(data.state || ""),
    ready: Boolean(data.ready),
    success: typeof data.success === "boolean" ? data.success : undefined,
    progress: data.progress as RunwayProgressPayload | undefined,
    error: typeof data.error === "string" ? data.error : undefined,
    segment_slot_progress: data.segment_slot_progress as RunwaySlotProgressMap | undefined,
    archive: data.archive as RunwayStatusResponse["archive"],
  };
}

export async function fetchRunwayJobStatus(
  jobId: string,
): Promise<{ ok: true; status: RunwayStatusResponse } | { ok: false; error: string; status?: number }> {
  const id = String(jobId || "").trim();
  if (!id) return { ok: false, error: "İş kimliği eksik." };
  const res = await authJsonFetch<Record<string, unknown>>(
    `/api/drone-recording-runway/status/?job_id=${encodeURIComponent(id)}`,
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Durum alınamadı."), status: res.status };
  return { ok: true, status: parseStatusResponse((res.data || {}) as Record<string, unknown>) };
}

export async function listDroneMyVideos(): Promise<
  { ok: true; videos: DroneMyVideoItem[] } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ success?: boolean; videos?: DroneMyVideoItem[] }>(
    "/api/drone-recording-runway/my-videos/",
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Videolar alınamadı.") };
  const data = res.data as { success?: boolean; videos?: DroneMyVideoItem[]; error?: string };
  if (data?.success === false) {
    return { ok: false, error: errMessage(data.error, "Videolar alınamadı.") };
  }
  const videos = Array.isArray(data?.videos) ? data.videos : [];
  return { ok: true, videos };
}

export type PollRunwayUntilDoneOptions = {
  jobId: string;
  pollMs?: number;
  onPoll?: (status: RunwayStatusResponse) => void;
  onSoftUiTimeout?: () => void;
  softUiWaitMs?: number;
  maxWaitMs?: number;
  signal?: { aborted?: boolean };
  /** refresh-audio: mevcut `done` durumunu atla, yeni işi bekle */
  ignoreInitialDone?: boolean;
};

export type PollRunwayUntilDoneResult =
  | { ok: true; status: RunwayStatusResponse }
  | { ok: false; error: string }
  | { ok: false; background: true; status?: RunwayStatusResponse };

/**
 * Runway job poll — asla "zaman aşımı" hatası üretmez; running job arka plana düşer.
 */
export async function pollRunwayUntilDone(
  options: PollRunwayUntilDoneOptions,
): Promise<PollRunwayUntilDoneResult> {
  const jobId = String(options.jobId || "").trim();
  if (!jobId) return { ok: false, error: "İş kimliği eksik." };

  const interval = normalizePollInterval(options.pollMs ?? 1500);
  const softWait = Math.max(60_000, options.softUiWaitMs ?? DRONE_RUNWAY_SOFT_UI_WAIT_MS);
  const maxWait = Math.max(softWait, options.maxWaitMs ?? DRONE_RUNWAY_MAX_POLL_MS);
  const startedAt = Date.now();
  let softUiNotified = false;
  let lastStatus: RunwayStatusResponse | undefined;
  let staleDoneSkips = 0;
  const maxStaleDoneSkips = options.ignoreInitialDone ? 4 : 0;
  let consecutivePollErrors = 0;
  const maxConsecutivePollErrors = 12;

  while (true) {
    if (options.signal?.aborted) {
      return { ok: false, background: true, status: lastStatus };
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed >= maxWait) {
      return { ok: false, background: true, status: lastStatus };
    }

    if (!softUiNotified && elapsed >= softWait) {
      softUiNotified = true;
      options.onSoftUiTimeout?.();
    }

    await new Promise((r) => setTimeout(r, interval));
    if (options.signal?.aborted) {
      return { ok: false, background: true, status: lastStatus };
    }

    const polled = await fetchRunwayJobStatus(jobId);
    if (!polled.ok) {
      consecutivePollErrors += 1;
      const httpStatus = polled.status;
      if (httpStatus === 401 || httpStatus === 403 || httpStatus === 404) {
        return { ok: false, error: polled.error };
      }
      if (consecutivePollErrors >= maxConsecutivePollErrors) {
        return { ok: false, error: polled.error || "Video durumu alınamadı." };
      }
      continue;
    }

    consecutivePollErrors = 0;
    lastStatus = polled.status;
    options.onPoll?.(polled.status);

    const { isReady, isFailed } = classifyRunwayStatus(polled.status);
    if (isFailed) {
      return {
        ok: false,
        error: userFacingPipelineDetail(
          polled.status.error || polled.status.progress?.label,
          "Video üretilemedi.",
        ),
      };
    }
    if (isReady) {
      const progressStep = String(polled.status.progress?.step || "").trim().toLowerCase();
      if (
        options.ignoreInitialDone &&
        progressStep === "done" &&
        staleDoneSkips < maxStaleDoneSkips
      ) {
        staleDoneSkips += 1;
        continue;
      }
      return { ok: true, status: polled.status };
    }
  }
}
