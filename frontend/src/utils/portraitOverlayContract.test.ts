import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultPortraitSubtitleExportFontSize,
  portraitSubtitleExportFontSize,
  portraitSubtitlePreviewFontSize,
  portraitUserCardPreviewScale,
  normalizePortraitSubtitleExportFontSize,
  userCardExportPointToUiCenter,
  userCardUiCenterToExportPoint,
  PORTRAIT_PREVIEW_REF_HEIGHT,
  PORTRAIT_PREVIEW_SUBTITLE_FONT_PX,
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

  it("matches preview subtitle size to export fontSize", () => {
    const exportFont = defaultPortraitSubtitleExportFontSize();
    const previewPx = portraitSubtitlePreviewFontSize(exportFont, PORTRAIT_PREVIEW_REF_HEIGHT);
    assert.ok(Math.abs(previewPx - PORTRAIT_PREVIEW_SUBTITLE_FONT_PX) < 1);
  });

  it("round-trips subtitle export font from preview px", () => {
    const exportFont = portraitSubtitleExportFontSize(
      PORTRAIT_PREVIEW_SUBTITLE_FONT_PX,
      PORTRAIT_PREVIEW_REF_HEIGHT,
    );
    assert.equal(exportFont, defaultPortraitSubtitleExportFontSize());
  });

  it("upgrades legacy subtitle font sizes", () => {
    assert.equal(normalizePortraitSubtitleExportFontSize(22), defaultPortraitSubtitleExportFontSize());
    assert.equal(normalizePortraitSubtitleExportFontSize(34), defaultPortraitSubtitleExportFontSize());
    assert.equal(normalizePortraitSubtitleExportFontSize(33), 33);
    assert.equal(normalizePortraitSubtitleExportFontSize(42), 42);
  });
  it("scales user card preview with frame width", () => {
    const narrow = portraitUserCardPreviewScale(351);
    const wide = portraitUserCardPreviewScale(540);
    assert.ok(wide > narrow);
  });
});
