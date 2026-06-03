import type { ScreenPoint } from "./shapeScreenProjection";
import type { MapArrowVariant } from "./mapArrowStyles";

export type ArrowHeadLayers = {
  shadow: ScreenPoint[];
  main: ScreenPoint[];
  highlight: ScreenPoint[];
  stroke: ScreenPoint[];
};

export type PremiumArrowPaths = {
  bodyPath: string;
  highlightPath: string;
  headPath: string;
  headHighlightPath: string;
};

export type ArrowScreenModel = {
  variant: MapArrowVariant;
  start: ScreenPoint;
  tip: ScreenPoint;
  angle: number;
  mainWidth: number;
  shaftPoints: ScreenPoint[];
  shaftPath: string;
  head: ArrowHeadLayers;
  grad: { x1: number; y1: number; x2: number; y2: number };
  premium: PremiumArrowPaths;
};

const HEAD_LENGTH_FACTOR = 5.5;
const HEAD_WIDTH_FACTOR = 3.8;
/** Ok başı çentik: taban merkezinden uca doğru (buildAggressiveArrowHead ile aynı) */
const HEAD_NOTCH_FORWARD = 0.28;
/** Gövde kalınlığı = strokeWidth × bu katsayı (ok başı aynı oranda küçülür) */
const BODY_WIDTH_PER_STROKE = 4;

function computeShaftEnd(
  tip: ScreenPoint,
  tangent: { x: number; y: number },
  bodyWidth: number
): ScreenPoint {
  const headLength = bodyWidth * HEAD_LENGTH_FACTOR;
  // Kuyruk, baş çentiğinde biter; yuvarlak cap ucu hafif geride kalır (uca taşmaz)
  const notchInsetFromTip = headLength * (1 - HEAD_NOTCH_FORWARD);
  const inset = Math.max(bodyWidth * 0.5, notchInsetFromTip - bodyWidth * 0.06);
  return pt(tip[0] - tangent.x * inset, tip[1] - tangent.y * inset);
}

function normalizeVec(vx: number, vy: number) {
  const len = Math.hypot(vx, vy) || 1;
  return { x: vx / len, y: vy / len };
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function pt(x: number, y: number): ScreenPoint {
  return [x, y];
}

function offsetRing(ring: ScreenPoint[], ox: number, oy: number): ScreenPoint[] {
  return ring.map(([x, y]) => [x + ox, y + oy] as ScreenPoint);
}

function sampleLine(start: ScreenPoint, end: ScreenPoint, steps: number): ScreenPoint[] {
  const out: ScreenPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
  }
  return out;
}

function sampleQuadratic(start: ScreenPoint, control: ScreenPoint, end: ScreenPoint, steps: number): ScreenPoint[] {
  const out: ScreenPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
    ]);
  }
  return out;
}

function sampleCubic(
  start: ScreenPoint,
  c1: ScreenPoint,
  c2: ScreenPoint,
  end: ScreenPoint,
  steps: number
): ScreenPoint[] {
  const out: ScreenPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * u * start[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end[0],
      u * u * u * start[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end[1],
    ]);
  }
  return out;
}

function samplePolyline(points: ScreenPoint[], stepsPerSeg: number): ScreenPoint[] {
  if (points.length < 2) return points;
  const out: ScreenPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const seg = sampleLine(points[i - 1], points[i], stepsPerSeg);
    if (out.length) seg.shift();
    out.push(...seg);
  }
  return out;
}

type BodyGeometry = {
  bodyPath: string;
  highlightPath: string;
  shaftPoints: ScreenPoint[];
  tangent: { x: number; y: number };
  /** Quadratic highlight için kontrol noktası */
  highlightControl?: ScreenPoint;
  highlightEnd: ScreenPoint;
};

