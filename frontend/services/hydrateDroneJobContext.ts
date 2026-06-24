import type { DroneMyVideoItem } from "./droneRunwayStatusParser";
import {
  enrichDroneNarrationInputs,
  findUserCardAnnotation,
  listDroneEditorAnnotations,
  musicFromJobMeta,
  musicVolumeFromJobMeta,
  normalizeUserCardInfo,
  narrationInputsNeedGeographyRefresh,
  hideProparcelBrandFromMeta,
  type DroneNarrationInputs,
  type DroneParcelQuery,
  type MusicTrack,
  type UserCardInfo,
} from "./aiDroneSimpleEditorService";
import { DEFAULT_PORTRAIT_USER_CARD_POS } from "../src/constants/aiDroneEditorTheme";
import {
  DEFAULT_USER_CARD_SCALE,
  userCardExportPointToUiCenter,
} from "../src/utils/portraitOverlayContract";

export type ParsedReferenceId = {
  mahalle: string;
  ada: string;
  parsel: string;
};

export function parseReferenceId(referenceId: string): ParsedReferenceId {
  const parts = String(referenceId || "").trim().split("_");
  return {
    mahalle: String(parts[0] || "").trim(),
    ada: String(parts[1] || "").trim(),
    parsel: String(parts.slice(2).join("_") || "").trim(),
  };
}

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

export function buildParcelSummaryFromContext(
  meta: Record<string, unknown>,
  referenceId: string,
): string {
  const ref = parseReferenceId(referenceId);
  const mahalle = String(meta.mahalle || meta.runway_quarter || meta.quarter || ref.mahalle || "").trim();
  const ada = String(meta.ada || ref.ada || "").trim();
  const parsel = String(meta.parsel || ref.parsel || "").trim();
  const city = String(meta.city || meta.runway_city || "").trim();
  const district = String(meta.district || meta.runway_district || "").trim();
  const area = String(meta.parcel_area_label_tr || "").trim();

  const parts: string[] = [];
  if (city) parts.push(city);
  if (district) parts.push(district);
  if (mahalle) parts.push(mahalle);
  if (ada && parsel) parts.push(`${ada}/${parsel}`);
  if (area) parts.push(area);
  return parts.join(" · ");
}

export function buildParcelFromArchive(
  meta: Record<string, unknown>,
  referenceId: string,
): DroneParcelQuery | null {
  const ref = parseReferenceId(referenceId);
  const mahalleCode = Number(meta.mahalle || ref.mahalle);
  const ada = String(meta.ada || ref.ada || "").trim();
  const parsel = String(meta.parsel || ref.parsel || "").trim();
  if (!ada && !parsel && !mahalleCode) return null;

  return {
    mahalleTkgmValue: Number.isFinite(mahalleCode) ? mahalleCode : 0,
    mahalle: String(meta.runway_quarter || meta.quarter || ref.mahalle || "").trim(),
    ada: ada || "0",
    parsel: parsel || "",
    city: String(meta.city || meta.runway_city || "").trim(),
    town: String(meta.district || meta.runway_district || "").trim(),
  };
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildNarrationInputsFromMeta(
  meta: Record<string, unknown>,
  referenceId: string,
): DroneNarrationInputs | null {
  const ref = parseReferenceId(referenceId);
  const city = String(meta.city || meta.runway_city || "").trim();
  const district = String(meta.district || meta.runway_district || "").trim();
  const quarter = String(
    meta.quarter || meta.runway_quarter || meta.mahalle || ref.mahalle || "",
  ).trim();
  const parcelAreaM2 = String(meta.parcel_area_label_tr || meta.parcel_area_m2 || "").trim();
  const population = numOrNull(meta.population);
  const cityCenterKm = numOrNull(meta.city_center_dist_km ?? meta.cityCenterKm);
  const townCenterKm = numOrNull(meta.town_center_dist_km ?? meta.townCenterKm);

  if (
    !city &&
    !district &&
    !quarter &&
    !parcelAreaM2 &&
    population == null &&
    cityCenterKm == null &&
    townCenterKm == null
  ) {
    return null;
  }

  return {
    city,
    district,
    quarter,
    parcelAreaM2,
    population,
    cityCenterKm,
    townCenterKm,
  };
}

export type HydratedJobContext = {
  narrationText: string;
  narrationInputs: DroneNarrationInputs | null;
  parcel: DroneParcelQuery | null;
  parcelSummary: string;
  parcelAreaM2: string;
  savedMusic: MusicTrack | null;
  musicVolume: number;
  showUserCard: boolean;
  hideProParcelBrand: boolean;
  userCardInfo: UserCardInfo | null;
  userCardAnnotationId: number | string | null;
  userCardPos: { x: number; y: number };
};

export async function loadJobEditorContext(
  jobId: string,
  archiveItem?: DroneMyVideoItem | null,
): Promise<HydratedJobContext> {
  const meta = (archiveItem?.meta || {}) as Record<string, unknown>;
  const referenceId = String(
    archiveItem?.reference_id || meta.reference_id || "",
  ).trim();

  const annRes = await listDroneEditorAnnotations(jobId, "portrait");
  const annData = annRes.ok ? annRes.data : { annotations: [] };

  const narrationText = pickNarrationText(annData);
  const parcel = buildParcelFromArchive(meta, referenceId);
  const parcelSummary = buildParcelSummaryFromContext(meta, referenceId);
  const parcelAreaM2 = String(meta.parcel_area_label_tr || meta.parcel_area_m2 || "").trim();
  let narrationInputs = buildNarrationInputsFromMeta(meta, referenceId);
  if (parcel && narrationInputsNeedGeographyRefresh(narrationInputs)) {
    narrationInputs = await enrichDroneNarrationInputs(parcel, null, parcelAreaM2, narrationInputs);
  }
  const savedMusic = musicFromJobMeta(meta);
  const musicVolume = musicVolumeFromJobMeta(meta);

  const userCardAnn = findUserCardAnnotation(annData.annotations);
  const userCardInfo = userCardAnn
    ? normalizeUserCardInfo(userCardAnn.config_json?.userInfo as Record<string, unknown>)
    : null;
  const point = userCardAnn?.config_json?.point;
  const cardScale = Number(userCardAnn?.config_json?.userCardScale) || DEFAULT_USER_CARD_SCALE;
  const userCardPos =
    point && typeof point.x === "number" && typeof point.y === "number"
      ? userCardExportPointToUiCenter({ x: point.x, y: point.y }, cardScale)
      : DEFAULT_PORTRAIT_USER_CARD_POS;

  return {
    narrationText,
    narrationInputs,
    parcel,
    parcelSummary,
    parcelAreaM2,
    savedMusic,
    musicVolume,
    showUserCard: Boolean(userCardAnn),
    hideProParcelBrand: hideProparcelBrandFromMeta(meta),
    userCardInfo,
    userCardAnnotationId: userCardAnn?.id ?? null,
    userCardPos,
  };
}
