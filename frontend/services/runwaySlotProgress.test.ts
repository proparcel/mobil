import assert from "node:assert/strict";
import { test } from "node:test";

import {
  finalizeAllRunwaySlots,
  initialRunwaySlotProgressMap,
  mergeRunwaySlotProgressFromPoll,
  shouldFinalizeRunwaySlotsFromPoll,
} from "./runwaySlotProgress";

test("mergeRunwaySlotProgressFromPoll — merge aşamasında kareler %100", () => {
  const prev = initialRunwaySlotProgressMap(3);
  prev["1"] = { slot: 1, step: "done", percent: 100, label: "Tamamlandı" };
  prev["2"] = { slot: 2, step: "done", percent: 100, label: "Tamamlandı" };
  prev["3"] = { slot: 3, step: "runway", percent: 71, label: "Video karesi" };

  const merged = mergeRunwaySlotProgressFromPoll(
    prev,
    {
      state: "STARTED",
      ready: false,
      progress: { step: "merge", label: "Parçalar birleştiriliyor…" },
      segment_slot_progress: {
        "1": { progress_percent: 100 },
        "2": { progress_percent: 100 },
        "3": { progress_percent: 71 },
      },
    },
    3,
  );

  assert.equal(merged["3"].percent, 100);
  assert.equal(merged["3"].step, "done");
});

test("shouldFinalizeRunwaySlotsFromPoll — Frame hazır 3/3", () => {
  assert.equal(
    shouldFinalizeRunwaySlotsFromPoll(
      {
        state: "STARTED",
        ready: false,
        progress: { step: "runway", label: "Frame hazır 3/3" },
      },
      3,
    ),
    true,
  );
});

test("finalizeAllRunwaySlots", () => {
  const map = initialRunwaySlotProgressMap(2);
  finalizeAllRunwaySlots(map, 2);
  assert.equal(map["1"].percent, 100);
  assert.equal(map["2"].percent, 100);
});
