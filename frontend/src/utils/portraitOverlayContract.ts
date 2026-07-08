/**
 * Mobil portrait önizleme ↔ backend export (`drone_annotation_export.py`) uyumu.
 * Web editör stage: 540×960; export video: 720×1280; visual scale: 1.3.
 */

export const PORTRAIT_PREVIEW_REF_WIDTH = 351;
export const PORTRAIT_STAGE_WIDTH = 540;
export const PORTRAIT_STAGE_HEIGHT = 960;
export const PORTRAIT_OUTPUT_WIDTH = 720;
export const PORTRAIT_OUTPUT_HEIGHT = 1280;
export const PORTRAIT_VISUAL_SCALE = 1.3;
export const DEFAULT_USER_CARD_SCALE = 1.05;
export const PORTRAIT_SUBTITLE_EXPORT_FACTOR = 0.88;
/** Web portrait stage (~960px) ile aynı okunurluk hedefi; mobil önizleme frame’inde ~22px. */
export const PORTRAIT_PREVIEW_SUBTITLE_FONT_PX = 22;

export const PORTRAIT_PREVIEW_REF_HEIGHT = PORTRAIT_PREVIEW_REF_WIDTH * (16 / 9);

/** Web UserInfoCard tasarım ofsetleri (stage px, scale öncesi). */
export const USER_CARD_AVATAR_OFFSET_X = 45;
export const USER_CARD_AVATAR_OFFSET_Y = 46;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function userCardVisualScale(cardScale = DEFAULT_USER_CARD_SCALE): number {
  const s = Number(cardScale);
  const safe = Number.isFinite(s) ? Math.max(0.55, Math.min(1.8, s)) : DEFAULT_USER_CARD_SCALE;
  return safe * PORTRAIT_VISUAL_SCALE;
}

/** UI avatar merkezi → API top-left (web editör point). */
export function userCardUiCenterToExportPoint(
  center: { x: number; y: number },
  cardScale = DEFAULT_USER_CARD_SCALE,
): { x: number; y: number } {
  const vs = userCardVisualScale(cardScale);
  const dx = (USER_CARD_AVATAR_OFFSET_X * vs) / PORTRAIT_STAGE_WIDTH;
  const dy = (USER_CARD_AVATAR_OFFSET_Y * vs) / PORTRAIT_STAGE_HEIGHT;
  return {
    x: clamp01(center.x - dx),
    y: clamp01(center.y - dy),
  };
}

/** API top-left → UI avatar merkezi. */
export function userCardExportPointToUiCenter(
  point: { x: number; y: number },
  cardScale = DEFAULT_USER_CARD_SCALE,
): { x: number; y: number } {
  const vs = userCardVisualScale(cardScale);
  const dx = (USER_CARD_AVATAR_OFFSET_X * vs) / PORTRAIT_STAGE_WIDTH;
  const dy = (USER_CARD_AVATAR_OFFSET_Y * vs) / PORTRAIT_STAGE_HEIGHT;
  const fromTopLeft = {
    x: clamp01(point.x + dx),
    y: clamp01(point.y + dy),
  };
  // Eski mobil sürüm avatar merkezini doğrudan point olarak kaydetti.
  if (point.x <= 0.22 && fromTopLeft.x > 0.26) {
    return { x: clamp01(point.x), y: clamp01(point.y) };
  }
  return fromTopLeft;
}

/** Önizleme frame genişliğinde kullanıcı kartı ölçeği (export ile aynı görsel boyut). */
export function portraitUserCardPreviewScale(
  frameWidth: number,
  cardScale = DEFAULT_USER_CARD_SCALE,
): number {
  const fw = Math.max(1, Number(frameWidth) || PORTRAIT_PREVIEW_REF_WIDTH);
  return userCardVisualScale(cardScale) * (fw / PORTRAIT_STAGE_WIDTH);
}

/** Export fontSize → önizleme Text fontSize. */
export function portraitSubtitlePreviewFontSize(
  exportFontSize: number,
  frameHeight: number,
): number {
  const fh = Math.max(1, Number(frameHeight) || PORTRAIT_PREVIEW_REF_HEIGHT);
  const base = Number(exportFontSize);
  const safe = Number.isFinite(base) ? base : 22;
  const px = safe * PORTRAIT_SUBTITLE_EXPORT_FACTOR * (fh / PORTRAIT_OUTPUT_HEIGHT);
  return Math.max(10, Math.round(px));
}

/** Önizleme hedef px → export fontSize (backend subtitle_settings). */
export function portraitSubtitleExportFontSize(
  previewFontPx: number,
  frameHeight: number,
): number {
  const fh = Math.max(1, Number(frameHeight) || PORTRAIT_PREVIEW_REF_HEIGHT);
  const target = Number(previewFontPx);
  const safeTarget = Number.isFinite(target) ? target : PORTRAIT_PREVIEW_SUBTITLE_FONT_PX;
  const raw = safeTarget * PORTRAIT_OUTPUT_HEIGHT / (PORTRAIT_SUBTITLE_EXPORT_FACTOR * fh);
  return Math.round(Math.max(12, Math.min(56, raw)));
}

export const DEFAULT_PORTRAIT_SUBTITLE_EXPORT_FONT_SIZE = 30;

export function defaultPortraitSubtitleExportFontSize(): number {
  return DEFAULT_PORTRAIT_SUBTITLE_EXPORT_FONT_SIZE;
}

/** Eski web (22), önceki mobil (34) ve eski hesaplanmış default (51) kayıtlarını yükseltir. */
export function normalizePortraitSubtitleExportFontSize(fontSize: unknown): number {
  const n = Number(fontSize);
  if (!Number.isFinite(n)) return defaultPortraitSubtitleExportFontSize();
  const rounded = Math.round(n);
  if (rounded === 22 || rounded === 34 || rounded === 35 || rounded === 51) {
    return defaultPortraitSubtitleExportFontSize();
  }
  return Math.max(12, Math.min(56, rounded));
}
