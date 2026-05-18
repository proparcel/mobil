/**
 * Shape Resize and Rotation Utilities
 * Şekil boyutlandırma ve döndürme yardımcı fonksiyonları
 */

import type { ShapeHandle, ShapeProperties } from './types';

/**
 * Şeklin köşe noktalarını hesapla (resize handle'ları için)
 */
export function getShapeCorners(shape: ShapeProperties): [number, number][] {
  if (shape.geometry.type === 'Polygon') {
    const coords = shape.geometry.coordinates[0];
    // Son nokta ilk noktanın kopyası olabilir, onu çıkar
    const corners = coords.slice(0, -1);
    return corners as [number, number][];
  }
  
  if (shape.geometry.type === 'LineString') {
    return shape.geometry.coordinates as [number, number][];
  }
  
  if (shape.geometry.type === 'Point') {
    const point = shape.geometry.coordinates as [number, number];
    return [point];
  }
  
  return [];
}

function toFixedNumber(n: number): number {
  // RN/JS float drift'ini azaltmak için mikro düzeltme
  return Number.isFinite(n) ? Number(n.toFixed(12)) : n;
}

/** 0–360 aralığına (derece) */
export function normalizeAngleDeg(angle: number): number {
  const a = angle % 360;
  return a < 0 ? a + 360 : a;
}

export function getShapeCenter(shape: ShapeProperties): [number, number] {
  if (shape.geometry.type === 'Point') {
    return shape.geometry.coordinates as [number, number];
  }
  if (shape.geometry.type === 'LineString') {
    const coords = shape.geometry.coordinates as [number, number][];
    if (!coords.length) return [0, 0];
    // midpoint (2 nokta ise ortası; çok nokta ise bbox center)
    if (coords.length === 2) {
      return [(coords[0][0] + coords[1][0]) / 2, (coords[0][1] + coords[1][1]) / 2];
    }
  }
  return getShapeBounds(shape).center;
}

/**
 * Şeklin bounding box'ını hesapla
 */
export function getShapeBounds(shape: ShapeProperties): {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  center: [number, number];
} {
  const corners = getShapeCorners(shape);
  if (corners.length === 0) {
    return { minLon: 0, maxLon: 0, minLat: 0, maxLat: 0, center: [0, 0] };
  }
  
  const lons = corners.map(c => c[0]);
  const lats = corners.map(c => c[1]);
  
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  
  const center: [number, number] = [
    (minLon + maxLon) / 2,
    (minLat + maxLat) / 2,
  ];
  
  return { minLon, maxLon, minLat, maxLat, center };
}

/**
 * Noktayı bir merkez etrafında döndür
 */
export function rotatePoint(
  point: [number, number],
  center: [number, number],
  angleDegrees: number
): [number, number] {
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  
  const rotatedX = dx * cos - dy * sin;
  const rotatedY = dx * sin + dy * cos;
  
  return [
    center[0] + rotatedX,
    center[1] + rotatedY,
  ];
}

function rotatePointAroundOrigin(
  point: [number, number],
  angleDegrees: number
): [number, number] {
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const x = point[0];
  const y = point[1];
  return [x * cos - y * sin, x * sin + y * cos];
}

function scalePointAroundCenter(
  point: [number, number],
  center: [number, number],
  sx: number,
  sy: number
): [number, number] {
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return [center[0] + dx * sx, center[1] + dy * sy];
}

function transformPointLocal(
  point: [number, number],
  center: [number, number],
  rotationDeg: number,
  sx: number,
  sy: number
): [number, number] {
  // local = rotate(-rot), scale, rotate(+rot)
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  const [lx, ly] = rotatePointAroundOrigin([dx, dy], -rotationDeg);
  const [sx1, sy1] = [lx * sx, ly * sy];
  const [rx, ry] = rotatePointAroundOrigin([sx1, sy1], rotationDeg);
  return [center[0] + rx, center[1] + ry];
}

