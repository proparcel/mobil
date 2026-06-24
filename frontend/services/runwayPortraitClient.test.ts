import assert from "node:assert/strict";
import { test } from "node:test";

import { appendOpenAiPreflightFormFields, openAiPreflightPrepJsonFields } from "./openAiPreflightApi";
import {
  appendRunwayPortraitClientFormFields,
  runwayPortraitClientJsonFields,
} from "./runwayPortraitClient";

test("openAiPreflightPrepJsonFields — kapalı", () => {
  const fields = openAiPreflightPrepJsonFields(false);
  assert.equal(fields.skip_openai_preflight, true);
  assert.equal(fields.use_openai_preflight, undefined);
});

test("openAiPreflightPrepJsonFields — açık", () => {
  const fields = openAiPreflightPrepJsonFields(true);
  assert.equal(fields.skip_openai_preflight, false);
  assert.equal(fields.use_openai_preflight, true);
});

test("appendOpenAiPreflightFormFields", () => {
  const form = new FormData();
  appendOpenAiPreflightFormFields(form, true);
  assert.equal(form.get("skip_openai_preflight"), "0");
  assert.equal(form.get("use_openai_preflight"), "1");
});

test("runwayPortraitClientJsonFields", () => {
  const fields = runwayPortraitClientJsonFields();
  assert.equal(fields.orientation, "portrait");
  assert.equal(fields.refs_client_presized, true);
  assert.equal(fields.source, "mobile_drone_simple_editor");
});

test("appendRunwayPortraitClientFormFields", () => {
  const form = new FormData();
  appendRunwayPortraitClientFormFields(form);
  assert.equal(form.get("orientation"), "portrait");
  assert.equal(form.get("refs_client_presized"), "1");
  assert.equal(form.get("source"), "mobile_drone_simple_editor");
});
