import { userFacingRunwayProgressMessage } from "../src/constants/aiDroneProductionPipeline";

export type RunwayJobState = "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | string;

export type RunwayProgressPayload = {
  step?: string;
  label?: string;
  detail?: string;
  progress_percent?: number;
  segment_slot?: number;
  segment_total?: number;
};

export type RunwayStatusResponse = {
  state: RunwayJobState;
  ready: boolean;
  success?: boolean;
  progress?: RunwayProgressPayload;
  error?: string;
  segment_slot_progress?: Record<string, RunwayProgressPayload>;
  archive?: {
    job_id?: string;
    status?: string;
    label?: string;
    reference_id?: string;
    meta?: { progress?: RunwayProgressPayload };
  };
};

export type RunwayStatusClassification = {
  isReady: boolean;
  isFailed: boolean;
  isRunning: boolean;
};

export type DroneMyVideoMeta = {
  progress?: RunwayProgressPayload;
  job_error?: string;
  reference_id?: string;
  narration_text?: string;
  narration_last_saved_text?: string;
  narration_draft_text?: string;
  narration_editor_text?: string;
  runway_full_subtitle?: string;
  music?: Record<string, unknown>;
  city?: string;
  district?: string;
  quarter?: string;
  runway_city?: string;
  runway_district?: string;
  runway_quarter?: string;
  mahalle?: string;
  ada?: string;
  parsel?: string;
  parcel_area_label_tr?: string;
  parcel_area_m2?: string;
  population?: number;
  city_center_dist_km?: number;
  town_center_dist_km?: number;
};

export type DroneMyVideoItem = {
  job_id: string;
  status: string;
  label?: string;
  reference_id?: string;
  created_at?: string;
  updated_at?: string;
  meta?: DroneMyVideoMeta;
  is_license_placeholder?: boolean;
};

export function classifyRunwayStatus(raw: Partial<RunwayStatusResponse> | null | undefined): RunwayStatusClassification {
  const state = String(raw?.state || "").trim().toUpperCase();
  const step = String(raw?.progress?.step || "").trim().toLowerCase();
  const readyFlag = Boolean(raw?.ready);
  const successFlag = raw?.success;

  const isFailed =
    state === "FAILURE" ||
    step === "failed" ||
    (readyFlag && successFlag === false) ||
    Boolean(String(raw?.error || "").trim());

  const isReady =
    !isFailed &&
    (readyFlag && (state === "SUCCESS" || successFlag === true || step === "done" || step === "ready"));

  const isRunning = !isReady && !isFailed;
  return { isReady, isFailed, isRunning };
}

export function runwayProgressLabel(raw: Partial<RunwayStatusResponse> | null | undefined): string {
  return userFacingRunwayProgressMessage(raw?.progress, "Video oluşturuluyor…");
}

export function isMyVideoProcessing(item: DroneMyVideoItem): boolean {
  const status = String(item.status || "").trim().toLowerCase();
  const step = String(item.meta?.progress?.step || "").trim().toLowerCase();
  if (item.is_license_placeholder) return false;
  if (status === "ready" || step === "done") return false;
  if (status === "failed" || step === "failed") return false;
  return (
    status === "processing" ||
    step === "queued" ||
    step === "refs" ||
    step === "collecting_refs" ||
    step === "openai_refs" ||
    step === "openai_ready" ||
    step === "runway" ||
    step === "merge" ||
    step === "voice" ||
    status === "pending" ||
    status === "started"
  );
}

export function isMyVideoReady(item: DroneMyVideoItem): boolean {
  const status = String(item.status || "").trim().toLowerCase();
  const step = String(item.meta?.progress?.step || "").trim().toLowerCase();
  return status === "ready" || step === "done";
}

export function isMyVideoFailed(item: DroneMyVideoItem): boolean {
  const status = String(item.status || "").trim().toLowerCase();
  const step = String(item.meta?.progress?.step || "").trim().toLowerCase();
  return status === "failed" || step === "failed" || Boolean(String(item.meta?.job_error || "").trim());
}
