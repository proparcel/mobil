import type { DroneMyVideoItem } from "./droneRunwayStatusParser";
import {
  hideProparcelBrandFromMeta,
  listDroneEditorAnnotations,
  musicFromJobMeta,
  musicVolumeFromJobMeta,
  type MusicTrack,
} from "./aiVideoNewEditorService";
import { resolveDroneProjectDisplayName } from "../src/utils/droneProjectContract";

function pickNarrationText(data: {
  narration_editor_text?: string;
  narration_draft_text?: string;
  narration_last_saved_text?: string;
  narration_text?: string;
  runway_full_subtitle?: string;
}): string {
  return String(
    data.narration_editor_text ||
      data.narration_draft_text ||
      data.narration_last_saved_text ||
      data.narration_text ||
      data.runway_full_subtitle ||
      "",
  ).trim();
}

export type HydratedAiVideoJobContext = {
  projectTitle: string;
  licenseRef: string;
  narrationText: string;
  savedMusic: MusicTrack | null;
  musicVolume: number;
  hideProParcelBrand: boolean;
};

export async function loadAiVideoJobEditorContext(
  jobId: string,
  archiveItem?: DroneMyVideoItem | null,
): Promise<HydratedAiVideoJobContext> {
  const meta = (archiveItem?.meta || {}) as Record<string, unknown>;
  const annRes = await listDroneEditorAnnotations(jobId);
  const annData = annRes.ok ? annRes.data : { annotations: [] };

  const projectTitle = resolveDroneProjectDisplayName(archiveItem);
  const licenseRef = String(meta.license_ref || "").trim();
  const narrationText = pickNarrationText(annData);
  const savedMusic = musicFromJobMeta(meta);
  const musicVolume = musicVolumeFromJobMeta(meta);

  return {
    projectTitle,
    licenseRef,
    narrationText,
    savedMusic,
    musicVolume,
    hideProParcelBrand: hideProparcelBrandFromMeta(meta),
  };
}
