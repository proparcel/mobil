import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DroneMyVideoItem } from "../../services/droneRunwayStatusParser";
import {
  buildDroneProjectDisplayName,
  resolveDroneProjectDisplayName,
  resolveProjectId,
  validateDroneProjectLocation,
} from "./droneProjectContract";

describe("droneProjectContract", () => {
  it("builds display name from mahalle ada parsel", () => {
    assert.equal(
      buildDroneProjectDisplayName({ mahalle: "Cumhuriyet", ada: "123", parsel: "45" }),
      "Cumhuriyet · ada 123 / parsel 45",
    );
  });

  it("prefers display_name over legacy title fields", () => {
    const item: DroneMyVideoItem = {
      job_id: "abc",
      status: "ready",
      display_name: "Merkez · ada 1 / parsel 2",
      label: "Villa tanıtım",
      meta: { ai_video_title: "Eski başlık" },
    };
    assert.equal(resolveDroneProjectDisplayName(item), "Merkez · ada 1 / parsel 2");
  });

  it("builds label from location fields when display_name missing", () => {
    const item: DroneMyVideoItem = {
      job_id: "abc",
      status: "ready",
      mahalle: "Yeni Mahalle",
      ada: "10",
      parsel: "5",
    };
    assert.equal(resolveDroneProjectDisplayName(item), "Yeni Mahalle · ada 10 / parsel 5");
  });

  it("rejects numeric mahalle in local validation", () => {
    const res = validateDroneProjectLocation({
      city: "Bursa",
      district: "Nilüfer",
      mahalle: "12345",
      ada: "1",
      parsel: "2",
    });
    assert.equal(res.ok, false);
  });

  it("prefers project_id when present", () => {
    const item: DroneMyVideoItem = {
      job_id: "job-1",
      project_id: "proj-1",
      status: "ready",
    };
    assert.equal(resolveProjectId(item), "proj-1");
  });
});
