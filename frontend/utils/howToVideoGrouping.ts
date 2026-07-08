import type { HowToVideoItem } from "../services/howToVideoService";

export type HowToVideoSection = {
  key: string;
  title: string;
  videos: HowToVideoItem[];
};

export const HOW_TO_GENERAL_CATEGORY_TITLE = "Genel";

export function groupHowToVideosByCategory(videos: HowToVideoItem[]): HowToVideoSection[] {
  const sections: HowToVideoSection[] = [];
  let current: HowToVideoSection | null = null;

  for (const video of videos) {
    const title = video.category?.name?.trim() || HOW_TO_GENERAL_CATEGORY_TITLE;
    const key = video.category?.id != null ? `cat-${video.category.id}` : "general";

    if (!current || current.key !== key) {
      current = { key, title, videos: [] };
      sections.push(current);
    }
    current.videos.push(video);
  }

  return sections;
}

export type HowToGridRowItem =
  | { type: "header"; key: string; categoryKey: string; title: string; videoCount: number }
  | { type: "row"; key: string; videos: HowToVideoItem[] };

export function groupVideosIntoGridRows(
  sections: HowToVideoSection[],
  columns: number,
): HowToGridRowItem[] {
  const rows: HowToGridRowItem[] = [];

  for (const section of sections) {
    rows.push({
      type: "header",
      key: `header-${section.key}`,
      categoryKey: section.key,
      title: section.title,
      videoCount: section.videos.length,
    });
    for (let i = 0; i < section.videos.length; i += columns) {
      rows.push({
        type: "row",
        key: `row-${section.key}-${i}`,
        videos: section.videos.slice(i, i + columns),
      });
    }
  }

  return rows;
}
