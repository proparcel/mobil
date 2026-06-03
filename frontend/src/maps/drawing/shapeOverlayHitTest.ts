import type { ShapeProperties } from "./types";
import type { ProjectedShapeGeometry, ScreenPoint } from "./shapeScreenProjection";
import { getOverlayStrokeWidth } from "./mapOverlayStyles";
import { isOverlayVectorShape } from "./overlayShapePolicy";

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function pointInPolygon(x: number, y: number, ring: ScreenPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function hitTestProjectedGeometry(
  tx: number,
  ty: number,
  geom: ProjectedShapeGeometry,
  shape: ShapeProperties
): boolean {
  const threshold = getOverlayStrokeWidth(shape, false) + 12;

  if (geom.arrow) {
    const { shaftPoints, head, mainWidth } = geom.arrow;
    if (pointInPolygon(tx, ty, head.main)) return true;
    for (let i = 1; i < shaftPoints.length; i++) {
      const d = distToSegment(
        tx,
        ty,
        shaftPoints[i - 1][0],
        shaftPoints[i - 1][1],
        shaftPoints[i][0],
        shaftPoints[i][1]
      );
      if (d <= threshold + mainWidth / 2) return true;
    }
    return false;
  }

  for (const ring of geom.polygons) {
    if (pointInPolygon(tx, ty, ring)) return true;
  }

  for (const line of geom.polylines) {
    for (let i = 1; i < line.length; i++) {
      const d = distToSegment(tx, ty, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
      if (d <= threshold) return true;
    }
  }

  return false;
}

export function hitTestOverlayVectorAtScreenPoint(
  tap: ScreenPoint,
  shapes: ShapeProperties[],
  projected: Record<string, ProjectedShapeGeometry>
): string | null {
  const [tx, ty] = tap;

  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (!isOverlayVectorShape(shape)) continue;
    const geom = projected[shape.id];
    if (!geom) continue;
    if (hitTestProjectedGeometry(tx, ty, geom, shape)) {
      return shape.id;
    }
  }

  return null;
}
