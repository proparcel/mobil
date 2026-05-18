/**
 * ParcelSplit ekranı tema renkleri.
 * Proje tasarım sistemi (report_mobil_viewver vb.) ile uyumlu.
 */

export const parcelSplitTheme = {
  brandNavy: "#0f172a",
  accentBlue: "#3b82f6",
  pageBg: "#ffffff",
  headerBg: "#0f172a",
  cardBg: "#ffffff",
  buttonBg: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.18)",
  textMuted: "#475569",
  textOnDark: "#f8fafc",
  /** Arka plan mavi olabileceği için border kontrast: beyaz (mavi üzerinde görünür) */
  polygonStroke: "#ffffff",
  polygonFill: "rgba(59,130,246,0.12)",
  edgeStroke: "#64748b",
  edgeStrokeSelected: "#3b82f6",
  edgeStrokeWidth: 1.5,
  edgeStrokeWidthSelected: 3,
  pieceStroke: "#475569",
  pieceFill: "rgba(71,85,105,0.08)",
  pieceHighlight: "rgba(59,130,246,0.2)",
  warningStroke: "#ef4444",
  warningFill: "rgba(239,68,68,0.15)",
  splitLineStroke: "#0f172a",
  canvasBg: "#ffffff",
  muted: "#64748b",
} as const;

export type ParcelSplitTheme = typeof parcelSplitTheme;
