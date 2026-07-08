/**
 * Mobil landscape önizleme ↔ backend export (`drone_annotation_export.py`) uyumu.
 * Web editör stage: 960×540; export video: 1280×768.
 */

export const LANDSCAPE_PREVIEW_REF_WIDTH = 351;
export const LANDSCAPE_STAGE_WIDTH = 960;
export const LANDSCAPE_STAGE_HEIGHT = 540;
export const LANDSCAPE_OUTPUT_WIDTH = 1280;
export const LANDSCAPE_OUTPUT_HEIGHT = 768;
export const LANDSCAPE_VISUAL_SCALE = 1.3;
export const LANDSCAPE_SUBTITLE_EXPORT_FACTOR = 0.88;
export const LANDSCAPE_PREVIEW_SUBTITLE_FONT_PX = 20;

export const LANDSCAPE_PREVIEW_REF_HEIGHT = LANDSCAPE_PREVIEW_REF_WIDTH * (9 / 16);

/** Export fontSize → önizleme Text fontSize. */
export function landscapeSubtitlePreviewFontSize(
  exportFontSize: number,
  frameHeight: number,
): number {
  const fh = Math.max(1, Number(frameHeight) || LANDSCAPE_PREVIEW_REF_HEIGHT);
  const base = Number(exportFontSize);
  const safe = Number.isFinite(base) ? base : 22;
  const px = safe * LANDSCAPE_SUBTITLE_EXPORT_FACTOR * (fh / LANDSCAPE_OUTPUT_HEIGHT);
  return Math.max(10, Math.round(px));
}

/** Önizleme hedef px → export fontSize (backend subtitle_settings). */
export function landscapeSubtitleExportFontSize(
  previewFontPx: number,
  frameHeight: number,
): number {
  const fh = Math.max(1, Number(frameHeight) || LANDSCAPE_PREVIEW_REF_HEIGHT);
  const target = Number(previewFontPx);
  const safeTarget = Number.isFinite(target) ? target : LANDSCAPE_PREVIEW_SUBTITLE_FONT_PX;
  const raw = safeTarget * LANDSCAPE_OUTPUT_HEIGHT / (LANDSCAPE_SUBTITLE_EXPORT_FACTOR * fh);
  return Math.round(Math.max(12, Math.min(56, raw)));
}

export const DEFAULT_LANDSCAPE_SUBTITLE_EXPORT_FONT_SIZE = 28;

export function defaultLandscapeSubtitleExportFontSize(): number {
  return DEFAULT_LANDSCAPE_SUBTITLE_EXPORT_FONT_SIZE;
}

export function normalizeLandscapeSubtitleExportFontSize(fontSize: unknown): number {
  const n = Number(fontSize);
  if (!Number.isFinite(n)) return defaultLandscapeSubtitleExportFontSize();
  const rounded = Math.round(n);
  if (rounded === 22 || rounded === 34 || rounded === 51) {
    return defaultLandscapeSubtitleExportFontSize();
  }
  return Math.max(12, Math.min(56, rounded));
}
