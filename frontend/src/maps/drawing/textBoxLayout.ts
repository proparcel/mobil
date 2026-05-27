import type { ShapeProperties } from "./types";

/** Web drone editor LabelBadge ile uyumlu (LABEL_BOX_PADDING = 5) */
export const TEXTBOX_PADDING = 5;
const LINE_HEIGHT_RATIO = 1.28;
const CHAR_WIDTH_RATIO = 0.68;
export const TEXTBOX_MAX_WIDTH_PX = 320;
const MIN_WIDTH_PX = 48;
const MIN_HEIGHT_PX = 20;

export function labelLines(text: string): { cleanText: string; lines: string[] } {
  const cleanText = String(text ?? "").replace(/\r\n?/g, "\n");
  const lines = cleanText.split("\n");
  return { cleanText, lines: lines.length ? lines : [""] };
}

/** Uzun satırları max genişliğe göre sarar (açık satır sonları + kelime sarma). */
export function expandTextBoxLines(
  text: string,
  maxInnerWidthPx: number,
  textSize: number
): string[] {
  const charWidth = Math.max(4, textSize * CHAR_WIDTH_RATIO);
  const maxChars = Math.max(4, Math.floor(maxInnerWidthPx / charWidth));
  const { lines: rawLines } = labelLines(text);
  const out: string[] = [];

  for (const raw of rawLines) {
    const line = String(raw);
    if (line.length <= maxChars) {
      out.push(line);
      continue;
    }
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      for (let i = 0; i < line.length; i += maxChars) {
        out.push(line.slice(i, i + maxChars));
      }
      continue;
    }
    let cur = "";
    for (const word of words) {
      const candidate = cur ? `${cur} ${word}` : word;
      if (candidate.length > maxChars && cur) {
        out.push(cur);
        cur = word;
      } else {
        cur = candidate;
      }
    }
    if (cur) out.push(cur);
  }

  return out.length ? out : [""];
}

export type TextBoxLayout = {
  lines: string[];
  widthPx: number;
  heightPx: number;
  lineHeightPx: number;
  effectiveTextSize: number;
};

export function textBoxEffectiveTextSize(shape: ShapeProperties): number {
  const base = typeof shape.textSize === "number" ? shape.textSize : 14;
  const pct = typeof shape.shapeSizePercent === "number" ? shape.shapeSizePercent : 100;
  return Math.max(8, Math.round(base * (pct / 100)));
}

/** Mapbox marker yenilemesi için görsel özellik imzası */
export function textBoxStyleKey(shape: ShapeProperties): string {
  return [
    shape.text ?? "",
    shape.textSize ?? 14,
    shape.textColor ?? "",
    shape.fillColor ?? "",
    shape.fillOpacity ?? "",
    shape.outlineColor ?? "",
    shape.outlineWidth ?? "",
    shape.boxFillEnabled ?? true,
    shape.shapeSizePercent ?? 100,
    shape.rotation ?? 0,
    shape.boxWidthPx ?? "",
    shape.boxHeightPx ?? "",
  ].join("|");
}

export function computeTextBoxLayout(
  text: string,
  textSize: number,
  options?: {
    boxFillEnabled?: boolean;
    maxWidthPx?: number;
    shapeSizePercent?: number;
  }
): TextBoxLayout {
  const padded = options?.boxFillEnabled !== false;
  const padding = padded ? TEXTBOX_PADDING : 0;
  const pct = options?.shapeSizePercent ?? 100;
  const effectiveTextSize = Math.max(8, Math.round(textSize * (pct / 100)));
  const maxWidth = options?.maxWidthPx ?? TEXTBOX_MAX_WIDTH_PX;
  const innerMax = Math.max(MIN_WIDTH_PX, maxWidth - padding * 2);

  const lines = expandTextBoxLines(text, innerMax, effectiveTextSize);
  const lineHeightPx = effectiveTextSize * LINE_HEIGHT_RATIO;
  const maxLineLen = Math.max(1, ...lines.map((l) => String(l).length));
  const contentWidth = Math.min(
    innerMax,
    Math.max(MIN_WIDTH_PX, maxLineLen * effectiveTextSize * CHAR_WIDTH_RATIO)
  );
  const widthPx = Math.max(MIN_WIDTH_PX, Math.min(maxWidth, contentWidth + padding * 2));
  const heightPx = Math.max(MIN_HEIGHT_PX, lines.length * lineHeightPx + padding * 2);

  return { lines, widthPx, heightPx, lineHeightPx, effectiveTextSize };
}

export function layoutFieldsForTextBox(shape: ShapeProperties): Pick<
  ShapeProperties,
  "boxWidthPx" | "boxHeightPx"
> {
  const text = String(shape.text ?? "");
  const textSize = typeof shape.textSize === "number" ? shape.textSize : 14;
  const boxFillEnabled = shape.boxFillEnabled !== false;
  const shapeSizePercent =
    typeof shape.shapeSizePercent === "number" ? shape.shapeSizePercent : 100;
  const { widthPx, heightPx } = computeTextBoxLayout(text, textSize, {
    boxFillEnabled,
    shapeSizePercent,
  });
  return { boxWidthPx: widthPx, boxHeightPx: heightPx };
}

/** Metin / boyut / kutu toggle değişince kutuyu içeriğe göre yeniden hesaplar. */
export function patchTextBoxShape(
  shape: ShapeProperties,
  patch: Record<string, unknown>
): ShapeProperties {
  if (shape.type !== "textbox") return shape;
  const merged = { ...shape, ...patch } as ShapeProperties;
  return { ...merged, ...layoutFieldsForTextBox(merged) };
}
