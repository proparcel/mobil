/**
 * Shape Drawing Manager
 * Şekil çizim yönetimi ve handler'ları
 */

import type { ShapeType, ShapeProperties, DrawShapeOptions } from './types';
import { computeArrowHeadPolygon } from './shapeResizeUtils';
import { layoutFieldsForTextBox } from './textBoxLayout';

/**
 * GeoJSON Feature helper
 */
export interface ShapeFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJSON.Geometry;
  properties: {
    shapeId: string;
    shapeType: ShapeType;
    outlineColor?: string;
    fillColor?: string;
    outlineWidth?: number;
    fillOpacity?: number;
    text?: string;
    [key: string]: any;
  };
}

/**
 * Rectangle (Kare/Dikdörtgen) çizim
 * İki nokta ile: başlangıç ve bitiş noktaları
 */
export function createRectangleShape(
  startPoint: [number, number], // [lon, lat]
  endPoint: [number, number],
  options: DrawShapeOptions = {}
): ShapeProperties {
  const shapeId = `shape-rectangle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // En uzun kenarı referans al (kare için)
  const deltaLon = Math.abs(endPoint[0] - startPoint[0]);
  const deltaLat = Math.abs(endPoint[1] - startPoint[1]);
  const maxDim = Math.max(deltaLon, deltaLat);
  
  // Rectangle köşeleri
  const coordinates: [number, number][] = [
    startPoint,
    [startPoint[0] + (endPoint[0] >= startPoint[0] ? maxDim : -maxDim), startPoint[1]],
    [startPoint[0] + (endPoint[0] >= startPoint[0] ? maxDim : -maxDim), startPoint[1] + (endPoint[1] >= startPoint[1] ? maxDim : -maxDim)],
    [startPoint[0], startPoint[1] + (endPoint[1] >= startPoint[1] ? maxDim : -maxDim)],
    startPoint, // Kapat
  ];
  
  return {
    id: shapeId,
    type: 'rectangle',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    outlineColor: options.outlineColor || '#2563eb',
    fillColor: options.fillColor || '#3b82f6',
    outlineWidth: options.outlineWidth || 2,
    fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.5,
  };
}

/**
 * Triangle (Üçgen) çizim
 * Üç nokta ile
 */
export function createTriangleShape(
  point1: [number, number],
  point2: [number, number],
  point3: [number, number],
  options: DrawShapeOptions = {}
): ShapeProperties {
  const shapeId = `shape-triangle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const coordinates: [number, number][] = [point1, point2, point3, point1]; // Kapat
  
  return {
    id: shapeId,
    type: 'triangle',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    outlineColor: options.outlineColor || '#2563eb',
    fillColor: options.fillColor || '#3b82f6',
    outlineWidth: options.outlineWidth || 2,
    fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.5,
  };
}

/**
 * Circle (Yuvarlak) çizim
 * İki nokta ile: merkez ve yarıçap noktası
 */
export function createCircleShape(
  center: [number, number],
  radiusPoint: [number, number],
  options: DrawShapeOptions = {}
): ShapeProperties {
  const shapeId = `shape-circle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Yarıçap hesapla (Haversine formülü)
  const radius = calculateDistance(center, radiusPoint);
  
  // Circle'ı polygon olarak çiz (64 nokta ile)
  const coordinates: [number, number][] = [];
  const numPoints = 64;
  
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const lat = center[1] + (radius / 111320) * Math.cos(angle); // 111320 metre = 1 derece lat
    const lon = center[0] + (radius / (111320 * Math.cos(center[1] * Math.PI / 180))) * Math.sin(angle);
    coordinates.push([lon, lat]);
  }
  
  return {
    id: shapeId,
    type: 'circle',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    outlineColor: options.outlineColor || '#2563eb',
    fillColor: options.fillColor || '#3b82f6',
    outlineWidth: options.outlineWidth || 2,
    fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.5,
  };
}

/**
 * Ellipse (Elips) çizim
 * Üç nokta ile: merkez, birinci eksen, ikinci eksen
 */
export function createEllipseShape(
  center: [number, number],
  axis1Point: [number, number],
  axis2Point: [number, number],
  options: DrawShapeOptions = {}
): ShapeProperties {
  const shapeId = `shape-ellipse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Eksen uzunlukları
  const a = calculateDistance(center, axis1Point);
  const b = calculateDistance(center, axis2Point);
  
  // Elips açısı (birinci eksenin yönü)
  const angle = Math.atan2(axis1Point[1] - center[1], axis1Point[0] - center[0]);
  const angleDeg = (angle * 180) / Math.PI;
  
  // Elips'i polygon olarak çiz (64 nokta ile)
  const coordinates: [number, number][] = [];
  const numPoints = 64;
  
  for (let i = 0; i <= numPoints; i++) {
    const t = (i / numPoints) * 2 * Math.PI;
    const x = a * Math.cos(t);
    const y = b * Math.sin(t);
    
    // Rotate
    const rotatedX = x * Math.cos(angle) - y * Math.sin(angle);
    const rotatedY = x * Math.sin(angle) + y * Math.cos(angle);
    
    const lat = center[1] + (rotatedY / 111320);
    const lon = center[0] + (rotatedX / (111320 * Math.cos(center[1] * Math.PI / 180)));
    coordinates.push([lon, lat]);
  }
  
  return {
    id: shapeId,
    type: 'ellipse',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    outlineColor: options.outlineColor || '#2563eb',
    fillColor: options.fillColor || '#3b82f6',
    outlineWidth: options.outlineWidth || 2,
    fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.5,
    rotation: angleDeg,
  };
}

