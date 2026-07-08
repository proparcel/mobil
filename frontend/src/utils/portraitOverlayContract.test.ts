import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_PORTRAIT_SUBTITLE_EXPORT_FONT_SIZE,
  defaultPortraitSubtitleExportFontSize,
  portraitSubtitlePreviewFontSize,
  portraitUserCardPreviewScale,
  normalizePortraitSubtitleExportFontSize,
  userCardExportPointToUiCenter,
  userCardUiCenterToExportPoint,
  PORTRAIT_PREVIEW_REF_HEIGHT,
} from "./portraitOverlayContract";

describe("portraitOverlayContract", () => {
  it("maps user card center to export top-left and back", () => {
    const center = { x: 0.18, y: 0.8 };
    const exportPoint = userCardUiCenterToExportPoint(center);
    const back = userCardExportPointToUiCenter(exportPoint);
    assert.ok(Math.abs(back.x - center.x) < 0.01);
    assert.ok(Math.abs(back.y - center.y) < 0.01);
  });

  it("keeps legacy center-only mobile points stable in UI", () => {
    const legacy = { x: 0.18, y: 0.8 };
    const center = userCardExportPointToUiCenter(legacy);
    assert.ok(Math.abs(center.x - 0.18) < 0.01);
    assert.ok(Math.abs(center.y - 0.8) < 0.01);
  });

  it("uses 30 as default export subtitle font size", () => {
    assert.equal(DEFAULT_PORTRAIT_SUBTITLE_EXPORT_FONT_SIZE, 30);
    assert.equal(defaultPortraitSubtitleExportFontSize(), 30);
  });

  it("derives preview subtitle size from export fontSize", () => {
    const previewPx = portraitSubtitlePreviewFontSize(30, PORTRAIT_PREVIEW_REF_HEIGHT);
    assert.ok(previewPx >= 10);
  });

  it("upgrades legacy subtitle font sizes", () => {
    assert.equal(normalizePortraitSubtitleExportFontSize(22), defaultPortraitSubtitleExportFontSize());
    assert.equal(normalizePortraitSubtitleExportFontSize(34), defaultPortraitSubtitleExportFontSize());
    assert.equal(normalizePortraitSubtitleExportFontSize(35), defaultPortraitSubtitleExportFontSize());
    assert.equal(normalizePortraitSubtitleExportFontSize(51), defaultPortraitSubtitleExportFontSize());
    assert.equal(normalizePortraitSubtitleExportFontSize(33), 33);
    assert.equal(normalizePortraitSubtitleExportFontSize(42), 42);
  });
  it("scales user card preview with frame width", () => {
    const narrow = portraitUserCardPreviewScale(351);
    const wide = portraitUserCardPreviewScale(540);
    assert.ok(wide > narrow);
  });
});
