import assert from "node:assert/strict";
import { test } from "node:test";

import { syncedSubtitleForTime, subtitleWordPhrases } from "./droneSubtitlePreview";

test("subtitleWordPhrases splits by maxWords", () => {
  const phrases = subtitleWordPhrases("bir iki üç dört beş altı", 3);
  assert.deepEqual(phrases, ["bir iki üç", "dört beş altı"]);
});

test("syncedSubtitleForTime advances with playback time", () => {
  const text = "bir iki üç dört beş altı yedi sekiz";
  const settings = { enabled: true, maxWords: 3, visibilityRanges: [] };
  const a = syncedSubtitleForTime(text, 0, 16, settings);
  const b = syncedSubtitleForTime(text, 6, 12, settings);
  assert.notEqual(a, b);
  assert.ok(a.startsWith("Bir"));
});