/**
 * Polygon (Çokgen) çizim
 * Çoklu nokta ile
 */
export function createPolygonShape(
  points: [number, number][],
  options: DrawShapeOptions = {}
): ShapeProperties {
  const shapeId = `shape-polygon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Kapat (ilk noktayı sona ekle)
  const coordinates = [...points];
  if (points.length > 0 && (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1])) {
    coordinates.push(points[0]);
  }
  
  return {
    id: shapeId,
    type: 'polygon',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    outlineColor: options.outlineColor || '#2563eb',
    fillColor: options.fillColor || '#3b82f6',
    outlineWidth: options.outlineWidth || 2,
    fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.5,
  };
}

/**
 * Line (Çizgi) çizim
 * Çoklu nokta ile
 */
export function createLineShape(
  points: [number, number][],
  options: DrawShapeOptions = {}
): ShapeProperties {
  const shapeId = `shape-line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: shapeId,
    type: 'line',
    geometry: {
      type: 'LineString',
      coordinates: points,
    },
    outlineColor: options.outlineColor || '#2563eb',
    outlineWidth: options.outlineWidth || 2,
  };
}

/**
 * Arrow (Ok) çizim
 * İki nokta ile: başlangıç ve bitiş (ok başı otomatik)
 */
export function createArrowShape(
  startPoint: [number, number],
  endPoint: [number, number],
  options: DrawShapeOptions = {}
): ShapeProperties {
  const shapeId = `shape-arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const arrowHead = computeArrowHeadPolygon(startPoint, endPoint);
  
  // Line + Arrow head (polygon)
  return {
    id: shapeId,
    type: 'arrow',
    geometry: {
      type: 'LineString',
      coordinates: [startPoint, endPoint],
    },
    outlineColor: options.outlineColor || '#2563eb',
    outlineWidth: options.outlineWidth || 2,
    // Arrow head için ek geometry (render'da kullanılacak)
    arrowHead,
  };
}

/**
 * Marker (Nokta) çizim
 * Tek nokta ile
 */
export function createMarkerShape(
  point: [number, number],
  options: DrawShapeOptions = {}
): ShapeProperties {
  const shapeId = `shape-marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: shapeId,
    type: 'marker',
    geometry: {
      type: 'Point',
      coordinates: point,
    },
    outlineColor: options.outlineColor || '#2563eb',
    fillColor: options.fillColor || '#3b82f6',
  };
}

/**
 * TextBox (Metin Kutusu) çizim
 * Tek nokta + metin ile
 */
export function createTextBoxShape(
  point: [number, number],
  text: string,
  options: DrawShapeOptions = {}
): ShapeProperties {
  const shapeId = `shape-textbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const base: ShapeProperties = {
    id: shapeId,
    type: 'textbox',
    geometry: {
      type: 'Point',
      coordinates: point,
    },
    text: text || options.text || '',
    outlineColor: options.outlineColor || '#2563eb',
    fillColor: options.fillColor || '#0f172a',
    boxWidth: 0.0012,
    boxHeight: 0.0007,
    boxCornerRadius: 0.00008,
    rotation: 0,
    fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.85,
    outlineWidth: options.outlineWidth || 2,
    textColor: '#ffffff',
    textSize: 14,
    textAlign: 'center',
    boxFillEnabled: true,
    boxCornerRadiusPx: 6,
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowOffsetX: 0.00005,
    shadowOffsetY: -0.00005,
  };
  return { ...base, ...layoutFieldsForTextBox(base) };
}

/**
 * Kalem / serbest çizim: çoklu nokta LineString (harita veya ekran normalize koordinat)
 */
export function createPenFreehandShape(
  points: [number, number][],
  kind: "pen" | "freehand",
  options: DrawShapeOptions = {},
  screenSpace = false
): ShapeProperties {
  const shapeId = `shape-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: shapeId,
    type: kind,
    geometry: {
      type: "LineString",
      coordinates: points,
    },
    outlineColor: options.outlineColor || "#2563eb",
    outlineWidth: options.outlineWidth ?? 3,
    screenSpace,
  };
}

/**
 * Shape'i Mapbox Feature'a dönüştür
 */
export function shapeToFeature(shape: ShapeProperties): ShapeFeature {
  return {
    type: 'Feature',
    id: shape.id,
    geometry: shape.geometry,
    properties: {
      shapeId: shape.id,
      shapeType: shape.type,
      outlineColor: shape.outlineColor,
      fillColor: shape.fillColor,
      outlineWidth: shape.outlineWidth,
      fillOpacity: shape.fillOpacity,
      text: shape.text,
    },
  };
}

/**
 * Haversine formülü ile mesafe hesaplama (metre cinsinden)
 */
function calculateDistance(point1: [number, number], point2: [number, number]): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (point2[1] - point1[1]) * Math.PI / 180;
  const dLon = (point2[0] - point1[0]) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1[1] * Math.PI / 180) * Math.cos(point2[1] * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
