import type { SubtitleSettings } from "../../services/aiDroneSimpleEditorService";
import { DEFAULT_PORTRAIT_SUBTITLE } from "../constants/aiDroneEditorTheme";
import { formatSubtitlePhraseTr } from "./subtitleTrFormat";

export function subtitleWordPhrases(text: string, maxWords = DEFAULT_PORTRAIT_SUBTITLE.maxWords): string[] {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const size = Math.max(1, Math.min(9, Number(maxWords || DEFAULT_PORTRAIT_SUBTITLE.maxWords)));
  const phrases: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    phrases.push(words.slice(i, i + size).join(" "));
  }
  return phrases.slice(0, 240);
}

/** Web `syncedSubtitleForTime` ile aynı zaman dilimleme. */
export function syncedSubtitleForTime(
  text: string,
  time: number,
  duration: number,
  settings: Partial<SubtitleSettings> = DEFAULT_PORTRAIT_SUBTITLE,
): string {
  const merged = { ...DEFAULT_PORTRAIT_SUBTITLE, ...settings };
  const ranges = Array.isArray(merged.visibilityRanges) ? merged.visibilityRanges : [];
  if (ranges.length) {
    const current = Math.max(0, Number(time || 0));
    const visible = ranges.some((range) => {
      const r = range as { start?: number; end?: number };
      return current >= Number(r.start || 0) && current <= Number(r.end || 0);
    });
    if (!visible) return "";
  }
  const chunks = subtitleWordPhrases(text, merged.maxWords);
  if (!chunks.length) return "";
  const safeDuration = Math.max(1, Number(duration || 0) || chunks.length * 0.7);
  const slot = Math.max(0.35, safeDuration / chunks.length);
  const index = Math.max(
    0,
    Math.min(chunks.length - 1, Math.floor(Math.max(0, Number(time || 0)) / slot)),
  );
  return formatSubtitlePhraseTr(chunks[index]);
}
