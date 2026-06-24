/** Web `ai-drone-video-editor.css` + `drone-editor.css` renkleri (mobil basit editör). */
import {
  defaultPortraitSubtitleExportFontSize,
  normalizePortraitSubtitleExportFontSize,
  PORTRAIT_PREVIEW_REF_WIDTH,
} from "../utils/portraitOverlayContract";

export const AI_DRONE_EDITOR_THEME = {
  shell: "#0b1220",
  toolbarBg: "#ffffff",
  toolbarBorder: "#e2e8f0",
  text: "#1e293b",
  textOnDark: "#e5eefc",
  muted: "#64748b",
  mutedOnDark: "#94a3b8",
  primary: "#1a5fb4",
  primaryBright: "#38bdf8",
  previewBg: "#020617",
  cardBg: "#ffffff",
  border: "#e2e8f0",
  tabBar: "rgba(15, 23, 42, 0.92)",
  tabActive: "#38bdf8",
  safeLine: "rgba(255, 255, 255, 0.86)",
  accentGreen: "#22c55e",
} as const;

export const PORTRAIT_SAFE_LINE_TOP_PCT = 11.4583;
/** Web `.pp-de-portrait-safe-line--bottom` (1920px referans, 30px yukarı). */
export const PORTRAIT_SAFE_LINE_BOTTOM_PCT = 85.9375;

/** Önizleme frame referansı (PortraitVideoFrame maxWidth). */
const PORTRAIT_PREVIEW_REF_HEIGHT = PORTRAIT_PREVIEW_REF_WIDTH * (16 / 9);
const PROPARCEL_BADGE_SIZE_SCALE = 0.6;
const PORTRAIT_USER_CARD_HEIGHT_PX = 76 * 1.05 * 1.3 * (PORTRAIT_PREVIEW_REF_WIDTH / 540);

function portraitProParcelBadgeBottomPx(): number {
  const safeTopPx = PORTRAIT_PREVIEW_REF_HEIGHT * (PORTRAIT_SAFE_LINE_TOP_PCT / 100);
  const pillY = safeTopPx + Math.max(10, PORTRAIT_PREVIEW_REF_HEIGHT * 0.022);
  const pillH = Math.max(22, Math.round(PORTRAIT_PREVIEW_REF_WIDTH * 0.105 * PROPARCEL_BADGE_SIZE_SCALE));
  return pillY + pillH;
}

/** ProParcel etiketi altı + küçük boşluk, alt yazı kutusu merkezi. */
export function defaultPortraitSubtitleY(): number {
  const badgeBottom = portraitProParcelBadgeBottomPx();
  const subtitleGapPx = 6;
  const subtitleHalfPx = 28;
  return (badgeBottom + subtitleGapPx + subtitleHalfPx) / PORTRAIT_PREVIEW_REF_HEIGHT;
}

/** Alt güvenli çizgi üstünde, kullanıcı kartı merkezi. */
export function defaultPortraitUserCardY(): number {
  const safeBottomPx = PORTRAIT_PREVIEW_REF_HEIGHT * (PORTRAIT_SAFE_LINE_BOTTOM_PCT / 100);
  const marginPx = 8;
  return (safeBottomPx - marginPx - PORTRAIT_USER_CARD_HEIGHT_PX / 2) / PORTRAIT_PREVIEW_REF_HEIGHT;
}

export const DEFAULT_PORTRAIT_USER_CARD_POS = {
  x: 0.18,
  y: defaultPortraitUserCardY(),
};

export const DEFAULT_PORTRAIT_SUBTITLE = {
  enabled: true,
  mode: "plain" as const,
  x: 0.5,
  y: defaultPortraitSubtitleY(),
  textColor: "#ffffff",
  shadowEnabled: true,
  shadowColor: "#020617",
  shadowStrength: 0.85,
  fontSize: normalizePortraitSubtitleExportFontSize(defaultPortraitSubtitleExportFontSize()),
  maxWords: 5,
  textAlign: "center" as const,
  visibilityRanges: [] as unknown[],
};
