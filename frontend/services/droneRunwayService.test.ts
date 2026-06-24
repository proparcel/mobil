import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyRunwayStatus,
  isMyVideoFailed,
  isMyVideoProcessing,
  isMyVideoReady,
  type DroneMyVideoItem,
  type RunwayStatusResponse,
} from "./droneRunwayStatusParser";

test("classifyRunwayStatus — running PENDING/STARTED", () => {
  const pending: RunwayStatusResponse = { state: "PENDING", ready: false, progress: { step: "runway" } };
  const started: RunwayStatusResponse = { state: "STARTED", ready: false, progress: { step: "merge" } };
  assert.equal(classifyRunwayStatus(pending).isRunning, true);
  assert.equal(classifyRunwayStatus(pending).isFailed, false);
  assert.equal(classifyRunwayStatus(started).isRunning, true);
});

test("classifyRunwayStatus — backend done payload (ready SUCCESS)", () => {
  const s: RunwayStatusResponse = {
    state: "SUCCESS",
    ready: true,
    success: true,
    progress: { step: "done", label: "Tamamlandı" },
  };
  const c = classifyRunwayStatus(s);
  assert.equal(c.isReady, true);
  assert.equal(c.isFailed, false);
});

test("classifyRunwayStatus — ready true with step ready", () => {
  const s: RunwayStatusResponse = {
    state: "STARTED",
    ready: true,
    progress: { step: "ready", label: "Hazır" },
  };
  assert.equal(classifyRunwayStatus(s).isReady, true);
});

test("classifyRunwayStatus — failed FAILURE", () => {
  const s: RunwayStatusResponse = { state: "FAILURE", ready: true, success: false, error: "task_failed" };
  const c = classifyRunwayStatus(s);
  assert.equal(c.isFailed, true);
  assert.equal(c.isReady, false);
});

test("classifyRunwayStatus — failed progress step", () => {
  const s: RunwayStatusResponse = { state: "STARTED", ready: false, progress: { step: "failed" } };
  assert.equal(classifyRunwayStatus(s).isFailed, true);
});

test("my-videos row helpers", () => {
  const processing: DroneMyVideoItem = {
    job_id: "a",
    status: "processing",
    meta: { progress: { step: "runway", label: "Frame 2/3" } },
  };
  const ready: DroneMyVideoItem = { job_id: "b", status: "ready", meta: { progress: { step: "done" } } };
  const failed: DroneMyVideoItem = { job_id: "c", status: "failed" };
  assert.equal(isMyVideoProcessing(processing), true);
  assert.equal(isMyVideoReady(ready), true);
  assert.equal(isMyVideoFailed(failed), true);
});
