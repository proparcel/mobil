import { droneVideoEditorMode, droneVideoMatchesEditorMode } from "./droneVideoEditorMode";
import type { DroneMyVideoItem } from "../../services/droneRunwayStatusParser";

describe("droneVideoEditorMode", () => {
  it("detects ai_video from meta.editor_mode", () => {
    const item: DroneMyVideoItem = {
      job_id: "abc",
      status: "ready",
      meta: { editor_mode: "ai_video", ai_video_title: "Test" },
    };
    expect(droneVideoEditorMode(item)).toBe("ai_video");
    expect(droneVideoMatchesEditorMode(item, "ai_video")).toBe(true);
    expect(droneVideoMatchesEditorMode(item, "ai_drone")).toBe(false);
  });

  it("detects ai_video from reference_id prefix", () => {
    const item: DroneMyVideoItem = {
      job_id: "abc",
      status: "ready",
      reference_id: "ai_video_abc",
    };
    expect(droneVideoEditorMode(item)).toBe("ai_video");
  });
});
