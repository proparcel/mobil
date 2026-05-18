/**
 * Shapes Layer Component
 * Şekilleri harita üzerinde render eden component
 */

import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import type { ShapeProperties } from './types';
import { shapeToFeature } from './ShapeDrawingManager';
import { getShapeCorners, getShapeBounds } from './shapeResizeUtils';

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
  if (!Mapbox) return null;

  return (
    <>
      {shapes.map((shape) => {
        if (shape.screenSpace) return null;
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
              <Mapbox.ShapeSource
                id={`shape-${shape.id}`}
                shape={feature}
                onPress={() => fireShapePress(shape.id)}
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
                      onPress={(e: any) => {
                      console.log('[ShapesLayer] Resize handle press:', { shapeId: shape.id });
                      fireHandlePress(shape.id, 0); // 0 = resize mode
                    }}
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
                      onPress={(e: any) => {
                        console.log('[ShapesLayer] Rotation handle press:', { shapeId: shape.id });
                        fireHandlePress(shape.id, -1); // -1 = rotation mode
                      }}
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
          return (
            <React.Fragment key={shape.id}>
              <Mapbox.ShapeSource
                id={`shape-${shape.id}`}
                shape={feature}
                onPress={() => fireShapePress(shape.id)}
              >
                <Mapbox.LineLayer
                  id={`shape-line-${shape.id}`}
                  style={{
                    lineColor: outlineColor,
                    lineWidth: outlineWidth,
                  }}
                />
                {/* Arrow için ok başı (eğer arrowHead varsa) */}
                {shape.type === 'arrow' && shape.arrowHead && (
                  <Mapbox.ShapeSource
                    key={`arrowhead-${shape.id}`}
                    id={`shape-arrowhead-${shape.id}`}
                    shape={{
                      type: 'Feature',
                      geometry: shape.arrowHead,
                      properties: {},
                    }}
                  >
                    <Mapbox.FillLayer
                      id={`shape-arrowhead-fill-${shape.id}`}
                      style={{
                        fillColor: outlineColor,
                        fillOpacity: 1,
                      }}
                    />
                    <Mapbox.LineLayer
                      id={`shape-arrowhead-stroke-${shape.id}`}
                      style={{
                        lineColor: outlineColor,
                        lineWidth: outlineWidth,
                      }}
                    />
                  </Mapbox.ShapeSource>
                )}
              </Mapbox.ShapeSource>
              
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
                    onPress={(e: any) => {
                      console.log('[ShapesLayer] LineString resize handle press:', { shapeId: shape.id });
                      fireHandlePress(shape.id, 0); // 0 = resize mode
                    }}
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
                    onPress={(e: any) => {
                      console.log('[ShapesLayer] LineString rotation handle press:', { shapeId: shape.id });
                      fireHandlePress(shape.id, -1); // -1 = rotation mode
                    }}
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

            const textSize = typeof (shape as any).textSize === 'number' ? (shape as any).textSize : 14;
            const textColor = typeof (shape as any).textColor === 'string' ? (shape as any).textColor : '#ffffff';
            const textAlign = (shape as any).textAlign === 'left' ? 'left' : 'center';
            const textFont = typeof (shape as any).textFont === 'string' ? (shape as any).textFont : undefined;
            const bgOpacity = typeof shape.fillOpacity === 'number' ? shape.fillOpacity : 0.85;
            const rotationDeg = typeof (shape as any).rotation === 'number' ? (shape as any).rotation : 0;

            const boxWidthPx = Math.max(
              140,
              Math.min(320, typeof (shape as any).boxWidthPx === 'number' ? (shape as any).boxWidthPx : 220)
            );
            const boxHeightPx = Math.max(
              40,
              Math.min(180, typeof (shape as any).boxHeightPx === 'number' ? (shape as any).boxHeightPx : Math.round(36 + textSize * 2))
            );
            const radiusPx = Math.max(
              4,
              Math.min(16, typeof (shape as any).boxCornerRadiusPx === 'number' ? (shape as any).boxCornerRadiusPx : 10)
            );

            const bgHex = String(shape.fillColor || '#0f172a');
            const borderHex = String(shape.outlineColor || '#2563eb');
            const borderW = Math.max(0, Number(shape.outlineWidth || 2));

            const shadowEnabled = (shape as any).shadowEnabled !== false;
            const shadowColor = String((shape as any).shadowColor || '#000000');
            const shadowOpacity = typeof (shape as any).shadowOpacity === 'number' ? (shape as any).shadowOpacity : 0.35;
            const shadowRadius = Math.max(3, Math.min(20, radiusPx * 0.9));
            const elevation = shadowEnabled ? 10 : 0;

            const backgroundColor = hexToRgba(bgHex, bgOpacity);

            return (
              <React.Fragment key={shape.id}>
                {Mapbox.PointAnnotation ? (
                  <Mapbox.PointAnnotation
                    id={`textbox-pa-${shape.id}`}
                    coordinate={boxCenter}
                    onSelected={() => fireShapePress(shape.id)}
                  >
                    <TouchableOpacity activeOpacity={0.9} onPress={() => fireShapePress(shape.id)}>
                      <View
                        style={{
                          maxWidth: boxWidthPx,
                          minWidth: Math.min(120, boxWidthPx),
                          minHeight: boxHeightPx,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          backgroundColor,
                          borderColor: borderHex,
                          borderWidth: borderW,
                          borderRadius: radiusPx,
                          transform: rotationDeg ? [{ rotate: `${rotationDeg}deg` }] : undefined,
                          ...(shadowEnabled
                            ? Platform.select({
                                ios: {
                                  shadowColor,
                                  shadowOpacity,
                                  shadowRadius,
                                  shadowOffset: { width: 0, height: 4 },
                                },
                                android: { elevation },
                                default: {},
                              })
                            : {}),
                        }}
                      >
                        <Text
                          style={{
                            color: textColor,
                            fontSize: textSize,
                            textAlign,
                            ...(textFont ? { fontFamily: textFont } : {}),
                          }}
                        >
                          {shape.text || ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Mapbox.PointAnnotation>
                ) : Mapbox.MarkerView ? (
                  <Mapbox.MarkerView
                    id={`textbox-mv-${shape.id}`}
                    coordinate={boxCenter}
                    allowOverlap
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <TouchableOpacity activeOpacity={0.9} onPress={() => fireShapePress(shape.id)}>
                      <View
                        style={{
                          maxWidth: boxWidthPx,
                          minWidth: Math.min(120, boxWidthPx),
                          minHeight: boxHeightPx,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          backgroundColor,
                          borderColor: borderHex,
                          borderWidth: borderW,
                          borderRadius: radiusPx,
                          transform: rotationDeg ? [{ rotate: `${rotationDeg}deg` }] : undefined,
                          ...(shadowEnabled
                            ? Platform.select({
                                ios: {
                                  shadowColor,
                                  shadowOpacity,
                                  shadowRadius,
                                  shadowOffset: { width: 0, height: 4 },
                                },
                                android: { elevation },
                                default: {},
                              })
                            : {}),
                        }}
                      >
                        <Text
                          style={{
                            color: textColor,
                            fontSize: textSize,
                            textAlign,
                            ...(textFont ? { fontFamily: textFont } : {}),
                          }}
                        >
                          {shape.text || ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Mapbox.MarkerView>
                ) : (
                  <Mapbox.ShapeSource id={`textbox-text-${shape.id}`} shape={feature} onPress={() => fireShapePress(shape.id)}>
                    {shape.text && (
                      <Mapbox.SymbolLayer
                        id={`shape-textbox-${shape.id}`}
                        style={{
                          textField: shape.text,
                          textSize,
                          textColor,
                          textHaloColor: '#000000',
                          textHaloWidth: 2,
                          textAnchor: 'center',
                          textJustify: textAlign,
                          textAllowOverlap: true,
                          textPitchAlignment: 'viewport',
                          textRotationAlignment: 'viewport',
                          ...(textFont ? { textFont: [textFont] } : {}),
                        }}
                      />
                    )}
                  </Mapbox.ShapeSource>
                )}

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
                      onPress={() => fireHandlePress(shape.id, 1)}
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

          return (
            <Mapbox.ShapeSource
              key={shape.id}
              id={`shape-${shape.id}`}
              shape={feature}
              onPress={() => fireShapePress(shape.id)}
            >
              {/* Marker için circle */}
              {shape.type === 'marker' && (
                <Mapbox.CircleLayer
                  id={`shape-marker-${shape.id}`}
                  style={{
                    circleRadius:
                      (isSelected ? 8 : 6) *
                      (((shape as any).shapeSizePercent ?? 100) / 100),
                    circleColor: fillColor,
                    circleStrokeWidth: 2,
                    circleStrokeColor: outlineColor,
                  }}
                />
              )}
            </Mapbox.ShapeSource>
          );
        }

        return null;
      })}
    </>
  );
};