export function translateShape(shape: ShapeProperties, delta: [number, number]): ShapeProperties {
  const [dx, dy] = delta;
  if (shape.geometry.type === 'Point') {
    const p = shape.geometry.coordinates as [number, number];
    return {
      ...shape,
      geometry: { type: 'Point', coordinates: [toFixedNumber(p[0] + dx), toFixedNumber(p[1] + dy)] },
    };
  }
  if (shape.geometry.type === 'LineString') {
    const coords = shape.geometry.coordinates as [number, number][];
    const nextCoords = coords.map(([x, y]) => [toFixedNumber(x + dx), toFixedNumber(y + dy)] as [number, number]);
    const next: ShapeProperties = {
      ...shape,
      geometry: { type: 'LineString', coordinates: nextCoords },
    };
    // Arrow head güncelle
    if (shape.type === 'arrow' && coords.length >= 2) {
      const start = nextCoords[0];
      const end = nextCoords[nextCoords.length - 1];
      (next as any).arrowHead = computeArrowHeadPolygon(start, end);
    }
    return next;
  }
  if (shape.geometry.type === 'Polygon') {
    const ring = shape.geometry.coordinates[0] as [number, number][];
    const nextRing = ring.map(([x, y]) => [toFixedNumber(x + dx), toFixedNumber(y + dy)] as [number, number]);
    return {
      ...shape,
      geometry: { type: 'Polygon', coordinates: [nextRing] },
    };
  }
  return shape;
}

export function rotateShapeAround(
  shape: ShapeProperties,
  center: [number, number],
  angleDegrees: number
): ShapeProperties {
  const rot = normalizeAngleDeg(angleDegrees);
  if (shape.geometry.type === 'Point') {
    // Point geometry dönmez; sadece rotation property
    return { ...shape, rotation: rot };
  }
  if (shape.geometry.type === 'LineString') {
    const coords = shape.geometry.coordinates as [number, number][];
    const nextCoords = coords.map((p) => rotatePoint(p, center, rot));
    const next: ShapeProperties = {
      ...shape,
      geometry: { type: 'LineString', coordinates: nextCoords },
      rotation: rot,
    };
    if (shape.type === 'arrow' && nextCoords.length >= 2) {
      const start = nextCoords[0];
      const end = nextCoords[nextCoords.length - 1];
      (next as any).arrowHead = computeArrowHeadPolygon(start, end);
    }
    return next;
  }
  if (shape.geometry.type === 'Polygon') {
    const ring = shape.geometry.coordinates[0] as [number, number][];
    const nextRing = ring.map((p) => rotatePoint(p, center, rot));
    return {
      ...shape,
      geometry: { type: 'Polygon', coordinates: [nextRing] },
      rotation: rot,
    };
  }
  return shape;
}

export function scaleShapeAround(
  shape: ShapeProperties,
  center: [number, number],
  sx: number,
  sy: number,
  rotationDegForLocal?: number
): ShapeProperties {
  const useLocal = typeof rotationDegForLocal === 'number';
  const rot = rotationDegForLocal ?? 0;

  const mapPoint = (p: [number, number]) =>
    useLocal ? transformPointLocal(p, center, rot, sx, sy) : scalePointAroundCenter(p, center, sx, sy);

  if (shape.geometry.type === 'Point') {
    // Textbox gibi "parametrik" point şekillerde geometry'yi değil, boyut parametrelerini ölçekle
    if (shape.type === 'textbox') {
      const bw = typeof (shape as any).boxWidth === 'number' ? (shape as any).boxWidth : 0.001;
      const bh = typeof (shape as any).boxHeight === 'number' ? (shape as any).boxHeight : 0.0006;
      return {
        ...shape,
        boxWidth: Math.max(0.0001, bw * Math.abs(sx)),
        boxHeight: Math.max(0.0001, bh * Math.abs(sy)),
      };
    }
    return shape;
  }

  if (shape.geometry.type === 'LineString') {
    const coords = shape.geometry.coordinates as [number, number][];
    const nextCoords = coords.map(mapPoint);
    const next: ShapeProperties = {
      ...shape,
      geometry: { type: 'LineString', coordinates: nextCoords },
    };
    if (shape.type === 'arrow' && nextCoords.length >= 2) {
      const start = nextCoords[0];
      const end = nextCoords[nextCoords.length - 1];
      (next as any).arrowHead = computeArrowHeadPolygon(start, end);
    }
    return next;
  }

  if (shape.geometry.type === 'Polygon') {
    const ring = shape.geometry.coordinates[0] as [number, number][];
    const nextRing = ring.map(mapPoint);
    return { ...shape, geometry: { type: 'Polygon', coordinates: [nextRing] } };
  }

  return shape;
}