function buildBodyGeometry(
  variant: MapArrowVariant,
  start: ScreenPoint,
  tip: ScreenPoint,
  bodyWidth: number
): BodyGeometry {
  const sx = start[0];
  const sy = start[1];
  const ex = tip[0];
  const ey = tip[1];
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const dir = normalizeVec(dx, dy);
  const normal = { x: -dir.y, y: dir.x };
  const side = normal;
  const highlightOffset = bodyWidth * 0.22;

  if (variant === "classic") {
    const tangent = dir;
    const shaftEnd = computeShaftEnd(tip, tangent, bodyWidth);
    const bodyPath = `M ${fmt(sx)} ${fmt(sy)} L ${fmt(shaftEnd[0])} ${fmt(shaftEnd[1])}`;
    const baseCenter = pt(ex - tangent.x * bodyWidth * HEAD_LENGTH_FACTOR, ey - tangent.y * bodyWidth * HEAD_LENGTH_FACTOR);
    const highlightStart = pt(
      sx + side.x * highlightOffset + tangent.x * bodyWidth * 0.4,
      sy + side.y * highlightOffset + tangent.y * bodyWidth * 0.4
    );
    const highlightEnd = pt(baseCenter[0] + side.x * highlightOffset, baseCenter[1] + side.y * highlightOffset);
    const highlightPath = `M ${fmt(highlightStart[0])} ${fmt(highlightStart[1])} L ${fmt(highlightEnd[0])} ${fmt(highlightEnd[1])}`;
    return {
      bodyPath,
      highlightPath,
      shaftPoints: sampleLine(start, shaftEnd, 20),
      tangent,
      highlightEnd,
    };
  }

  if (variant === "arc") {
    const curveAmount = Math.min(120, Math.max(40, len * 0.12));
    const control = pt((sx + ex) / 2 + normal.x * curveAmount, (sy + ey) / 2 + normal.y * curveAmount);
    const tangent = normalizeVec(ex - control[0], ey - control[1]);
    const headLength = bodyWidth * HEAD_LENGTH_FACTOR;
    const shaftEnd = computeShaftEnd(tip, tangent, bodyWidth);
    const bodyPath = `M ${fmt(sx)} ${fmt(sy)} Q ${fmt(control[0])} ${fmt(control[1])} ${fmt(shaftEnd[0])} ${fmt(shaftEnd[1])}`;
    const baseCenter = pt(ex - tangent.x * headLength, ey - tangent.y * headLength);
    const highlightStart = pt(
      sx + side.x * highlightOffset + tangent.x * bodyWidth * 0.4,
      sy + side.y * highlightOffset + tangent.y * bodyWidth * 0.4
    );
    const highlightControl = pt(control[0] + side.x * highlightOffset, control[1] + side.y * highlightOffset);
    const highlightEnd = pt(baseCenter[0] + side.x * highlightOffset, baseCenter[1] + side.y * highlightOffset);
    const highlightPath = `M ${fmt(highlightStart[0])} ${fmt(highlightStart[1])} Q ${fmt(highlightControl[0])} ${fmt(highlightControl[1])} ${fmt(highlightEnd[0])} ${fmt(highlightEnd[1])}`;
    return {
      bodyPath,
      highlightPath,
      shaftPoints: sampleQuadratic(start, control, shaftEnd, 28),
      tangent,
      highlightControl,
      highlightEnd,
    };
  }

  if (variant === "curvy") {
    const cp1 = pt(sx + dx * 0.3, sy - dy * 0.4);
    const cp2 = pt(sx + dx * 0.7, sy + dy * 0.25);
    const tangent = normalizeVec(ex - cp2[0], ey - cp2[1]);
    const headLength = bodyWidth * HEAD_LENGTH_FACTOR;
    const shaftEnd = computeShaftEnd(tip, tangent, bodyWidth);
    const bodyPath = [
      `M ${fmt(sx)} ${fmt(sy)}`,
      `C ${fmt(cp1[0])} ${fmt(cp1[1])}, ${fmt(cp2[0])} ${fmt(cp2[1])}, ${fmt(shaftEnd[0])} ${fmt(shaftEnd[1])}`,
    ].join(" ");
    const baseCenter = pt(ex - tangent.x * headLength, ey - tangent.y * headLength);
    const hStart = pt(
      sx + side.x * highlightOffset + tangent.x * bodyWidth * 0.4,
      sy + side.y * highlightOffset + tangent.y * bodyWidth * 0.4
    );
    const hCp1 = pt(cp1[0] + side.x * highlightOffset, cp1[1] + side.y * highlightOffset);
    const hCp2 = pt(cp2[0] + side.x * highlightOffset, cp2[1] + side.y * highlightOffset);
    const highlightEnd = pt(baseCenter[0] + side.x * highlightOffset, baseCenter[1] + side.y * highlightOffset);
    const highlightPath = [
      `M ${fmt(hStart[0])} ${fmt(hStart[1])}`,
      `C ${fmt(hCp1[0])} ${fmt(hCp1[1])}, ${fmt(hCp2[0])} ${fmt(hCp2[1])}, ${fmt(highlightEnd[0])} ${fmt(highlightEnd[1])}`,
    ].join(" ");
    return {
      bodyPath,
      highlightPath,
      shaftPoints: sampleCubic(start, cp1, cp2, shaftEnd, 32),
      tangent,
      highlightEnd,
    };
  }

  // sharp — keskin dönüş (L şekli)
  const corner = pt(sx + dx * 0.55, sy);
  const tangent = normalizeVec(ex - corner[0], ey - corner[1]);
  const headLength = bodyWidth * HEAD_LENGTH_FACTOR;
  const shaftEnd = computeShaftEnd(tip, tangent, bodyWidth);
  const bodyPath = `M ${fmt(sx)} ${fmt(sy)} L ${fmt(corner[0])} ${fmt(corner[1])} L ${fmt(shaftEnd[0])} ${fmt(shaftEnd[1])}`;
  const baseCenter = pt(ex - tangent.x * headLength, ey - tangent.y * headLength);
  const hStart = pt(
    sx + side.x * highlightOffset + tangent.x * bodyWidth * 0.4,
    sy + side.y * highlightOffset + tangent.y * bodyWidth * 0.4
  );
  const hCorner = pt(corner[0] + side.x * highlightOffset, corner[1] + side.y * highlightOffset);
  const highlightEnd = pt(baseCenter[0] + side.x * highlightOffset, baseCenter[1] + side.y * highlightOffset);
  const highlightPath = `M ${fmt(hStart[0])} ${fmt(hStart[1])} L ${fmt(hCorner[0])} ${fmt(hCorner[1])} L ${fmt(highlightEnd[0])} ${fmt(highlightEnd[1])}`;
  return {
    bodyPath,
    highlightPath,
    shaftPoints: samplePolyline([start, corner, shaftEnd], 14),
    tangent,
    highlightEnd,
  };
}

