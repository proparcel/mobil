/** Şekil çizimi / düzenleme için ortak renk paleti */
export const SHAPE_COLOR_PALETTE = [
  "#dc2626",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#10b981",
  "#22c55e",
  "#34d399",
  "#3b82f6",
  "#2563eb",
  "#60a5fa",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f472b6",
  "#64748b",
  "#475569",
  "#0f172a",
  "#ffffff",
  "#000000",
  "#f8fafc",
] as const;

export type ShapeColorHex = (typeof SHAPE_COLOR_PALETTE)[number];

export function isSameColor(a?: string | null, b?: string | null): boolean {
  return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
}
