export type HowToCategoryPalette = {
  gradientStart: string;
  gradientEnd: string;
  gradientGlow: string;
  title: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconBg: string;
  iconColor: string;
  accentBar: string;
  divider: string;
};

const CATEGORY_PALETTES: HowToCategoryPalette[] = [
  {
    gradientStart: "rgba(59, 130, 246, 0.22)",
    gradientEnd: "rgba(14, 165, 233, 0.10)",
    gradientGlow: "rgba(37, 99, 235, 0.14)",
    title: "#1d4ed8",
    badgeBg: "rgba(59, 130, 246, 0.16)",
    badgeText: "#1d4ed8",
    badgeBorder: "rgba(59, 130, 246, 0.28)",
    iconBg: "rgba(59, 130, 246, 0.20)",
    iconColor: "#2563eb",
    accentBar: "#3b82f6",
    divider: "rgba(59, 130, 246, 0.22)",
  },
  {
    gradientStart: "rgba(99, 102, 241, 0.22)",
    gradientEnd: "rgba(168, 85, 247, 0.10)",
    gradientGlow: "rgba(124, 58, 237, 0.14)",
    title: "#5b21b6",
    badgeBg: "rgba(139, 92, 246, 0.16)",
    badgeText: "#6d28d9",
    badgeBorder: "rgba(139, 92, 246, 0.28)",
    iconBg: "rgba(139, 92, 246, 0.20)",
    iconColor: "#7c3aed",
    accentBar: "#8b5cf6",
    divider: "rgba(139, 92, 246, 0.22)",
  },
  {
    gradientStart: "rgba(20, 184, 166, 0.22)",
    gradientEnd: "rgba(34, 197, 94, 0.10)",
    gradientGlow: "rgba(13, 148, 136, 0.14)",
    title: "#0f766e",
    badgeBg: "rgba(20, 184, 166, 0.16)",
    badgeText: "#0d9488",
    badgeBorder: "rgba(20, 184, 166, 0.28)",
    iconBg: "rgba(20, 184, 166, 0.20)",
    iconColor: "#14b8a6",
    accentBar: "#14b8a6",
    divider: "rgba(20, 184, 166, 0.22)",
  },
  {
    gradientStart: "rgba(245, 158, 11, 0.24)",
    gradientEnd: "rgba(251, 146, 60, 0.11)",
    gradientGlow: "rgba(217, 119, 6, 0.14)",
    title: "#b45309",
    badgeBg: "rgba(245, 158, 11, 0.18)",
    badgeText: "#c2410c",
    badgeBorder: "rgba(245, 158, 11, 0.30)",
    iconBg: "rgba(245, 158, 11, 0.22)",
    iconColor: "#d97706",
    accentBar: "#f59e0b",
    divider: "rgba(245, 158, 11, 0.24)",
  },
  {
    gradientStart: "rgba(244, 63, 94, 0.20)",
    gradientEnd: "rgba(236, 72, 153, 0.10)",
    gradientGlow: "rgba(225, 29, 72, 0.12)",
    title: "#be123c",
    badgeBg: "rgba(244, 63, 94, 0.16)",
    badgeText: "#e11d48",
    badgeBorder: "rgba(244, 63, 94, 0.28)",
    iconBg: "rgba(244, 63, 94, 0.18)",
    iconColor: "#f43f5e",
    accentBar: "#f43f5e",
    divider: "rgba(244, 63, 94, 0.22)",
  },
  {
    gradientStart: "rgba(6, 182, 212, 0.22)",
    gradientEnd: "rgba(59, 130, 246, 0.10)",
    gradientGlow: "rgba(8, 145, 178, 0.14)",
    title: "#0e7490",
    badgeBg: "rgba(6, 182, 212, 0.16)",
    badgeText: "#0891b2",
    badgeBorder: "rgba(6, 182, 212, 0.28)",
    iconBg: "rgba(6, 182, 212, 0.20)",
    iconColor: "#06b6d4",
    accentBar: "#06b6d4",
    divider: "rgba(6, 182, 212, 0.22)",
  },
];

function hashCategoryKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getHowToCategoryPalette(categoryKey: string): HowToCategoryPalette {
  const index = hashCategoryKey(categoryKey || "general") % CATEGORY_PALETTES.length;
  return CATEGORY_PALETTES[index];
}
