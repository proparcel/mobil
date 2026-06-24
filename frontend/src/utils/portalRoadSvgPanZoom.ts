/**
 * RoadV2 diagram SVG — pan/zoom WebView HTML (web portal-road-svg-pan-zoom.js parity).
 * Parsel odaklı viewBox, WebView yüklenmeden önce TS tarafında uygulanır (getBBox güvenilir değil).
 */

type Point = { x: number; y: number };
type BBox = { x: number; y: number; w: number; h: number };

const PARCEL_STROKE_RE = /#dc2626|#92400e/i;
const PARCEL_FILL_RE = /rgba\(\s*239\s*,\s*68\s*,\s*68|rgba\(\s*217\s*,\s*191\s*,\s*140/i;

function isParcelPolygonTag(tag: string): boolean {
  if (PARCEL_STROKE_RE.test(tag)) return true;
  if (/stroke\s*:\s*#(?:dc2626|92400e)/i.test(tag)) return true;
  if (PARCEL_FILL_RE.test(tag)) return true;
  return false;
}

function parsePointsAttr(raw: string): Point[] {
  const nums = raw.trim().split(/[\s,]+/).map((v) => Number(v));
  const out: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (Number.isFinite(nums[i]) && Number.isFinite(nums[i + 1])) {
      out.push({ x: nums[i], y: nums[i + 1] });
    }
  }
  return out;
}

function bboxFromPoints(pts: Point[]): BBox | null {
  if (!pts.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { x: minX, y: minY, w, h };
}

function mergeBBox(a: BBox | null, b: BBox | null): BBox | null {
  if (!a) return b;
  if (!b) return a;
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w);
  const y2 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function expandBBox(b: BBox, ratio: number, minPad = 0): BBox {
  const padX = Math.max(b.w * ratio, minPad);
  const padY = Math.max(b.h * ratio, minPad);
  return { x: b.x - padX, y: b.y - padY, w: b.w + padX * 2, h: b.h + padY * 2 };
}

function pointInBBox(p: Point, b: BBox): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

function bboxIntersects(a: BBox, b: BBox): boolean {
  return !(b.x + b.w < a.x || b.x > a.x + a.w || b.y + b.h < a.y || b.y > a.y + a.h);
}

function readAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = tag.match(re);
  return m?.[1] ?? m?.[2] ?? null;
}

function extractParcelPolygonBbox(svg: string): BBox | null {
  const polygonRe = /<polygon\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = polygonRe.exec(svg)) !== null) {
    const tag = match[0];
    if (!isParcelPolygonTag(tag)) continue;
    const pointsRaw = readAttr(tag, 'points');
    if (!pointsRaw) continue;
    const bbox = bboxFromPoints(parsePointsAttr(pointsRaw));
    if (bbox) return bbox;
  }

  polygonRe.lastIndex = 0;
  while ((match = polygonRe.exec(svg)) !== null) {
    const pointsRaw = readAttr(match[0], 'points');
    if (!pointsRaw) continue;
    const bbox = bboxFromPoints(parsePointsAttr(pointsRaw));
    if (bbox && bbox.w > 20 && bbox.h > 20 && bbox.w < 920 && bbox.h < 700) {
      return bbox;
    }
  }
  return null;
}