function buildAggressiveArrowHead(
  tip: ScreenPoint,
  tangent: { x: number; y: number },
  bodyWidth: number
): { headPath: string; headHighlightPath: string; headMain: ScreenPoint[] } {
  const ex = tip[0];
  const ey = tip[1];
  const side = { x: -tangent.y, y: tangent.x };
  const headLength = bodyWidth * HEAD_LENGTH_FACTOR;
  const headWidth = bodyWidth * HEAD_WIDTH_FACTOR;

  const baseCenter = pt(ex - tangent.x * headLength, ey - tangent.y * headLength);
  const leftWing = pt(
    baseCenter[0] + side.x * headWidth * 0.52,
    baseCenter[1] + side.y * headWidth * 0.52
  );
  const rightWing = pt(
    baseCenter[0] - side.x * headWidth * 0.52,
    baseCenter[1] - side.y * headWidth * 0.52
  );
  const notch = pt(
    baseCenter[0] + tangent.x * headLength * HEAD_NOTCH_FORWARD,
    baseCenter[1] + tangent.y * headLength * HEAD_NOTCH_FORWARD
  );
  const innerLeft = pt(
    notch[0] + side.x * bodyWidth * 0.45,
    notch[1] + side.y * bodyWidth * 0.45
  );
  const innerRight = pt(
    notch[0] - side.x * bodyWidth * 0.45,
    notch[1] - side.y * bodyWidth * 0.45
  );

  const headPath = [
    `M ${fmt(ex)} ${fmt(ey)}`,
    `L ${fmt(leftWing[0])} ${fmt(leftWing[1])}`,
    `L ${fmt(innerLeft[0])} ${fmt(innerLeft[1])}`,
    `L ${fmt(notch[0])} ${fmt(notch[1])}`,
    `L ${fmt(innerRight[0])} ${fmt(innerRight[1])}`,
    `L ${fmt(rightWing[0])} ${fmt(rightWing[1])}`,
    "Z",
  ].join(" ");

  const headHighlightPath = [
    `M ${fmt(ex - tangent.x * headLength * 0.28)} ${fmt(ey - tangent.y * headLength * 0.28)}`,
    `L ${fmt(leftWing[0] * 0.65 + ex * 0.35)} ${fmt(leftWing[1] * 0.65 + ey * 0.35)}`,
    `L ${fmt(notch[0] + side.x * bodyWidth * 0.3)} ${fmt(notch[1] + side.y * bodyWidth * 0.3)}`,
    "Z",
  ].join(" ");

  const headMain: ScreenPoint[] = [tip, leftWing, innerLeft, notch, innerRight, rightWing];
  return { headPath, headHighlightPath, headMain };
}

export function buildArrowScreenModel(
  start: ScreenPoint,
  tip: ScreenPoint,
  strokeWidth: number,
  variant: MapArrowVariant = "classic"
): ArrowScreenModel | null {
  const sx = start[0];
  const sy = start[1];
  const ex = tip[0];
  const ey = tip[1];
  const len = Math.hypot(ex - sx, ey - sy);
  if (len < 4) return null;

  const sw = Math.max(2, strokeWidth);
  const lengthFactor = Math.max(0.65, Math.min(1.3, len / 180));
  const bodyWidth = Math.max(4, Math.min(32, sw * BODY_WIDTH_PER_STROKE * lengthFactor));
  const body = buildBodyGeometry(variant, start, tip, bodyWidth);
  const { headPath, headHighlightPath, headMain } = buildAggressiveArrowHead(tip, body.tangent, bodyWidth);
  const headTheta = Math.atan2(body.tangent.y, body.tangent.x);

  return {
    variant,
    start: [sx, sy],
    tip: [ex, ey],
    angle: headTheta,
    mainWidth: bodyWidth,
    shaftPoints: body.shaftPoints,
    shaftPath: body.bodyPath,
    head: {
      shadow: offsetRing(headMain, 4, 6),
      main: headMain,
      highlight: [],
      stroke: headMain,
    },
    grad: { x1: sx, y1: sy, x2: ex, y2: ey },
    premium: {
      bodyPath: body.bodyPath,
      highlightPath: body.highlightPath,
      headPath,
      headHighlightPath,
    },
  };
}

export function pointsToSvg(points: ScreenPoint[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}
