import type { DroneMyVideoItem } from "../../services/droneRunwayStatusParser";

export type DroneVideoEditorMode = "ai_drone" | "ai_video" | "image_animation";

function metaOf(item: DroneMyVideoItem | null | undefined): Record<string, unknown> {
  const meta = item?.meta;
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
}

/** Web `DroneEditorApp.jsx` — `droneVideoEditorMode` ile uyumlu. */
export function droneVideoEditorMode(item: DroneMyVideoItem | null | undefined): DroneVideoEditorMode {
  const meta = metaOf(item);
  const explicit = String(meta.editor_mode || "").trim().toLowerCase();
  if (explicit === "ai_video") return "ai_video";
  if (explicit === "image_animation") return "image_animation";
  if (explicit === "ai_drone") return "ai_drone";

  const profile = String(meta.prompt_profile || "").trim().toLowerCase();
  if (profile === "ai_video") return "ai_video";
  if (profile === "image_animation") return "image_animation";

  const ref = String(item?.reference_id || meta.reference_id || "").trim().toLowerCase();
  if (ref.startsWith("ai_video_") || ref.startsWith("ai_video:") || ref.startsWith("license:ai_video:")) {
    return "ai_video";
  }
  if (ref.startsWith("ai_img") || ref.startsWith("license:ai_img:")) {
    return "image_animation";
  }

  const label = String(item?.label || "").trim().toLowerCase();
  if (label.includes("ai video")) return "ai_video";
  if (label.includes("resim canland")) return "image_animation";

  return "ai_drone";
}

export function droneVideoMatchesEditorMode(
  item: DroneMyVideoItem | null | undefined,
  editorMode: DroneVideoEditorMode,
): boolean {
  const mode = droneVideoEditorMode(item);
  if (editorMode === "ai_video") return mode === "ai_video";
  if (editorMode === "image_animation") return mode === "image_animation";
  return mode === "ai_drone";
}