export function updatePolygonVertex(
  shape: ShapeProperties,
  vertexIndex: number,
  newPosition: [number, number]
): ShapeProperties {
  if (shape.geometry.type !== 'Polygon') return shape;
  const ring = shape.geometry.coordinates[0] as [number, number][];
  if (ring.length < 4) return shape; // minimum 3 + close
  const openLen = ring.length - 1; // last is close
  if (vertexIndex < 0 || vertexIndex >= openLen) return shape;

  const nextOpen = ring.slice(0, openLen) as [number, number][];
  nextOpen[vertexIndex] = newPosition;
  const nextRing = [...nextOpen, nextOpen[0]];
  return { ...shape, geometry: { type: 'Polygon', coordinates: [nextRing] } };
}

export function updateLineEndpoint(
  shape: ShapeProperties,
  endpointIndex: 0 | 1,
  newPosition: [number, number]
): ShapeProperties {
  if (shape.geometry.type !== 'LineString') return shape;
  const coords = shape.geometry.coordinates as [number, number][];
  if (coords.length < 2) return shape;
  const nextCoords = coords.slice() as [number, number][];
  if (endpointIndex === 0) nextCoords[0] = newPosition;
  else nextCoords[nextCoords.length - 1] = newPosition;

  const next: ShapeProperties = { ...shape, geometry: { type: 'LineString', coordinates: nextCoords } };
  if (shape.type === 'arrow') {
    const start = nextCoords[0];
    const end = nextCoords[nextCoords.length - 1];
    (next as any).arrowHead = computeArrowHeadPolygon(start, end);
  }
  return next;
}

/**
 * Arrow head polygon hesapla (LineString start/end'e göre)
 * Not: Mevcut sistemde derece bazlı basit yaklaşım kullanılıyor.
 */
export function computeArrowHeadPolygon(
  startPoint: [number, number],
  endPoint: [number, number]
): GeoJSON.Polygon {
  const dx = endPoint[0] - startPoint[0];
  const dy = endPoint[1] - startPoint[1];
  const angle = Math.atan2(dy, dx);
  const lengthDeg = Math.sqrt(dx * dx + dy * dy);
  const arrowHeadSize = Math.min(lengthDeg * 0.15, 0.001);
  const arrowHeadAngle1 = angle + Math.PI - Math.PI / 6;
  const arrowHeadAngle2 = angle + Math.PI + Math.PI / 6;

  const cosLat = Math.cos((endPoint[1] * Math.PI) / 180) || 1;
  const arrowHead1: [number, number] = [
    endPoint[0] + (arrowHeadSize * Math.cos(arrowHeadAngle1)) / cosLat,
    endPoint[1] + arrowHeadSize * Math.sin(arrowHeadAngle1),
  ];
  const arrowHead2: [number, number] = [
    endPoint[0] + (arrowHeadSize * Math.cos(arrowHeadAngle2)) / cosLat,
    endPoint[1] + arrowHeadSize * Math.sin(arrowHeadAngle2),
  ];

  return {
    type: 'Polygon',
    coordinates: [[endPoint, arrowHead1, arrowHead2, endPoint]],
  };
}

/**
 * TextBox için box polygon üret (Point + boxWidth/boxHeight + rotation)
 */
