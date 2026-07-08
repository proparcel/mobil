/** Yerel dosya yolunu react-native-video için file:// URI'ye çevirir. */
export function normalizeLocalMediaUri(path: string): string {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (raw.startsWith("file://") || raw.startsWith("content://")) return raw;
  if (raw.startsWith("/")) return `file://${raw}`;
  return raw;
}
