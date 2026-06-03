/**
 * Shapes Layer Component
 * Şekilleri harita üzerinde render eden component
 */

import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import type { ShapeProperties } from './types';
import { shapeToFeature } from './ShapeDrawingManager';
import { getShapeCorners, getShapeBounds } from './shapeResizeUtils';
import { isOverlayVectorShape } from './overlayShapePolicy';

function hexToRgba(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const h = (hex || '').replace('#', '').trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return `rgba(15,23,42,${a})`;
}

function getFarthestCornerFromCenter(
  corners: [number, number][],
  center: [number, number]
): [number, number] | null {
  if (!corners || corners.length === 0) return null;
  let best: [number, number] = corners[0];
  let bestD = -Infinity;
  for (const c of corners) {
    const dx = c[0] - center[0];
    const dy = c[1] - center[1];
    const d = dx * dx + dy * dy;
    if (d > bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function getRotationHandlePosition(
  center: [number, number],
  angleDegrees: number | undefined,
  offsetDegrees: number
): [number, number] {
  // Varsayılan: merkezden "yukarı" (north) offset
  const angleRad = (((angleDegrees ?? 0) - 90) * Math.PI) / 180; // -90 => yukarı vektörü
  const dx = Math.cos(angleRad) * offsetDegrees;
  const dy = Math.sin(angleRad) * offsetDegrees;
  return [center[0] + dx, center[1] + dy];
}

interface ShapesLayerProps {
  shapes: ShapeProperties[];
  selectedShapeId: string | null;
  onShapePress?: (shapeId: string) => void;
  onHandlePress?: (shapeId: string, handleIndex: number) => void;
  Mapbox: any; // @rnmapbox/maps module
  cameraZoom?: number;
  /** true iken şekil/metin kutusu dokunmaları yok sayılır (harita mesafe/alan ölçümü vb.) */
  interactionLocked?: boolean;
}

/**
 * ShapesLayer Component
 * Tüm şekilleri Mapbox layer'ları olarak render eder
 */
export const ShapesLayer: React.FC<ShapesLayerProps> = ({
  shapes,
  selectedShapeId,
  onShapePress,
  onHandlePress,
  Mapbox,
  cameraZoom: _cameraZoomUnused,
  interactionLocked = false,
}) => {
  const fireShapePress = (shapeId: string) => {
    if (interactionLocked) return;
    onShapePress?.(shapeId);
  };
  const fireHandlePress = (shapeId: string, handleIndex: number) => {
    if (interactionLocked) return;
    onHandlePress?.(shapeId, handleIndex);
  };
  const shapePressHandler = interactionLocked ? undefined : (shapeId: string) => () => fireShapePress(shapeId);
  const handlePressHandler = interactionLocked
    ? undefined
    : (shapeId: string, handleIndex: number) => () => fireHandlePress(shapeId, handleIndex);
  if (!Mapbox) return null;

  return (
    <>
      {shapes.map((shape) => {
        if (shape.screenSpace) return null;
        const overlayVector = isOverlayVectorShape(shape);
        const feature = shapeToFeature(shape);
        const isSelected = selectedShapeId === shape.id;
        
        // Seçili şekil için farklı renkler
        const outlineColor = isSelected ? '#ef4444' : (shape.outlineColor || '#2563eb');
        const fillColor = isSelected ? '#f87171' : (shape.fillColor || '#3b82f6');
        const outlineWidth = isSelected ? (shape.outlineWidth || 2) + 1 : (shape.outlineWidth || 2);
        const fillOpacity = shape.fillOpacity !== undefined ? shape.fillOpacity : 0.5;

        // Resize handle'ları (sadece seçili şekiller için)
        const corners = isSelected ? (getShapeCorners(shape) as [number, number][]) : [];
        const bounds = isSelected ? getShapeBounds(shape) : null;
        const center = bounds?.center ?? ([0, 0] as [number, number]);
        const resizePos = isSelected && bounds ? getFarthestCornerFromCenter(corners, center) : null;
        const rotatePos =
          isSelected && bounds
            ? getRotationHandlePosition(center, (shape as any).rotation, 0.0008)
            : null;

        // Polygon şekilleri (rectangle, triangle, circle, ellipse, polygon)
        if (shape.geometry.type === 'Polygon') {
          return (
            <React.Fragment key={shape.id}>
              {!overlayVector ? (
                <Mapbox.ShapeSource
                  id={`shape-${shape.id}`}
                  shape={feature}
                  onPress={shapePressHandler?.(shape.id)}
                >
                  <Mapbox.FillLayer
                    id={`shape-fill-${shape.id}`}
                    style={{
                      fillColor,
                      fillOpacity,
                    }}
                  />
                  <Mapbox.LineLayer
                    id={`shape-stroke-${shape.id}`}
                    style={{
                      lineColor: outlineColor,
                      lineWidth: outlineWidth,
                    }}
                  />
                </Mapbox.ShapeSource>
              ) : null}

              {/* Sadece 2 Handle: Mavi (Resize) ve Yeşil (Rotation) */}
              {isSelected && bounds && corners.length > 0 && resizePos && rotatePos && (
                <>
                  {/* Mavi Resize Handle - Sağ üst köşede */}
                  <Mapbox.ShapeSource
                    key={`resize-handle-${shape.id}`}
                    id={`resize-handle-${shape.id}`}
                    shape={{
                      type: 'Feature',
                      geometry: {
                        type: 'Point',
                        coordinates: resizePos, // şeklin köşesine bağlı
                      },
                      properties: { 
                        isResizeHandle: true,
                        shapeId: shape.id,
                      },
                    }}
                      onPress={handlePressHandler?.(shape.id, 0)}
                  >
                    {/* Görsel: Kare ikon, Hit area: görünmez büyük circle */}
                    <Mapbox.SymbolLayer
                      id={`resize-handle-symbol-${shape.id}`}
                      style={{
                        textField: '■', // kare simgesi
                        textSize: 22,
                        textColor: '#3b82f6',
                        textHaloColor: '#ffffff',
                        textHaloWidth: 2,
                        textAnchor: 'center',
                        textAllowOverlap: true,
                      }}
                    />
                    <Mapbox.CircleLayer
                      id={`resize-handle-hit-${shape.id}`}
                      style={{
                        circleRadius: 35, // büyük hit area
                        circleColor: '#000000',
                        circleOpacity: 0, // görünmez
                      }}
                    />
                  </Mapbox.ShapeSource>
                  
                  {/* Yeşil Rotation Handle - Merkezin üstünde */}
                  {(shape.type === 'rectangle' || shape.type === 'triangle' || shape.type === 'polygon') && (
                    <Mapbox.ShapeSource
                      key={`rotation-handle-${shape.id}`}
                      id={`rotation-handle-${shape.id}`}
                      shape={{
                        type: 'Feature',
                        geometry: {
                          type: 'Point',
                          coordinates: rotatePos, // merkeze + rotation'a bağlı
                        },
                        properties: { 
                          isRotationHandle: true,
                          shapeId: shape.id,
                        },
                      }}
                      onPress={handlePressHandler?.(shape.id, -1)}
                    >
                    {/* Görsel: Daire ikon, Hit area: görünmez büyük circle */}
                    <Mapbox.SymbolLayer
                      id={`rotation-handle-symbol-${shape.id}`}
                      style={{
                        textField: '↻', // refresh/rotate simgesi (daha uyumlu)
                        textSize: 22,
                        textColor: '#10b981',
                        textHaloColor: '#ffffff',
                        textHaloWidth: 2,
                        textAnchor: 'center',
                        textAllowOverlap: true,
                      }}
                    />
                    <Mapbox.CircleLayer
                      id={`rotation-handle-hit-${shape.id}`}
                      style={{
                        circleRadius: 35,
                        circleColor: '#000000',
                        circleOpacity: 0,
                      }}
                    />
                    </Mapbox.ShapeSource>
                  )}
                </>
              )}
            </React.Fragment>
          );
        }

        // LineString şekilleri (line, arrow, pen, freehand)
        if (shape.geometry.type === 'LineString') {
          const isSketch = shape.type === "pen" || shape.type === "freehand";
          const arrowHead = overlayVector ? (shape as { arrowHead?: GeoJSON.Polygon }).arrowHead : null;
          return (
            <React.Fragment key={shape.id}>
              {!overlayVector ? (
                <Mapbox.ShapeSource
                  id={`shape-${shape.id}`}
                  shape={feature}
                  onPress={shapePressHandler?.(shape.id)}
                >
                  <Mapbox.LineLayer
                    id={`shape-line-${shape.id}`}
                    style={{
                      lineColor: outlineColor,
                      lineWidth: outlineWidth,
                    }}
                  />
                </Mapbox.ShapeSource>
              ) : (
                <>
                  <Mapbox.ShapeSource
                    id={`shape-hit-line-${shape.id}`}
                    shape={feature}
                    onPress={shapePressHandler?.(shape.id)}
                  >
                    <Mapbox.LineLayer
                      id={`shape-hit-line-layer-${shape.id}`}
                      style={{
                        lineColor: '#000000',
                        lineWidth: 36,
                        lineOpacity: 0.01,
                      }}
                    />
                  </Mapbox.ShapeSource>
                  {arrowHead ? (
                    <Mapbox.ShapeSource
                      id={`shape-hit-head-${shape.id}`}
                      shape={{
                        type: 'Feature',
                        geometry: arrowHead,
                        properties: { shapeId: shape.id },
                      }}
                      onPress={shapePressHandler?.(shape.id)}
                    >
                      <Mapbox.FillLayer
                        id={`shape-hit-head-fill-${shape.id}`}
                        style={{
                          fillColor: '#000000',
                          fillOpacity: 0.01,
                        }}
                      />
                    </Mapbox.ShapeSource>
                  ) : null}
                </>
              )}

              {/* LineString için: Sadece 2 Handle (Mavi Resize, Yeşil Rotation); kalem/serbest çok noktada handle yok */}
              {isSelected && !isSketch && bounds && corners.length > 0 && resizePos && rotatePos && (
                <>
                  {/* Mavi Resize Handle - Son noktada */}
                  <Mapbox.ShapeSource
                    key={`resize-handle-${shape.id}`}
                    id={`resize-handle-${shape.id}`}
                    shape={{
                      type: 'Feature',
                      geometry: {
                        type: 'Point',
                        coordinates: resizePos, // şekle bağlı uç
                      },
                      properties: { 
                        isResizeHandle: true,
                        shapeId: shape.id,
                      },
                    }}
                    onPress={handlePressHandler?.(shape.id, 0)}
                  >
                    <Mapbox.SymbolLayer
                      id={`resize-handle-symbol-${shape.id}`}
                      style={{
                        textField: '■',
                        textSize: 20,
                        textColor: '#3b82f6',
                        textHaloColor: '#ffffff',
                        textHaloWidth: 2,
                        textAnchor: 'center',
                        textAllowOverlap: true,
                      }}
                    />
                    <Mapbox.CircleLayer
                      id={`resize-handle-hit-${shape.id}`}
                      style={{
                        circleRadius: 28,
                        circleColor: '#000000',
                        circleOpacity: 0,
                      }}
                    />
                  </Mapbox.ShapeSource>
                  
                  {/* Yeşil Rotation Handle - Merkezin üstünde */}
                  <Mapbox.ShapeSource
                    key={`rotation-handle-${shape.id}`}
                    id={`rotation-handle-${shape.id}`}
                    shape={{
                      type: 'Feature',
                      geometry: {
                        type: 'Point',
                        coordinates: rotatePos,
                      },
                      properties: { 
                        isRotationHandle: true,
                        shapeId: shape.id,
                      },
                    }}
                    onPress={handlePressHandler?.(shape.id, -1)}
                  >
                    <Mapbox.SymbolLayer
                      id={`rotation-handle-symbol-${shape.id}`}
                      style={{
                        textField: '↻',
                        textSize: 20,
                        textColor: '#10b981',
                        textHaloColor: '#ffffff',
                        textHaloWidth: 2,
                        textAnchor: 'center',
                        textAllowOverlap: true,
                      }}
                    />
                    <Mapbox.CircleLayer
                      id={`rotation-handle-hit-${shape.id}`}
                      style={{
                        circleRadius: 28,
                        circleColor: '#000000',
                        circleOpacity: 0,
                      }}
                    />
                  </Mapbox.ShapeSource>
                </>
              )}
            </React.Fragment>
          );
        }

        // Point şekilleri (marker, textbox)
        if (shape.geometry.type === 'Point') {
          // TextBox: Ekrana dik (MarkerView) — pitch'te yere yatmaz
          if (shape.type === 'textbox') {
            const boxCenter = shape.geometry.coordinates as [number, number];

            return (
              <React.Fragment key={shape.id}>
                {/* Görsel + dokunma: TextBoxMapOverlay (MarkerView Android'de tıklamayı yutuyor) */}

                {/* TextBox: çapalarla boyut/yön yönetimi yok (sadece taşıma) */}
                {isSelected && (
                  <>
                    {/* Move handle (merkez) */}
                    <Mapbox.ShapeSource
                      key={`textbox-move-handle-${shape.id}`}
                      id={`textbox-move-handle-${shape.id}`}
                      shape={{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: boxCenter },
                        properties: { isMoveHandle: true, shapeId: shape.id },
                      }}
                      onPress={handlePressHandler?.(shape.id, 1)}
                    >
                      {/* Bilerek görünür ikon çizilmez (kullanıcı "sarı nokta" istemiyor) */}
                      <Mapbox.CircleLayer
                        id={`textbox-move-handle-hit-${shape.id}`}
                        style={{
                          circleRadius: 28,
                          circleColor: '#000000',
                          circleOpacity: 0,
                        }}
                      />
                    </Mapbox.ShapeSource>
                  </>
                )}
              </React.Fragment>
            );
          }

          if (shape.type === 'marker') {
            /* Görsel: PinMapOverlay (ekran billboard). Mapbox katmanı yok. */
            return null;
          }
        }

        return null;
      })}
    </>
  );
};
