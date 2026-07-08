import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeLocalMediaUri } from "../src/utils/normalizeLocalMediaUri";

test("normalizeLocalMediaUri — file:// korunur", () => {
  assert.equal(normalizeLocalMediaUri("file:///tmp/a.mp4"), "file:///tmp/a.mp4");
});

test("normalizeLocalMediaUri — content:// korunur", () => {
  assert.equal(normalizeLocalMediaUri("content://media/1"), "content://media/1");
});

test("normalizeLocalMediaUri — absolute path file:// ekler", () => {
  assert.equal(
    normalizeLocalMediaUri("/data/user/0/com.app/cache/seg.mp4"),
    "file:///data/user/0/com.app/cache/seg.mp4",
  );
});

test("normalizeLocalMediaUri — boş string", () => {
  assert.equal(normalizeLocalMediaUri(""), "");
});
