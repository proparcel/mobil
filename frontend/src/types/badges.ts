export type BadgeOverviewItem = {
  code: string;
  title?: string;
  description?: string;
  is_earned?: boolean;
  svg_active_url?: string | null;
  svg_locked_url?: string | null;
  progress_current?: number;
  progress_target?: number;
};

export type MainBadgeGroup = {
  key: string;
  title?: string;
  items?: BadgeOverviewItem[];
};

export type BadgePageSummary = {
  earned_count?: number;
  total_count?: number;
};

export type BadgeOverviewPayload = {
  summary?: BadgePageSummary;
  groups?: MainBadgeGroup[];
  earned_strip?: BadgeOverviewItem[];
};

export type BadgeCelebrationPayload = {
  badge_code?: string;
  title?: string;
  message?: string;
  svg_url?: string | null;
};
