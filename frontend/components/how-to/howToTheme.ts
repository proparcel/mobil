export const howToColors = {
  headerBg: "#1e293b",
  accent: "#3b82f6",
  accentSoft: "#eff6ff",
  accentText: "#2563eb",
  pageBg: "#f1f5f9",
  surface: "#ffffff",
  surfaceMuted: "#f8fafc",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  borderSoft: "rgba(148, 163, 184, 0.35)",
  thumbBg: "#0f172a",
  live: "#ef4444",
  shadow: "#0f172a",
} as const;

export const howToRadii = {
  card: 14,
  thumb: 12,
  pill: 999,
  tab: 12,
} as const;

export const howToShadow = {
  card: {
    shadowColor: howToColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  thumb: {
    shadowColor: howToColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;

/** Liste / grid son satırının home indicator ve alt chrome altında kalmaması için */
export function howToScrollBottomPadding(safeAreaBottom: number, extra = 36): number {
  return Math.max(safeAreaBottom, 8) + extra;
}