export function getTextBoxPolygon(shape: ShapeProperties): GeoJSON.Polygon | null {
  if (shape.type !== 'textbox' || shape.geometry.type !== 'Point') return null;
  const center = shape.geometry.coordinates as [number, number];
  const bw = typeof (shape as any).boxWidth === 'number' ? (shape as any).boxWidth : 0.001;
  const bh = typeof (shape as any).boxHeight === 'number' ? (shape as any).boxHeight : 0.0006;
  const rot = normalizeAngleDeg((shape as any).rotation ?? 0);
  const hw = bw / 2;
  const hh = bh / 2;
  const radius = typeof (shape as any).boxCornerRadius === 'number' ? (shape as any).boxCornerRadius : 0;
  const clampedRadius = Math.max(0, Math.min(radius, Math.min(hw, hh)));

  const ringLocal = createRoundedRectRingLocal(hw, hh, clampedRadius, 6);
  const ringWorld = ringLocal.map(([x, y]) => [center[0] + x, center[1] + y] as [number, number]);
  const ring = rot ? ringWorld.map((p) => rotatePoint(p, center, rot)) : ringWorld;
  return { type: 'Polygon', coordinates: [ring] };
}

/**
 * TextBox için gölge polygon'u (geo offset ile)
 */
export function getTextBoxShadowPolygon(shape: ShapeProperties): GeoJSON.Polygon | null {
  if (shape.type !== 'textbox' || shape.geometry.type !== 'Point') return null;
  const enabled = (shape as any).shadowEnabled !== false;
  const opacity = typeof (shape as any).shadowOpacity === 'number' ? (shape as any).shadowOpacity : 0;
  if (!enabled || opacity <= 0) return null;

  const center = shape.geometry.coordinates as [number, number];
  const ox = typeof (shape as any).shadowOffsetX === 'number' ? (shape as any).shadowOffsetX : 0.00004;
  const oy = typeof (shape as any).shadowOffsetY === 'number' ? (shape as any).shadowOffsetY : -0.00004;
  const shifted: ShapeProperties = {
    ...shape,
    geometry: { type: 'Point', coordinates: [center[0] + ox, center[1] + oy] },
  };
  return getTextBoxPolygon(shifted);
}

