import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCanonicalTimeline,
  buildMergeTimelineFromStripOrder,
  moveSceneTimelineByStep,
  normalizeSceneTimeline,
  reorderSceneTimeline,
  type RunwaySegmentItemForTimeline,
  type RunwaySegmentTimelineEntry,
} from "./droneSceneTimeline";

const segments: RunwaySegmentItemForTimeline[] = [
  { slot: 1, exists: true },
  { slot: 2, exists: true },
  { slot: 3, exists: true },
];

const timeline: RunwaySegmentTimelineEntry[] = [
  { id: "a", slot: 3, label: "1" },
  { id: "b", slot: 1, label: "2" },
  { id: "c", slot: 2, label: "3" },
];

test("normalizeSceneTimeline — label S1…Sn", () => {
  const out = normalizeSceneTimeline(timeline);
  assert.deepEqual(
    out.map((e) => e.label),
    ["1", "2", "3"],
  );
});

test("reorderSceneTimeline — id b before a", () => {
  const canonical = buildCanonicalTimeline(segments, timeline);
  const out = reorderSceneTimeline(canonical, "b", "a");
  assert.deepEqual(
    out.map((e) => e.slot),
    [1, 3, 2],
  );
  assert.deepEqual(
    out.map((e) => e.label),
    ["1", "2", "3"],
  );
});

test("buildMergeTimelineFromStripOrder — strip order not slot sort", () => {
  const selected = new Set([1, 3]);
  const out = buildMergeTimelineFromStripOrder(segments, timeline, selected);
  assert.deepEqual(
    out.map((e) => e.slot),
    [3, 1],
  );
  assert.notDeepEqual(
    out.map((e) => e.slot),
    [1, 3],
  );
});

test("moveSceneTimelineByStep — middle entry right", () => {
  const canonical = buildCanonicalTimeline(segments, timeline);
  const middleId = canonical[1]?.id;
  assert.ok(middleId);
  const out = moveSceneTimelineByStep(canonical, middleId, 1);
  assert.ok(out);
  assert.deepEqual(
    out.map((e) => e.slot),
    [3, 2, 1],
  );
});

test("moveSceneTimelineByStep — boundary returns null", () => {
  const canonical = buildCanonicalTimeline(segments, timeline);
  const firstId = canonical[0]?.id;
  const lastId = canonical[canonical.length - 1]?.id;
  assert.ok(firstId && lastId);
  assert.equal(moveSceneTimelineByStep(canonical, firstId, -1), null);
  assert.equal(moveSceneTimelineByStep(canonical, lastId, 1), null);
});
