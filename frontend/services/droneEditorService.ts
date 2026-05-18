import { API_URL } from "../config/api";
import { authJsonFetch, type ApiResult } from "./apiClient";

export type DroneAnnotationType = "line" | "arrow" | "text_box" | "map_pin" | "price_label" | "area_label";

export type DroneAnnotation = {
  id: number;
  job_id: string;
  annotation_type: DroneAnnotationType;
  start_time: number;
  pause_duration: number;
  color: string;
  line_width: number;
  label: string;
  animation_in: "draw" | "fade";
  animation_out: "reverse" | "fade";
  config_json: {
    points?: Array<{ x: number; y: number }>;
    point?: { x: number; y: number };
    fontSize?: number;
    iconType?: string;
    label?: string;
  };
};

export type DroneVideoArchiveRow = {
  job_id: string;
  label?: string;
  reference_id?: string;
  status?: string;
  remaining_seconds?: number;
  created_at?: string;
};

function ok<T>(res: ApiResult<T>): T {
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function listDroneEditorVideos(): Promise<DroneVideoArchiveRow[]> {
  const data = ok(await authJsonFetch<{ videos?: DroneVideoArchiveRow[]; results?: DroneVideoArchiveRow[] }>(
    "/api/drone-recording-runway/my-videos/",
    { method: "GET" },
  ));
  return data.videos || data.results || [];
}

export async function listDroneAnnotations(jobId: string): Promise<DroneAnnotation[]> {
  const data = ok(await authJsonFetch<{ annotations?: DroneAnnotation[] }>(
    `/api/drone-editor/annotations/list/?job_id=${encodeURIComponent(jobId)}`,
    { method: "GET" },
  ));
  return data.annotations || [];
}

export async function createDroneAnnotation(payload: {
  job_id: string;
  annotation_type: DroneAnnotationType;
  start_time: number;
  pause_duration: number;
  color: string;
  line_width: number;
  label?: string;
  animation_in: "draw" | "fade";
  animation_out: "reverse" | "fade";
  config_json: DroneAnnotation["config_json"];
}): Promise<DroneAnnotation> {
  const data = ok(await authJsonFetch<{ annotation: DroneAnnotation }>("/api/drone-editor/annotations/create/", {
    method: "POST",
    json: payload,
  }));
  return data.annotation;
}

export async function updateDroneAnnotation(payload: Partial<DroneAnnotation> & { id: number }): Promise<DroneAnnotation> {
  const data = ok(await authJsonFetch<{ annotation: DroneAnnotation }>("/api/drone-editor/annotations/update/", {
    method: "PUT",
    json: payload,
  }));
  return data.annotation;
}

export async function deleteDroneAnnotation(id: number): Promise<void> {
  ok(await authJsonFetch("/api/drone-editor/annotations/delete/", { method: "DELETE", json: { id } }));
}

export async function startDroneAnnotationExport(jobId: string): Promise<string> {
  const data = ok(await authJsonFetch<{ status?: string }>("/api/drone-editor/export/", {
    method: "POST",
    json: { job_id: jobId },
  }));
  return data.status || "queued";
}

export async function getDroneAnnotationExportStatus(jobId: string): Promise<string> {
  const data = ok(await authJsonFetch<{ status?: string }>(
    `/api/drone-editor/export/status/?job_id=${encodeURIComponent(jobId)}`,
    { method: "GET" },
  ));
  return data.status || "idle";
}

export function droneVideoUrl(jobId: string): string {
  return `${API_URL}/api/drone-recording-runway/file/${encodeURIComponent(jobId)}/`;
}