function createRoundedRectRingLocal(
  halfWidth: number,
  halfHeight: number,
  radius: number,
  arcSegments: number
): [number, number][] {
  // radius 0 ise düz dikdörtgen
  if (radius <= 0) {
    const pts: [number, number][] = [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [halfWidth, halfHeight],
      [-halfWidth, halfHeight],
      [-halfWidth, -halfHeight],
    ];
    return pts;
  }

  const r = Math.min(radius, Math.min(halfWidth, halfHeight));
  const x0 = -halfWidth + r;
  const x1 = halfWidth - r;
  const y0 = -halfHeight + r;
  const y1 = halfHeight - r;

  const pts: [number, number][] = [];
  const addArc = (cx: number, cy: number, startDeg: number, endDeg: number) => {
    const steps = Math.max(2, arcSegments);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = ((startDeg + (endDeg - startDeg) * t) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };

  // Saat yönünde: TL -> TR -> BR -> BL
  addArc(x0, y1, 180, 90); // top-left
  addArc(x1, y1, 90, 0); // top-right
  addArc(x1, y0, 0, -90); // bottom-right
  addArc(x0, y0, -90, -180); // bottom-left

  // Close ring
  pts.push(pts[0]);
  return pts;
}

export interface GetShapeHandlesOptions {
  polygonVertexEdit?: boolean;
  triangleVertexEdit?: boolean;
}

/**
 * Seçili shape için handle listesi üret
 */
export function getShapeHandles(
  shape: ShapeProperties,
  options: GetShapeHandlesOptions = {}
): ShapeHandle[] {
  const center = getShapeCenter(shape);
  const rot = normalizeAngleDeg((shape as any).rotation ?? 0);
  const bounds = getShapeBounds(shape);
  const handles: ShapeHandle[] = [
    { id: 'move', type: 'move', position: center, role: 'center' },
  ];

  const rotationAllowed =
    shape.type !== 'circle' && shape.type !== 'marker' && shape.type !== 'arrow';
  if (rotationAllowed) {
    // center'in "üstü" + rotation'a göre dönük
    const base: [number, number] = [center[0], center[1] + 0.0008];
    const pos = rot ? rotatePoint(base, center, rot) : base;
    handles.push({ id: 'rotate', type: 'rotate', position: pos, role: 'center' });
  }

  if (shape.type === 'circle') {
    const radiusDeg = Math.max(0.00005, bounds.maxLon - center[0]);
    handles.push({ id: 'radius', type: 'radius', position: [center[0] + radiusDeg, center[1]], role: 'edge' });
    return handles;
  }

  if (shape.type === 'ellipse') {
    const rx = Math.max(0.00005, (bounds.maxLon - bounds.minLon) / 2);
    const ry = Math.max(0.00005, (bounds.maxLat - bounds.minLat) / 2);
    const right: [number, number] = rot ? rotatePoint([center[0] + rx, center[1]], center, rot) : [center[0] + rx, center[1]];
    const left: [number, number] = rot ? rotatePoint([center[0] - rx, center[1]], center, rot) : [center[0] - rx, center[1]];
    const top: [number, number] = rot ? rotatePoint([center[0], center[1] + ry], center, rot) : [center[0], center[1] + ry];
    const bottom: [number, number] = rot ? rotatePoint([center[0], center[1] - ry], center, rot) : [center[0], center[1] - ry];
    handles.push({ id: 'axisX-r', type: 'axisX', position: right, role: 'edge' });
    handles.push({ id: 'axisX-l', type: 'axisX', position: left, role: 'edge' });
    handles.push({ id: 'axisY-t', type: 'axisY', position: top, role: 'edge' });
    handles.push({ id: 'axisY-b', type: 'axisY', position: bottom, role: 'edge' });
    return handles;
  }

  if (shape.type === 'line' || shape.type === 'arrow') {
    if (shape.geometry.type === 'LineString') {
      const coords = shape.geometry.coordinates as [number, number][];
      if (coords.length >= 2) {
        handles.push({ id: 'end-0', type: 'endpoint', position: coords[0], endpointIndex: 0, role: 'edge' });
        handles.push({ id: 'end-1', type: 'endpoint', position: coords[coords.length - 1], endpointIndex: 1, role: 'edge' });
      }
    }
    return handles;
  }

  if (shape.type === 'marker') {
    return handles;
  }

  if (shape.type === 'textbox') {
    const poly = getTextBoxPolygon(shape);
    if (poly) {
      const ring = poly.coordinates[0] as [number, number][];
      const corners = ring.slice(0, -1);
      corners.forEach((p, i) => {
        handles.push({ id: `tb-c${i}`, type: 'textboxScale', position: p, role: 'corner' });
      });
    }
    return handles;
  }

  // Polygon / Rectangle / Triangle / generic polygon-based scale/vertex
  if (shape.geometry.type === 'Polygon') {
    if (shape.type === 'triangle' && options.triangleVertexEdit) {
      const corners = getShapeCorners(shape);
      corners.forEach((p, i) => {
        handles.push({ id: `v-${i}`, type: 'vertex', position: p, vertexIndex: i, role: 'corner' });
      });
      return handles;
    }

    if (shape.type === 'polygon' && options.polygonVertexEdit) {
      const corners = getShapeCorners(shape);
      corners.forEach((p, i) => {
        handles.push({ id: `v-${i}`, type: 'vertex', position: p, vertexIndex: i, role: 'corner' });
      });
      return handles;
    }

    if (shape.type === 'rectangle') {
      const corners = getShapeCorners(shape);
      corners.forEach((p, i) => {
        handles.push({ id: `s-${i}`, type: 'scale', position: p, role: 'corner' });
      });
      return handles;
    }

    // Basit mod: bbox 4 köşe uniform scale
    const bboxCorners: [number, number][] = [
      [bounds.minLon, bounds.minLat],
      [bounds.maxLon, bounds.minLat],
      [bounds.maxLon, bounds.maxLat],
      [bounds.minLon, bounds.maxLat],
    ];
    bboxCorners.forEach((p, i) => {
      handles.push({ id: `s-bb-${i}`, type: 'scale', position: p, role: 'corner' });
    });
  }

  return handles;
}

/**
 * Şekli resize et (sağ üst köşeyi yeni pozisyona taşıyarak scale et)
 */
export function resizeShape(
  shape: ShapeProperties,
  newTopRightPosition: [number, number]
): ShapeProperties {
  const bounds = getShapeBounds(shape);
  const corners = getShapeCorners(shape);
  
  if (corners.length === 0) return shape;
  
  // Mevcut sağ üst köşe pozisyonu
  const currentTopRight: [number, number] = [bounds.maxLon, bounds.maxLat];
  
  // Scale faktörlerini hesapla
  const scaleX = (newTopRightPosition[0] - bounds.center[0]) / (currentTopRight[0] - bounds.center[0]);
  const scaleY = (newTopRightPosition[1] - bounds.center[1]) / (currentTopRight[1] - bounds.center[1]);
  
  // Tüm köşeleri scale et (merkez etrafında)
  const scaledCorners = corners.map(corner => {
    const dx = corner[0] - bounds.center[0];
    const dy = corner[1] - bounds.center[1];
    return [
      bounds.center[0] + dx * scaleX,
      bounds.center[1] + dy * scaleY,
    ] as [number, number];
  });
  
  // Şekil tipine göre geometry'yi güncelle
  if (shape.geometry.type === 'Polygon') {
    const closedCorners = [...scaledCorners, scaledCorners[0]];
    return {
      ...shape,
      geometry: {
        type: 'Polygon',
        coordinates: [closedCorners],
      },
    };
  }
  
  if (shape.geometry.type === 'LineString') {
    const next: ShapeProperties = {
      ...shape,
      geometry: {
        type: 'LineString',
        coordinates: scaledCorners,
      },
    };
    if (shape.type === 'arrow' && scaledCorners.length >= 2) {
      const start = scaledCorners[0];
      const end = scaledCorners[scaledCorners.length - 1];
      (next as any).arrowHead = computeArrowHeadPolygon(start, end);
    }
    return next;
  }
  
  return shape;
}

/**
 * Şekli döndür
 */
export function rotateShape(
  shape: ShapeProperties,
  angleDegrees: number
): ShapeProperties {
  const bounds = getShapeBounds(shape);
  const corners = getShapeCorners(shape);
  
  if (corners.length === 0) return shape;
  
  // Tüm köşeleri döndür
  const rotatedCorners = corners.map(corner =>
    rotatePoint(corner, bounds.center, angleDegrees)
  );
  
  // Şekil tipine göre geometry'yi güncelle
  if (shape.geometry.type === 'Polygon') {
    const closedCorners = [...rotatedCorners, rotatedCorners[0]];
    return {
      ...shape,
      geometry: {
        type: 'Polygon',
        coordinates: [closedCorners],
      },
      rotation: angleDegrees,
    };
  }
  
  if (shape.geometry.type === 'LineString') {
    const next: ShapeProperties = {
      ...shape,
      geometry: {
        type: 'LineString',
        coordinates: rotatedCorners,
      },
      rotation: angleDegrees,
    };
    if (shape.type === 'arrow' && rotatedCorners.length >= 2) {
      const start = rotatedCorners[0];
      const end = rotatedCorners[rotatedCorners.length - 1];
      (next as any).arrowHead = computeArrowHeadPolygon(start, end);
    }
    return next;
  }
  
  return shape;
}

/**
 * En yakın handle'ı bul (touch pozisyonuna göre)
 */
export function findNearestHandle(
  shape: ShapeProperties,
  touchPosition: [number, number],
  threshold: number = 0.002 // ~200 metre - daha geniş threshold
): number | null {
  const corners = getShapeCorners(shape);
  if (corners.length === 0) return null;
  
  let minDistance = Infinity;
  let nearestIndex: number | null = null;
  
  for (let i = 0; i < corners.length; i++) {
    const corner = corners[i];
    const distance = Math.sqrt(
      Math.pow(corner[0] - touchPosition[0], 2) +
      Math.pow(corner[1] - touchPosition[1], 2)
    );
    
    if (distance < minDistance && distance < threshold) {
      minDistance = distance;
      nearestIndex = i;
    }
  }
  
  return nearestIndex;
}
