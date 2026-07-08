export type RunwaySegmentTimelineEntry = {
  id: string;
  slot: number;
  label?: string;
  enabled?: boolean;
};

export type RunwaySegmentItemForTimeline = {
  slot: number;
  exists: boolean;
};

/** Diskteki exists segmentlerden tam timeline üretir (web normalizeSegmentTimeline mantığı). */
export function buildCanonicalTimeline(
  segments: RunwaySegmentItemForTimeline[],
  timeline: RunwaySegmentTimelineEntry[],
): RunwaySegmentTimelineEntry[] {
  const readySlots = segments
    .filter((s) => s.exists && s.slot > 0)
    .map((s) => s.slot)
    .sort((a, b) => a - b);

  const timelineBySlot = new Map(timeline.map((entry) => [Number(entry.slot), entry]));
  const orderedSlots: number[] = [];
  const seen = new Set<number>();

  for (const entry of timeline) {
    const slot = Number(entry.slot);
    if (slot > 0 && readySlots.includes(slot) && !seen.has(slot)) {
      orderedSlots.push(slot);
      seen.add(slot);
    }
  }
  for (const slot of readySlots) {
    if (!seen.has(slot)) {
      orderedSlots.push(slot);
      seen.add(slot);
    }
  }

  return orderedSlots.map((slot, index) => {
    const existing = timelineBySlot.get(slot);
    return {
      id: String(existing?.id || `slot-${slot}`),
      slot,
      label: String(index + 1),
      enabled: existing?.enabled !== false,
    };
  });
}

export function timelineCoversSegments(
  segments: RunwaySegmentItemForTimeline[],
  timeline: RunwaySegmentTimelineEntry[],
): boolean {
  const segmentSlots = new Set(
    segments.filter((s) => s.exists && s.slot > 0).map((s) => s.slot),
  );
  const timelineSlots = new Set(
    timeline.filter((e) => Number(e.slot) > 0).map((e) => Number(e.slot)),
  );
  if (segmentSlots.size !== timelineSlots.size) return false;
  for (const slot of segmentSlots) {
    if (!timelineSlots.has(slot)) return false;
  }
  return true;
}

/** Web normalizeSegmentTimeline — strip etiketlerini S1…Sn yapar. */
export function normalizeSceneTimeline(
  timeline: RunwaySegmentTimelineEntry[],
): RunwaySegmentTimelineEntry[] {
  return timeline.map((entry, index) => ({
    id: String(entry.id || `slot-${entry.slot}`),
    slot: Number(entry.slot),
    label: String(index + 1),
    enabled: entry.enabled !== false,
  }));
}

/** Timeline entry id ile splice — web handleSegmentDrop. */
export function reorderSceneTimeline(
  timeline: RunwaySegmentTimelineEntry[],
  fromEntryId: string,
  toEntryId: string,
): RunwaySegmentTimelineEntry[] {
  const fromId = String(fromEntryId || "").trim();
  const toId = String(toEntryId || "").trim();
  if (!fromId || !toId || fromId === toId) return normalizeSceneTimeline(timeline);

  const items = [...timeline];
  const from = items.findIndex((entry) => entry.id === fromId);
  const to = items.findIndex((entry) => entry.id === toId);
  if (from < 0 || to < 0) return normalizeSceneTimeline(timeline);

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return normalizeSceneTimeline(next);
}

/** Seçili entry'yi strip'te bir adım sola (-1) veya sağa (+1) kaydırır. */
export function moveSceneTimelineByStep(
  timeline: RunwaySegmentTimelineEntry[],
  entryId: string,
  direction: -1 | 1,
): RunwaySegmentTimelineEntry[] | null {
  const id = String(entryId || "").trim();
  if (!id || (direction !== -1 && direction !== 1)) return null;

  const index = timeline.findIndex((entry) => entry.id === id);
  if (index < 0) return null;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= timeline.length) return null;

  const neighborId = timeline[targetIndex]?.id;
  if (!neighborId) return null;

  return reorderSceneTimeline(timeline, id, neighborId);
}

/** Birleştir — strip sırasındaki seçili sahneler (slot numarası sırası değil). */
export function buildMergeTimelineFromStripOrder(
  segments: RunwaySegmentItemForTimeline[],
  timeline: RunwaySegmentTimelineEntry[],
  selectedSlots: Set<number>,
): RunwaySegmentTimelineEntry[] {
  const canonical = buildCanonicalTimeline(segments, timeline);
  return canonical
    .filter((entry) => selectedSlots.has(Number(entry.slot)))
    .map((entry, index) => ({
      id: entry.id,
      slot: entry.slot,
      label: String(index + 1),
      enabled: true,
    }));
}
