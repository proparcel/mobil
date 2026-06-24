import assert from "node:assert/strict";
import { test } from "node:test";

import { appendOpenAiPreflightFormFields, openAiPreflightPrepJsonFields } from "./openAiPreflightApi";

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
