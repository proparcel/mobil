/**
 * Cesium Model Viewer - Shape Drawing Functions
 * Şekil çizim fonksiyonları (inline JavaScript)
 * 
 * Bu modül tüm şekil çizim fonksiyonlarını içerir.
 */

/**
 * Shape drawing functions JavaScript kodunu oluştur
 */
export function generateShapeDrawingFunctions(): string {
  return `
          // ============================================
          // SHAPE DRAWING FUNCTIONS (Inline JavaScript)
          // ============================================

          // Şekil listesini güncelle
          function updateShapeListVisibility() {
            const state = window.cesiumFunctions.getCesiumState();
            if (!state) return;
            
            const noShapesMsg = document.getElementById("no-shapes-message");
            if (noShapesMsg) {
              if (state.shapes && state.shapes.length > 0) {
                noShapesMsg.style.display = "none";
              } else {
                noShapesMsg.style.display = "block";
              }
            }
          }

          function drawRectangle(startPoint, endPoint, options) {
            options = options || {};
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              const deltaLon = Math.abs(endPoint.lon - startPoint.lon);
              const deltaLat = Math.abs(endPoint.lat - startPoint.lat);
              const maxDim = Math.max(deltaLon, deltaLat);

              // Rectangle köşeleri
              const corners = [
                { lon: startPoint.lon, lat: startPoint.lat },
                { lon: startPoint.lon + (endPoint.lon >= startPoint.lon ? maxDim : -maxDim), lat: startPoint.lat },
                { lon: startPoint.lon + (endPoint.lon >= startPoint.lon ? maxDim : -maxDim), 
                  lat: startPoint.lat + (endPoint.lat >= startPoint.lat ? maxDim : -maxDim) },
                { lon: startPoint.lon, 
                  lat: startPoint.lat + (endPoint.lat >= startPoint.lat ? maxDim : -maxDim) }
              ];

              // Terrain yüksekliklerini al
              const cartographics = corners.map(function(corner) {
                return Cesium.Cartographic.fromDegrees(corner.lon, corner.lat);
              });

              Cesium.sampleTerrainMostDetailed(state.viewer.terrainProvider, cartographics)
                .then(function(updatedCartographics) {
                  const positions = updatedCartographics.map(function(cartographic) {
                    const height = cartographic.height || 0;
                    return Cesium.Cartesian3.fromRadians(
                      cartographic.longitude,
                      cartographic.latitude,
                      height
                    );
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#2563eb");
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#3b82f6");
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = "shape-rectangle-" + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: "Rectangle",
                    polygon: {
                      hierarchy: positions,
                      material: fillColor.withAlpha(fillOpacity),
                      outline: true,
                      outlineColor: outlineColor,
                      outlineWidth: outlineWidth,
                      perPositionHeight: true
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: "rectangle",
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || "#2563eb",
                    fillColor: options.fillColor || "#3b82f6",
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                })
                .catch(function(error) {
                  console.error("[Shape] Terrain sampling error for rectangle:", error);
                  // Fallback: terrain olmadan
                  const positions = corners.map(function(corner) {
                    return Cesium.Cartesian3.fromDegrees(corner.lon, corner.lat, 0);
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#2563eb");
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#3b82f6");
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = "shape-rectangle-" + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: "Rectangle",
                    polygon: {
                      hierarchy: positions,
                      material: fillColor.withAlpha(fillOpacity),
                      outline: true,
                      outlineColor: outlineColor,
                      outlineWidth: outlineWidth,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: "rectangle",
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || "#2563eb",
                    fillColor: options.fillColor || "#3b82f6",
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                });

              return null; // Async
            } catch (e) {
              console.error("[Shape] Rectangle error:", e);
              return null;
            }
          }

          function drawPolygon(points, options) {
            options = options || {};
            if (!points || points.length < 3) return null;
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              // Terrain yüksekliklerini al
              const cartographics = points.map(function(p) {
                return Cesium.Cartographic.fromDegrees(p.lon, p.lat);
              });

              Cesium.sampleTerrainMostDetailed(state.viewer.terrainProvider, cartographics)
                .then(function(updatedCartographics) {
                  const positions = updatedCartographics.map(function(cartographic) {
                    const height = cartographic.height || 0;
                    return Cesium.Cartesian3.fromRadians(
                      cartographic.longitude,
                      cartographic.latitude,
                      height
                    );
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#059669");
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#10b981");
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = "shape-polygon-" + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: "Polygon",
                    polygon: {
                      hierarchy: positions,
                      material: fillColor.withAlpha(fillOpacity),
                      outline: true,
                      outlineColor: outlineColor,
                      outlineWidth: outlineWidth,
                      perPositionHeight: true
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: "polygon",
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || "#059669",
                    fillColor: options.fillColor || "#10b981",
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                })
                .catch(function(error) {
                  console.error("[Shape] Terrain sampling error for polygon:", error);
                  // Fallback: terrain olmadan
                  const positions = points.map(function(p) {
                    return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0);
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#059669");
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#10b981");
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = "shape-polygon-" + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: "Polygon",
                    polygon: {
                      hierarchy: positions,
                      material: fillColor.withAlpha(fillOpacity),
                      outline: true,
                      outlineColor: outlineColor,
                      outlineWidth: outlineWidth,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: "polygon",
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || "#059669",
                    fillColor: options.fillColor || "#10b981",
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                });

              return null; // Async
            } catch (e) {
              console.error("[Shape] Polygon error:", e);
              return null;
            }
          }

          function drawLine(points, options) {
            options = options || {};
            if (!points || points.length < 2) return null;
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              // Terrain yüksekliklerini al
              const cartographics = points.map(function(p) {
                return Cesium.Cartographic.fromDegrees(p.lon, p.lat);
              });

              Cesium.sampleTerrainMostDetailed(state.viewer.terrainProvider, cartographics)
                .then(function(updatedCartographics) {
                  const positions = updatedCartographics.map(function(cartographic) {
                    const height = cartographic.height || 0;
                    return Cesium.Cartesian3.fromRadians(
                      cartographic.longitude,
                      cartographic.latitude,
                      height
                    );
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#fbbf24");
                  const outlineWidth = options.outlineWidth || 3;

                  const shapeId = "shape-line-" + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: "Line",
                    polyline: {
                      positions: positions,
                      width: outlineWidth,
                      material: outlineColor,
                      clampToGround: true
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: "line",
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || "#fbbf24",
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                })
                .catch(function(error) {
                  console.error("[Shape] Terrain sampling error for line:", error);
                  // Fallback: terrain olmadan
                  const positions = points.map(function(p) {
                    return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0);
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#fbbf24");
                  const outlineWidth = options.outlineWidth || 3;

                  const shapeId = "shape-line-" + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: "Line",
                    polyline: {
                      positions: positions,
                      width: outlineWidth,
                      material: outlineColor,
                      clampToGround: true
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: "line",
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || "#fbbf24",
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                });

              return null; // Async
            } catch (e) {
              console.error("[Shape] Line error:", e);
              return null;
            }
          }

          function drawMarker(point, options) {
            options = options || {};
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#06b6d4");
              const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#ffffff");
              const outlineWidth = options.outlineWidth || 2;

              const shapeId = "shape-marker-" + Date.now();
              const entity = state.viewer.entities.add({
                id: shapeId,
                name: "Marker",
                position: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 0),
                point: {
                  pixelSize: 10,
                  color: fillColor,
                  outlineColor: outlineColor,
                  outlineWidth: outlineWidth,
                  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                }
              });

              window.cesiumFunctions.addShape({
                id: shapeId,
                type: "marker",
                entityIds: [shapeId],
                fillColor: options.fillColor || "#06b6d4",
                outlineColor: options.outlineColor || "#ffffff",
                outlineWidth: outlineWidth
              });

              state.viewer.scene.requestRender();
              updateShapeListVisibility();
              return shapeId;
            } catch (e) {
              console.error("[Shape] Marker error:", e);
              return null;
            }
          }

          function drawTriangle(points, options) {
            options = options || {};
            if (!points || points.length !== 3) return null;
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              // Terrain yüksekliklerini al
              const cartographics = points.map(function(p) {
                return Cesium.Cartographic.fromDegrees(p.lon, p.lat);
              });

              Cesium.sampleTerrainMostDetailed(state.viewer.terrainProvider, cartographics)
                .then(function(updatedCartographics) {
                  const positions = updatedCartographics.map(function(cartographic) {
                    const height = cartographic.height || 0;
                    return Cesium.Cartesian3.fromRadians(
                      cartographic.longitude,
                      cartographic.latitude,
                      height
                    );
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#059669");
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#10b981");
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = "shape-triangle-" + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: "Triangle",
                    polygon: {
                      hierarchy: positions,
                      material: fillColor.withAlpha(fillOpacity),
                      outline: true,
                      outlineColor: outlineColor,
                      outlineWidth: outlineWidth,
                      perPositionHeight: true
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: "triangle",
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || "#059669",
                    fillColor: options.fillColor || "#10b981",
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                })
                .catch(function(error) {
                  console.error("[Shape] Terrain sampling error for triangle:", error);
                  // Fallback: terrain olmadan
                  const positions = points.map(function(p) {
                    return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0);
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#059669");
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#10b981");
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = "shape-triangle-" + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: "Triangle",
                    polygon: {
                      hierarchy: positions,
                      material: fillColor.withAlpha(fillOpacity),
                      outline: true,
                      outlineColor: outlineColor,
                      outlineWidth: outlineWidth,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: "triangle",
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || "#059669",
                    fillColor: options.fillColor || "#10b981",
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                });

              return null; // Async
            } catch (e) {
              console.error("[Shape] Triangle error:", e);
              return null;
            }
          }

          function drawCircle(center, radiusPoint, options) {
            options = options || {};
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              // Calculate radius in meters
              const centerCart = Cesium.Cartesian3.fromDegrees(center.lon, center.lat, 0);
              const radiusCart = Cesium.Cartesian3.fromDegrees(radiusPoint.lon, radiusPoint.lat, 0);
              const radius = Cesium.Cartesian3.distance(centerCart, radiusCart);

              // Center ve radius point için terrain yüksekliklerini al
              const centerCartographic = Cesium.Cartographic.fromDegrees(center.lon, center.lat);
              const radiusCartographic = Cesium.Cartographic.fromDegrees(radiusPoint.lon, radiusPoint.lat);
              
              Cesium.sampleTerrainMostDetailed(state.viewer.terrainProvider, [centerCartographic, radiusCartographic])
                .then(function(updatedCartographics) {
                  const centerUpdated = updatedCartographics[0];
                  const radiusUpdated = updatedCartographics[1];
                  
                  // Center position with terrain height
                  const centerPos = Cesium.Cartesian3.fromRadians(
                    centerUpdated.longitude,
                    centerUpdated.latitude,
                    centerUpdated.height || 0
                  );
                  
                  // Recalculate radius with terrain heights
                  const radiusPos = Cesium.Cartesian3.fromRadians(
                    radiusUpdated.longitude,
                    radiusUpdated.latitude,
                    radiusUpdated.height || 0
                  );
                  const actualRadius = Cesium.Cartesian3.distance(centerPos, radiusPos);

                  // Create circle polygon (64 segments) with terrain heights
                  const positions = [];
                  const steps = 64;
                  const centerCartographicFinal = Cesium.Cartographic.fromCartesian(centerPos);
                  const lon = Cesium.Math.toDegrees(centerCartographicFinal.longitude);
                  const lat = Cesium.Math.toDegrees(centerCartographicFinal.latitude);
                  
                  // Convert radius (meters) to degrees
                  const latOffset = actualRadius / 111320;
                  const lonOffset = actualRadius / (111320 * Math.cos(centerCartographicFinal.latitude));
                  
                  // Sample terrain for all circle points
                  const circleCartographics = [];
                  for (let i = 0; i <= steps; i++) {
                    const angle = (i / steps) * Math.PI * 2;
                    const newLon = lon + lonOffset * Math.cos(angle);
                    const newLat = lat + latOffset * Math.sin(angle);
                    circleCartographics.push(Cesium.Cartographic.fromDegrees(newLon, newLat));
                  }
                  
                  // Get terrain heights for all circle points
                  Cesium.sampleTerrainMostDetailed(state.viewer.terrainProvider, circleCartographics)
                    .then(function(updatedCircleCartographics) {
                      const positions = updatedCircleCartographics.map(function(cartographic) {
                        const height = cartographic.height || 0;
                        return Cesium.Cartesian3.fromRadians(
                          cartographic.longitude,
                          cartographic.latitude,
                          height
                        );
                      });

                      const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#dc2626");
                      const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#ef4444");
                      const outlineWidth = options.outlineWidth || 2;
                      const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                      const shapeId = "shape-circle-" + Date.now();
                      const entity = state.viewer.entities.add({
                        id: shapeId,
                        name: "Circle",
                        polygon: {
                          hierarchy: positions,
                          material: fillColor.withAlpha(fillOpacity),
                          outline: true,
                          outlineColor: outlineColor,
                          outlineWidth: outlineWidth,
                          perPositionHeight: true
                        }
                      });

                      window.cesiumFunctions.addShape({
                        id: shapeId,
                        type: "circle",
                        entityIds: [shapeId],
                        outlineColor: options.outlineColor || "#dc2626",
                        fillColor: options.fillColor || "#ef4444",
                        outlineWidth: outlineWidth
                      });

                      state.viewer.scene.requestRender();
                      updateShapeListVisibility();
                    })
                    .catch(function(error) {
                      console.error("[Shape] Terrain sampling error for circle points:", error);
                      // Fallback: use center height for all points
                      const centerHeight = centerUpdated.height || 0;
                      const positions = circleCartographics.map(function(cartographic) {
                        return Cesium.Cartesian3.fromRadians(
                          cartographic.longitude,
                          cartographic.latitude,
                          centerHeight
                        );
                      });

                      const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#dc2626");
                      const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#ef4444");
                      const outlineWidth = options.outlineWidth || 2;
                      const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                      const shapeId = "shape-circle-" + Date.now();
                      const entity = state.viewer.entities.add({
                        id: shapeId,
                        name: "Circle",
                        polygon: {
                          hierarchy: positions,
                          material: fillColor.withAlpha(fillOpacity),
                          outline: true,
                          outlineColor: outlineColor,
                          outlineWidth: outlineWidth,
                          perPositionHeight: true
                        }
                      });

                      window.cesiumFunctions.addShape({
                        id: shapeId,
                        type: "circle",
                        entityIds: [shapeId],
                        outlineColor: options.outlineColor || "#dc2626",
                        fillColor: options.fillColor || "#ef4444",
                        outlineWidth: outlineWidth
                      });

                      state.viewer.scene.requestRender();
                      updateShapeListVisibility();
                    });
                })
                .catch(function(error) {
                  console.error("[Shape] Terrain sampling error for circle:", error);
                  // Fallback: terrain olmadan
                  const positions = [];
                  const steps = 64;
                  const cartographic = Cesium.Cartographic.fromCartesian(centerCart);
                  const lon = Cesium.Math.toDegrees(cartographic.longitude);
                  const lat = Cesium.Math.toDegrees(cartographic.latitude);
                  
                  const latOffset = radius / 111320;
                  const lonOffset = radius / (111320 * Math.cos(cartographic.latitude));
                  
                  for (let i = 0; i <= steps; i++) {
                    const angle = (i / steps) * Math.PI * 2;
                    const newLon = lon + lonOffset * Math.cos(angle);
                    const newLat = lat + latOffset * Math.sin(angle);
                    positions.push(Cesium.Cartesian3.fromDegrees(newLon, newLat, 0));
                  }

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#dc2626");
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#ef4444");
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = "shape-circle-" + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: "Circle",
                    polygon: {
                      hierarchy: positions,
                      material: fillColor.withAlpha(fillOpacity),
                      outline: true,
                      outlineColor: outlineColor,
                      outlineWidth: outlineWidth,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: "circle",
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || "#dc2626",
                    fillColor: options.fillColor || "#ef4444",
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                });

              return null; // Async
            } catch (e) {
              console.error("[Shape] Circle error:", e);
              return null;
            }
          }

          function drawEllipse(center, axis1Point, axis2Point, options) {
            options = options || {};
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              const centerCart = Cesium.Cartesian3.fromDegrees(center.lon, center.lat, 0);
              const axis1Cart = Cesium.Cartesian3.fromDegrees(axis1Point.lon, axis1Point.lat, 0);
              const axis2Cart = Cesium.Cartesian3.fromDegrees(axis2Point.lon, axis2Point.lat, 0);
              
              const semiMajor = Cesium.Cartesian3.distance(centerCart, axis1Cart);
              const semiMinor = Cesium.Cartesian3.distance(centerCart, axis2Cart);
              
              // Calculate rotation angle
              const cartographic1 = Cesium.Cartographic.fromCartesian(axis1Cart);
              const cartographicCenter = Cesium.Cartographic.fromCartesian(centerCart);
              const angle1 = Math.atan2(
                Cesium.Math.toDegrees(cartographic1.latitude) - Cesium.Math.toDegrees(cartographicCenter.latitude),
                Cesium.Math.toDegrees(cartographic1.longitude) - Cesium.Math.toDegrees(cartographicCenter.longitude)
              );

              // Create ellipse polygon
              const positions = [];
              const steps = 64;
              const cartographic = Cesium.Cartographic.fromCartesian(centerCart);
              const lon = Cesium.Math.toDegrees(cartographic.longitude);
              const lat = Cesium.Math.toDegrees(cartographic.latitude);
              
              for (let i = 0; i <= steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                const x = semiMajor * Math.cos(angle) / 111320;
                const y = semiMinor * Math.sin(angle) / 111320;
                
                // Apply rotation
                const rotatedX = x * Math.cos(angle1) - y * Math.sin(angle1);
                const rotatedY = x * Math.sin(angle1) + y * Math.cos(angle1);
                
                const newLon = lon + rotatedX / Math.cos(cartographic.latitude);
                const newLat = lat + rotatedY;
                positions.push(Cesium.Cartesian3.fromDegrees(newLon, newLat, 0));
              }

              const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#9333ea");
              const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#a855f7");
              const outlineWidth = options.outlineWidth || 2;
              const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

              const shapeId = "shape-ellipse-" + Date.now();
              const entity = state.viewer.entities.add({
                id: shapeId,
                name: "Ellipse",
                polygon: {
                  hierarchy: positions,
                  material: fillColor.withAlpha(fillOpacity),
                  outline: true,
                  outlineColor: outlineColor,
                  outlineWidth: outlineWidth,
                  height: 0
                }
              });

              window.cesiumFunctions.addShape({
                id: shapeId,
                type: "ellipse",
                entityIds: [shapeId],
                outlineColor: options.outlineColor || "#9333ea",
                fillColor: options.fillColor || "#a855f7",
                outlineWidth: outlineWidth
              });

              state.viewer.scene.requestRender();
              updateShapeListVisibility();
              return shapeId;
            } catch (e) {
              console.error("[Shape] Ellipse error:", e);
              return null;
            }
          }

          function drawArrow(startPoint, endPoint, options) {
            options = options || {};
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              const startCart = Cesium.Cartesian3.fromDegrees(startPoint.lon, startPoint.lat, 0);
              const endCart = Cesium.Cartesian3.fromDegrees(endPoint.lon, endPoint.lat, 0);
              
              // Calculate arrow direction
              const direction = Cesium.Cartesian3.subtract(endCart, startCart, new Cesium.Cartesian3());
              const distance = Cesium.Cartesian3.magnitude(direction);
              const normalized = Cesium.Cartesian3.normalize(direction, new Cesium.Cartesian3());
              
              // Arrow head size (10% of line length, min 5m, max 50m)
              const arrowHeadSize = Math.max(5, Math.min(50, distance * 0.1));
              const arrowHeadAngle = Math.PI / 6; // 30 degrees
              
              // Perpendicular vector for arrow head
              const perp = new Cesium.Cartesian3(-normalized.y, normalized.x, normalized.z);
              const perp2 = new Cesium.Cartesian3(normalized.y, -normalized.x, normalized.z);
              
              // Arrow head points
              const headPoint1 = Cesium.Cartesian3.add(
                endCart,
                Cesium.Cartesian3.multiplyByScalar(
                  Cesium.Cartesian3.add(
                    Cesium.Cartesian3.multiplyByScalar(normalized, -1, new Cesium.Cartesian3()),
                    Cesium.Cartesian3.multiplyByScalar(perp, Math.tan(arrowHeadAngle), new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                  ),
                  arrowHeadSize,
                  new Cesium.Cartesian3()
                ),
                new Cesium.Cartesian3()
              );
              
              const headPoint2 = Cesium.Cartesian3.add(
                endCart,
                Cesium.Cartesian3.multiplyByScalar(
                  Cesium.Cartesian3.add(
                    Cesium.Cartesian3.multiplyByScalar(normalized, -1, new Cesium.Cartesian3()),
                    Cesium.Cartesian3.multiplyByScalar(perp2, Math.tan(arrowHeadAngle), new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                  ),
                  arrowHeadSize,
                  new Cesium.Cartesian3()
                ),
                new Cesium.Cartesian3()
              );

              const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#ea580c");
              const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#f97316");
              const outlineWidth = options.outlineWidth || 3;

              const shapeId = "shape-arrow-" + Date.now();
              
              // Line
              const lineEntity = state.viewer.entities.add({
                id: shapeId + "-line",
                name: "Arrow Line",
                polyline: {
                  positions: [startCart, endCart],
                  width: outlineWidth,
                  material: outlineColor,
                  clampToGround: true
                }
              });

              // Arrow head
              const headEntity = state.viewer.entities.add({
                id: shapeId + "-head",
                name: "Arrow Head",
                polygon: {
                  hierarchy: [endCart, headPoint1, headPoint2],
                  material: fillColor,
                  outline: true,
                  outlineColor: outlineColor,
                  outlineWidth: outlineWidth,
                  height: 0
                }
              });

              window.cesiumFunctions.addShape({
                id: shapeId,
                type: "arrow",
                entityIds: [shapeId + "-line", shapeId + "-head"],
                outlineColor: options.outlineColor || "#ea580c",
                fillColor: options.fillColor || "#f97316",
                outlineWidth: outlineWidth
              });

              state.viewer.scene.requestRender();
              updateShapeListVisibility();
              return shapeId;
            } catch (e) {
              console.error("[Shape] Arrow error:", e);
              return null;
            }
          }

          function drawTextBox(point, options) {
            options = options || {};
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              // Prompt for text (simplified - in real implementation, use a modal)
              const text = prompt("Metin girin:", "Metin");
              if (!text || text.trim() === "") {
                return null;
              }

              const textContent = text.trim();
              
              // Terrain yüksekliğini al
              const cartographic = Cesium.Cartographic.fromDegrees(point.lon, point.lat);
              const terrainPromise = Cesium.sampleTerrainMostDetailed(state.viewer.terrainProvider, [cartographic]);
              
              terrainPromise.then(function(updatedCartographics) {
                const updatedCartographic = updatedCartographics[0];
                const height = updatedCartographic.height || 0;
                const position = Cesium.Cartesian3.fromRadians(
                  updatedCartographic.longitude,
                  updatedCartographic.latitude,
                  height + 2
                );

                const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#3b82f6");
                const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#2563eb");
                const textColor = window.cesiumFunctions.hexToCesiumColor(options.textColor || "#ffffff");
                const outlineWidth = options.outlineWidth || 2;

                const shapeId = "shape-textbox-" + Date.now();
                
                // İğne (pin) SVG
                const fillColorEscaped = (options.fillColor || "#3b82f6").replace("#", "%23");
                const svgString = "<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"24\\\" height=\\\"24\\\" viewBox=\\\"0 0 24 24\\\"><path d=\\\"M12 2L13.09 8.26L20 9L13.09 15.74L12 22L10.91 15.74L4 9L10.91 8.26L12 2Z\\\" fill=\\\"" + fillColorEscaped + "\\\"/></svg>";
                const pinSvg = "data:image/svg+xml;base64," + btoa(svgString);

                // Metin kutusu entity
                const entity = state.viewer.entities.add({
                  id: shapeId,
                  name: "Textbox",
                  position: position,
                  label: {
                    text: textContent,
                    font: "14pt sans-serif",
                    fillColor: textColor,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -30),
                    backgroundColor: fillColor,
                    backgroundPadding: new Cesium.Cartesian2(12, 8),
                    showBackground: true,
                    scale: 1.0,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                  },
                  // İğne (pin) için billboard
                  billboard: {
                    image: pinSvg,
                    width: 24,
                    height: 24,
                    scale: 1.0,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                  }
                });

                window.cesiumFunctions.addShape({
                  id: shapeId,
                  type: "textbox",
                  entityIds: [shapeId],
                  text: textContent,
                  fillColor: options.fillColor || "#3b82f6",
                  outlineColor: options.outlineColor || "#2563eb",
                  textColor: options.textColor || "#ffffff",
                  outlineWidth: outlineWidth
                });

                state.viewer.scene.requestRender();
                updateShapeListVisibility();
              }).catch(function(error) {
                console.error("[Shape] Terrain sampling error for textbox:", error);
                // Fallback: terrain olmadan
                const position = Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 2);
                const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || "#3b82f6");
                const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || "#2563eb");
                const textColor = window.cesiumFunctions.hexToCesiumColor(options.textColor || "#ffffff");
                const outlineWidth = options.outlineWidth || 2;

                // İğne (pin) SVG
                const fillColorEscaped = (options.fillColor || "#3b82f6").replace("#", "%23");
                const svgString = "<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"24\\\" height=\\\"24\\\" viewBox=\\\"0 0 24 24\\\"><path d=\\\"M12 2L13.09 8.26L20 9L13.09 15.74L12 22L10.91 15.74L4 9L10.91 8.26L12 2Z\\\" fill=\\\"" + fillColorEscaped + "\\\"/></svg>";
                const pinSvg = "data:image/svg+xml;base64," + btoa(svgString);

                const shapeId = "shape-textbox-" + Date.now();
                const entity = state.viewer.entities.add({
                  id: shapeId,
                  name: "Textbox",
                  position: position,
                  label: {
                    text: textContent,
                    font: "14pt sans-serif",
                    fillColor: textColor,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -30),
                    backgroundColor: fillColor,
                    backgroundPadding: new Cesium.Cartesian2(12, 8),
                    showBackground: true,
                    scale: 1.0,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                  },
                  billboard: {
                    image: pinSvg,
                    width: 24,
                    height: 24,
                    scale: 1.0,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                  }
                });

                window.cesiumFunctions.addShape({
                  id: shapeId,
                  type: "textbox",
                  entityIds: [shapeId],
                  text: textContent,
                  fillColor: options.fillColor || "#3b82f6",
                  outlineColor: options.outlineColor || "#2563eb",
                  textColor: options.textColor || "#ffffff",
                  outlineWidth: outlineWidth
                });

                state.viewer.scene.requestRender();
                updateShapeListVisibility();
              });

              return null; // Async, return null for now
            } catch (e) {
              console.error("[Shape] TextBox error:", e);
              return null;
            }
          }
  `;
}