function unionNearbyGeometry(svg: string, search: BBox, seed: BBox): BBox {
  let focus: BBox = { ...seed };

  const polylineRe = /<polyline\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = polylineRe.exec(svg)) !== null) {
    const pointsRaw = readAttr(match[0], 'points');
    if (!pointsRaw) continue;
    const pts = parsePointsAttr(pointsRaw);
    if (pts.some((p) => pointInBBox(p, search))) {
      const bb = bboxFromPoints(pts);
      if (bb) focus = mergeBBox(focus, bb) as BBox;
    }
  }

  const lineRe = /<line\b[^>]*>/gi;
  while ((match = lineRe.exec(svg)) !== null) {
    const tag = match[0];
    const x1 = Number(readAttr(tag, 'x1'));
    const y1 = Number(readAttr(tag, 'y1'));
    const x2 = Number(readAttr(tag, 'x2'));
    const y2 = Number(readAttr(tag, 'y2'));
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    const bb = bboxFromPoints([{ x: x1, y: y1 }, { x: x2, y: y2 }]);
    if (bb && bboxIntersects(search, bb)) {
      focus = mergeBBox(focus, bb) as BBox;
    }
  }

  const circleRe = /<circle\b[^>]*>/gi;
  while ((match = circleRe.exec(svg)) !== null) {
    const tag = match[0];
    const cx = Number(readAttr(tag, 'cx'));
    const cy = Number(readAttr(tag, 'cy'));
    const r = Number(readAttr(tag, 'r')) || 0;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    const bb: BBox = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    if (bboxIntersects(search, bb)) {
      focus = mergeBBox(focus, bb) as BBox;
    }
  }

  const textRe = /<text\b[^>]*>/gi;
  while ((match = textRe.exec(svg)) !== null) {
    const tag = match[0];
    const x = Number(readAttr(tag, 'x'));
    const y = Number(readAttr(tag, 'y'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const bb: BBox = { x: x - 24, y: y - 14, w: 48, h: 28 };
    if (bboxIntersects(search, bb)) {
      focus = mergeBBox(focus, bb) as BBox;
    }
  }

  const rectRe = /<rect\b[^>]*>/gi;
  while ((match = rectRe.exec(svg)) !== null) {
    const tag = match[0];
    const wRaw = readAttr(tag, 'width');
    const hRaw = readAttr(tag, 'height');
    if (!wRaw || !hRaw || wRaw.includes('%') || hRaw.includes('%')) continue;
    const w = Number(wRaw);
    const h = Number(hRaw);
    const x = Number(readAttr(tag, 'x'));
    const y = Number(readAttr(tag, 'y'));
    if (![w, h, x, y].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    if (w > 700 || h > 500) continue;
    const bb: BBox = { x, y, w, h };
    if (bboxIntersects(search, bb)) {
      focus = mergeBBox(focus, bb) as BBox;
    }
  }

  return focus;
}

/** SVG viewBox'ını parsele ve yakın yol/cephe geometrisine kırpar. */
export function focusRoadDiagramSvgOnParcel(svgMarkup: string): string {
  const svg = String(svgMarkup || '').trim();
  if (!svg) return svg;

  const parcelBbox = extractParcelPolygonBbox(svg);
  if (!parcelBbox) return svg;

  const search = expandBBox(parcelBbox, 0.28, 22);
  const merged = unionNearbyGeometry(svg, search, parcelBbox);
  const focus = expandBBox(merged, 0.08, 10);

  const vbStr = `${focus.x.toFixed(2)} ${focus.y.toFixed(2)} ${focus.w.toFixed(2)} ${focus.h.toFixed(2)}`;

  let result = svg;
  if (/viewBox="[^"]*"/i.test(result)) {
    result = result.replace(/viewBox="[^"]*"/i, `viewBox="${vbStr}"`);
  } else {
    result = result.replace(/<svg\b/i, `<svg viewBox="${vbStr}"`);
  }

  if (/preserveAspectRatio="[^"]*"/i.test(result)) {
    result = result.replace(/preserveAspectRatio="[^"]*"/i, 'preserveAspectRatio="xMidYMid meet"');
  } else {
    result = result.replace(/<svg\b/i, '<svg preserveAspectRatio="xMidYMid meet"');
  }

  return result;
}

/** Sunucudan gelen SVG'yi tek beyaz arka planlı, dokunmatik pan/zoom görünümüne sarar. */
export function buildPortalRoadSvgPanZoomHtml(svgMarkup: string): string {
  const svg = focusRoadDiagramSvgOnParcel(String(svgMarkup || '').trim());
  if (!svg) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/></head><body style="margin:0;background:#fff;"></body></html>`;
  }

  const safeSvg = svg.replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #ffffff;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }
  #viewport {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    background: #ffffff;
  }
  #canvas {
    width: 100%;
    height: 100%;
    transform-origin: 0 0;
    will-change: transform;
  }
  #canvas svg {
    display: block;
    width: 100%;
    height: 100%;
    background: #ffffff;
  }
</style>
</head>
<body>
<div id="viewport"><div id="canvas">${safeSvg}</div></div>
<script>
(function () {
  var viewport = document.getElementById('viewport');
  var canvas = document.getElementById('canvas');
  if (!viewport || !canvas) return;

  var scale = 1;
  var tx = 0;
  var ty = 0;
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var pinchStartDist = 0;
  var pinchStartScale = 1;

  function applyTransform() {
    canvas.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
  }

  function dist(a, b) {
    var dx = a.clientX - b.clientX;
    var dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function resetView() {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  viewport.addEventListener('touchstart', function (ev) {
    if (ev.touches.length === 1) {
      dragging = true;
      lastX = ev.touches[0].clientX;
      lastY = ev.touches[0].clientY;
    } else if (ev.touches.length === 2) {
      dragging = false;
      pinchStartDist = dist(ev.touches[0], ev.touches[1]);
      pinchStartScale = scale;
    }
    ev.preventDefault();
  }, { passive: false });

  viewport.addEventListener('touchmove', function (ev) {
    if (ev.touches.length === 1 && dragging) {
      var cx = ev.touches[0].clientX;
      var cy = ev.touches[0].clientY;
      tx += cx - lastX;
      ty += cy - lastY;
      lastX = cx;
      lastY = cy;
      applyTransform();
    } else if (ev.touches.length === 2 && pinchStartDist > 0) {
      var nextDist = dist(ev.touches[0], ev.touches[1]);
      var nextScale = pinchStartScale * (nextDist / pinchStartDist);
      nextScale = Math.max(0.35, Math.min(nextScale, 14));
      var mx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
      var my = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
      tx = mx - ((mx - tx) / scale) * nextScale;
      ty = my - ((my - ty) / scale) * nextScale;
      scale = nextScale;
      applyTransform();
    }
    ev.preventDefault();
  }, { passive: false });

  viewport.addEventListener('touchend', function () {
    dragging = false;
    pinchStartDist = 0;
  });

  window.addEventListener('load', resetView);
  resetView();
  window.__ppRoadFit = resetView;
})();
</script>
</body>
</html>`;
}

export const PORTAL_ROAD_SVG_FIT_JS = 'window.__ppRoadFit && window.__ppRoadFit(); true;';
