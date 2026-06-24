import assert from "node:assert/strict";
import { test } from "node:test";

import {
  userFacingPipelineDetail,
  userFacingRunwayProgressMessage,
} from "./aiDroneProductionPipeline";

test("userFacingPipelineDetail — Frame öncesi resim canlandırma süzülür", () => {
  assert.equal(
    userFacingPipelineDetail("Frame öncesi Resim Canlandırma (referans) 1/3"),
    "İşleniyor…",
  );
});

test("userFacingPipelineDetail — Frame hazırlanıyor N/M", () => {
  assert.equal(
    userFacingPipelineDetail("Frame hazırlanıyor 2/3"),
    "Video karesi hazırlanıyor (2/3)…",
  );
});

test("userFacingRunwayProgressMessage — openai_refs → video karesi", () => {
  assert.equal(
    userFacingRunwayProgressMessage({ step: "openai_refs", label: "Frame öncesi …" }),
    "Video karesi hazırlanıyor…",
  );
});

test("userFacingRunwayProgressMessage — runway step", () => {
  assert.equal(
    userFacingRunwayProgressMessage({ step: "runway", label: "Frame hazırlanıyor 1/3" }),
    "Video karesi hazırlanıyor (1/3)…",
  );
});
