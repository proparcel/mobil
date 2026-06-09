import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { haversineMetres, MIN_AB_DISTANCE_M, validateTapSeparation } from "./calibrationEngine";
import { selectVrCalibrationMode, isArCalibrationMode } from "./vrModeSelector";
import {
  validateMapReferenceTriangle,
  validateMapReferencePair,
} from "./vrMapReferenceSelection";
import {
  computeArReferenceDistances,
  formatArDistanceM,
} from "./vrArDistance";
import { evaluateGpsReadiness } from "./vrGpsReadiness";
import {
  computeThreePointCalibrationTransform,
  applyManualFineTune,
} from "./vrCalibrationMath";
import type { VrGpsSnapshot } from "./vrGpsStream";

describe("vrModeSelector", () => {
  it("selects lidar_precise on iOS LiDAR", () => {
    const mode = selectVrCalibrationMode({
      platform: "ios",
      supportsAR: true,
      supportsARKit: true,
      supportsLiDAR: true,
    });
    assert.equal(mode, "lidar_precise");
  });

  it("selects arkit_standard without LiDAR", () => {
    const mode = selectVrCalibrationMode({
      platform: "ios",
      supportsAR: true,
      supportsARKit: true,
      supportsLiDAR: false,
    });
    assert.equal(mode, "arkit_standard");
  });

  it("selects map_only_fallback when no AR", () => {
    const mode = selectVrCalibrationMode({
      platform: "ios",
      supportsAR: false,
    });
    assert.equal(mode, "map_only_fallback");
  });

  it("isArCalibrationMode true for AR modes", () => {
    assert.equal(isArCalibrationMode("lidar_precise"), true);
    assert.equal(isArCalibrationMode("map_only_fallback"), false);
  });
});

describe("vrMapReferenceSelection", () => {
  it("rejects too close map refs", () => {
    const a = { lat: 40.0, lon: 29.0 };
    const b = { lat: 40.000001, lon: 29.0 };
    const v = validateMapReferencePair(a, b);
    assert.equal(v.code, "too_close");
  });

  it("accepts good triangle", () => {
    const refs = {
      userPoint: { lat: 40.0, lon: 29.0 },
      referenceA: { lat: 40.00005, lon: 29.0 },
      referenceB: { lat: 40.0, lon: 29.00005 },
    };
    const v = validateMapReferenceTriangle(refs);
    assert.equal(v.ok, true);
  });

  it("accepts ~3 m equilateral triangle on map", () => {
    const refs = {
      userPoint: { lat: 40.0, lon: 29.0 },
      referenceA: { lat: 40.000027, lon: 29.0 },
      referenceB: { lat: 40.0000135, lon: 29.0000234 },
    };
    const v = validateMapReferenceTriangle(refs);
    assert.equal(v.ok, true);
    assert.equal(v.quality, "ok");
  });
});

describe("vrCalibrationMath", () => {
  const mapRefs = {
    userPoint: { lat: 40.0, lon: 29.0 },
    referenceA: { lat: 40.00005, lon: 29.0 },
    referenceB: { lat: 40.0, lon: 29.00005 },
  };

  it("computes three point transform", () => {
    const t = computeThreePointCalibrationTransform(
      mapRefs,
      {
        userPoint: { x: 0, y: 0, z: 0 },
        referenceA: { x: 0, y: 0, z: 5.5 },
        referenceB: { x: 4.2, y: 0, z: 0.2 },
      },
      "arkit_standard",
    );
    assert.ok(t.qualityScore > 0);
    assert.equal(t.mode, "arkit_standard");
    assert.ok(Number.isFinite(t.rotationYaw));
  });

  it("applyManualFineTune adjusts transform", () => {
    const base = computeThreePointCalibrationTransform(
      mapRefs,
      {
        userPoint: { x: 0, y: 0, z: 0 },
        referenceA: { x: 0, y: 0, z: 5 },
        referenceB: { x: 4, y: 0, z: 0 },
      },
      "arkit_standard",
    );
    const tuned = applyManualFineTune(base, 0.1, 0, 1);
    assert.notEqual(tuned.rotationYaw, base.rotationYaw);
  });
});

describe("legacy calibrationEngine", () => {
  it("MIN_AB_DISTANCE_M is 3", () => {
    assert.equal(MIN_AB_DISTANCE_M, 3);
  });

  it("validateTapSeparation rejects close taps", () => {
    assert.equal(validateTapSeparation(0, 0, 0.1, 0.1), "tap_too_close");
  });

  it("haversineMetres works", () => {
    const d = haversineMetres(40.0, 29.0, 40.00003, 29.0);
    assert.ok(d > 2 && d < 5);
  });
});

describe("vrArDistance", () => {
  it("formats short distances in cm", () => {
    assert.equal(formatArDistanceM(0.45), "45 cm");
  });

  it("computes AR reference distances", () => {
    const d = computeArReferenceDistances({
      userPoint: { x: 0, y: 0, z: 0 },
      referenceA: { x: 0, y: 0, z: 4 },
      referenceB: { x: 3, y: 0, z: 0 },
    });
    assert.equal(d.userToA, 4);
    assert.equal(d.userToB, 3);
    assert.equal(d.aToB, 5);
  });
});

describe("vrCalibrationSteps", () => {
  it("returns step meta for map user", async () => {
    const { getVrStepMeta } = await import("./vrCalibrationSteps");
    const meta = getVrStepMeta("map_user");
    assert.equal(meta.phase, "map");
    assert.ok(meta.index >= 1);
  });
});

describe("vrGpsReadiness validation-only", () => {
  it("stable snapshot for region hint path", () => {
    const snap: VrGpsSnapshot = {
      lat: 40,
      lon: 29,
      accuracyMedianM: 12,
      positionStdDevM: 2,
      sampleCount: 10,
      stableForMs: 3500,
      confidence: "good",
      rawSamples: [],
    };
    const r = evaluateGpsReadiness(snap, "point_a");
    assert.equal(r.status, "stable");
  });
});
