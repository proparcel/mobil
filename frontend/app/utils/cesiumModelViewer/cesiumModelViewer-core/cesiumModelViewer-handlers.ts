/**
 * Cesium Model Viewer - Event Handlers
 * Event handler'ları (inline JavaScript)
 *
 * Bu dosya HTML string içinde kullanılacak event handler JavaScript kodunu oluşturur.
 * threeJsModelViewer'daki event handler'lardan esinlenilmiştir.
 * Mapbox referansları kaldırılmış, Cesium ScreenSpaceEventHandler kullanılmıştır.
 */

/**
 * Event handler script'ini oluştur
 */
export function generateEventHandlersScript(): string {
  return `
    <script>
      (function() {
        // Helper function to log messages (use global log if available, otherwise console.log)
        function logHandler(level) {
          var args = Array.prototype.slice.call(arguments, 1);
          if (typeof window.log === 'function') {
            window.log.apply(null, [level].concat(args));
          } else if (typeof post === 'function') {
            post('log', { level: level, args: args.map(function(a) { return String(a); }) });
          } else {
            console.log.apply(console, ['[Handlers]'].concat(args));
          }
        }
        
        // Wait for DOM and Cesium to be ready
        function waitForReady() {
          return new Promise(function(resolve) {
            if (document.readyState === 'complete' && window.cesiumFunctions && window.cesiumFunctions.getCesiumState) {
              const state = window.cesiumFunctions.getCesiumState();
              if (state && state.viewer) {
                resolve();
                return;
              }
            }

            var checkInterval = setInterval(function() {
              if (document.readyState === 'complete' && window.cesiumFunctions && window.cesiumFunctions.getCesiumState) {
                const state = window.cesiumFunctions.getCesiumState();
                if (state && state.viewer) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }
            }, 100);

            setTimeout(function() {
              clearInterval(checkInterval);
              resolve(); // Resolve anyway after 5 seconds
            }, 5000);
          });
        }

        // Modal aç/kapa mantığı
        function closeAllModals() {
          document.querySelectorAll('.menu-modal').forEach(function(modal) {
            modal.style.display = 'none';
          });
        }

        function openModal(modalId) {
          closeAllModals();
          const modal = document.getElementById(modalId);
          if (modal) {
            modal.style.display = 'flex';
          }
        }

        // Initialize handlers when ready
        waitForReady().then(function() {
          setupEventHandlers();
        });

        function setupEventHandlers() {
          const state = window.cesiumFunctions.getCesiumState();
          if (!state || !state.viewer) {
            console.warn('[Handlers] State or viewer not available');
            return;
          }

          const Cesium = window.Cesium;
          const viewer = state.viewer;

          // Modal overlay'lere tıklanınca kapat
          document.querySelectorAll('.menu-modal-overlay').forEach(function(overlay) {
            overlay.addEventListener('click', function() {
              closeAllModals();
            });
          });

          // ============================================
          // SHAPE DRAWING FUNCTIONS (Inline JavaScript)
          // ============================================

          // Şekil listesini güncelle
          function updateShapeListVisibility() {
            const state = window.cesiumFunctions.getCesiumState();
            if (!state) return;
            
            const noShapesMsg = document.getElementById('no-shapes-message');
            if (noShapesMsg) {
              if (state.shapes && state.shapes.length > 0) {
                noShapesMsg.style.display = 'none';
              } else {
                noShapesMsg.style.display = 'block';
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

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#2563eb');
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#3b82f6');
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = 'shape-rectangle-' + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: 'Rectangle',
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
                    type: 'rectangle',
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || '#2563eb',
                    fillColor: options.fillColor || '#3b82f6',
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                })
                .catch(function(error) {
                  console.error('[Shape] Terrain sampling error for rectangle:', error);
                  // Fallback: terrain olmadan
                  const positions = corners.map(function(corner) {
                    return Cesium.Cartesian3.fromDegrees(corner.lon, corner.lat, 0);
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#2563eb');
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#3b82f6');
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = 'shape-rectangle-' + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: 'Rectangle',
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
                    type: 'rectangle',
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || '#2563eb',
                    fillColor: options.fillColor || '#3b82f6',
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                  updateShapeListVisibility();
                });

              return null; // Async
            } catch (e) {
              console.error('[Shape] Rectangle error:', e);
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

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#059669');
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#10b981');
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = 'shape-polygon-' + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: 'Polygon',
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
                    type: 'polygon',
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || '#059669',
                    fillColor: options.fillColor || '#10b981',
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                })
                .catch(function(error) {
                  console.error('[Shape] Terrain sampling error for polygon:', error);
                  // Fallback: terrain olmadan
                  const positions = points.map(function(p) {
                    return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0);
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#059669');
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#10b981');
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = 'shape-polygon-' + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: 'Polygon',
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
                    type: 'polygon',
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || '#059669',
                    fillColor: options.fillColor || '#10b981',
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                });

              return null; // Async
            } catch (e) {
              console.error('[Shape] Polygon error:', e);
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

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#fbbf24');
                  const outlineWidth = options.outlineWidth || 3;

                  const shapeId = 'shape-line-' + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: 'Line',
                    polyline: {
                      positions: positions,
                      width: outlineWidth,
                      material: outlineColor,
                      clampToGround: true
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: 'line',
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || '#fbbf24',
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                })
                .catch(function(error) {
                  console.error('[Shape] Terrain sampling error for line:', error);
                  // Fallback: terrain olmadan
                  const positions = points.map(function(p) {
                    return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0);
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#fbbf24');
                  const outlineWidth = options.outlineWidth || 3;

                  const shapeId = 'shape-line-' + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: 'Line',
                    polyline: {
                      positions: positions,
                      width: outlineWidth,
                      material: outlineColor,
                      clampToGround: true
                    }
                  });

                  window.cesiumFunctions.addShape({
                    id: shapeId,
                    type: 'line',
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || '#fbbf24',
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                });

              return null; // Async
            } catch (e) {
              console.error('[Shape] Line error:', e);
              return null;
            }
          }

          function drawMarker(point, options) {
            options = options || {};
            const Cesium = window.Cesium;
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return null;

            try {
              const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#06b6d4');
              const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#ffffff');
              const outlineWidth = options.outlineWidth || 2;

              const shapeId = 'shape-marker-' + Date.now();
              const entity = state.viewer.entities.add({
                id: shapeId,
                name: 'Marker',
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
                type: 'marker',
                entityIds: [shapeId],
                fillColor: options.fillColor || '#06b6d4',
                outlineColor: options.outlineColor || '#ffffff',
                outlineWidth: outlineWidth
              });

              state.viewer.scene.requestRender();
              return shapeId;
            } catch (e) {
              console.error('[Shape] Marker error:', e);
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

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#059669');
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#10b981');
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = 'shape-triangle-' + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: 'Triangle',
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
                    type: 'triangle',
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || '#059669',
                    fillColor: options.fillColor || '#10b981',
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                })
                .catch(function(error) {
                  console.error('[Shape] Terrain sampling error for triangle:', error);
                  // Fallback: terrain olmadan
                  const positions = points.map(function(p) {
                    return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0);
                  });

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#059669');
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#10b981');
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = 'shape-triangle-' + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: 'Triangle',
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
                    type: 'triangle',
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || '#059669',
                    fillColor: options.fillColor || '#10b981',
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                });

              return null; // Async
            } catch (e) {
              console.error('[Shape] Triangle error:', e);
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

                      const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#dc2626');
                      const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#ef4444');
                      const outlineWidth = options.outlineWidth || 2;
                      const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                      const shapeId = 'shape-circle-' + Date.now();
                      const entity = state.viewer.entities.add({
                        id: shapeId,
                        name: 'Circle',
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
                        type: 'circle',
                        entityIds: [shapeId],
                        outlineColor: options.outlineColor || '#dc2626',
                        fillColor: options.fillColor || '#ef4444',
                        outlineWidth: outlineWidth
                      });

                      state.viewer.scene.requestRender();
                    })
                    .catch(function(error) {
                      console.error('[Shape] Terrain sampling error for circle points:', error);
                      // Fallback: use center height for all points
                      const centerHeight = centerUpdated.height || 0;
                      const positions = circleCartographics.map(function(cartographic) {
                        return Cesium.Cartesian3.fromRadians(
                          cartographic.longitude,
                          cartographic.latitude,
                          centerHeight
                        );
                      });

                      const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#dc2626');
                      const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#ef4444');
                      const outlineWidth = options.outlineWidth || 2;
                      const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                      const shapeId = 'shape-circle-' + Date.now();
                      const entity = state.viewer.entities.add({
                        id: shapeId,
                        name: 'Circle',
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
                        type: 'circle',
                        entityIds: [shapeId],
                        outlineColor: options.outlineColor || '#dc2626',
                        fillColor: options.fillColor || '#ef4444',
                        outlineWidth: outlineWidth
                      });

                      state.viewer.scene.requestRender();
                    })
                    .catch(function(error) {
                      console.error('[Shape] Terrain sampling error for circle points:', error);
                      // Fallback: use center height for all points
                      const centerHeight = centerUpdated.height || 0;
                      const positions = circleCartographics.map(function(cartographic) {
                        return Cesium.Cartesian3.fromRadians(
                          cartographic.longitude,
                          cartographic.latitude,
                          centerHeight
                        );
                      });

                      const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#dc2626');
                      const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#ef4444');
                      const outlineWidth = options.outlineWidth || 2;
                      const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                      const shapeId = 'shape-circle-' + Date.now();
                      const entity = state.viewer.entities.add({
                        id: shapeId,
                        name: 'Circle',
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
                        type: 'circle',
                        entityIds: [shapeId],
                        outlineColor: options.outlineColor || '#dc2626',
                        fillColor: options.fillColor || '#ef4444',
                        outlineWidth: outlineWidth
                      });

                      state.viewer.scene.requestRender();
                    });
                })
                .catch(function(error) {
                  console.error('[Shape] Terrain sampling error for circle:', error);
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

                  const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#dc2626');
                  const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#ef4444');
                  const outlineWidth = options.outlineWidth || 2;
                  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

                  const shapeId = 'shape-circle-' + Date.now();
                  const entity = state.viewer.entities.add({
                    id: shapeId,
                    name: 'Circle',
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
                    type: 'circle',
                    entityIds: [shapeId],
                    outlineColor: options.outlineColor || '#dc2626',
                    fillColor: options.fillColor || '#ef4444',
                    outlineWidth: outlineWidth
                  });

                  state.viewer.scene.requestRender();
                });

              return null; // Async
            } catch (e) {
              console.error('[Shape] Circle error:', e);
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

              const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#9333ea');
              const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#a855f7');
              const outlineWidth = options.outlineWidth || 2;
              const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.5;

              const shapeId = 'shape-ellipse-' + Date.now();
              const entity = state.viewer.entities.add({
                id: shapeId,
                name: 'Ellipse',
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
                type: 'ellipse',
                entityIds: [shapeId],
                outlineColor: options.outlineColor || '#9333ea',
                fillColor: options.fillColor || '#a855f7',
                outlineWidth: outlineWidth
              });

              state.viewer.scene.requestRender();
              return shapeId;
            } catch (e) {
              console.error('[Shape] Ellipse error:', e);
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

              const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#ea580c');
              const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#f97316');
              const outlineWidth = options.outlineWidth || 3;

              const shapeId = 'shape-arrow-' + Date.now();
              
              // Line
              const lineEntity = state.viewer.entities.add({
                id: shapeId + '-line',
                name: 'Arrow Line',
                polyline: {
                  positions: [startCart, endCart],
                  width: outlineWidth,
                  material: outlineColor,
                  clampToGround: true
                }
              });

              // Arrow head
              const headEntity = state.viewer.entities.add({
                id: shapeId + '-head',
                name: 'Arrow Head',
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
                type: 'arrow',
                entityIds: [shapeId + '-line', shapeId + '-head'],
                outlineColor: options.outlineColor || '#ea580c',
                fillColor: options.fillColor || '#f97316',
                outlineWidth: outlineWidth
              });

              state.viewer.scene.requestRender();
              return shapeId;
            } catch (e) {
              console.error('[Shape] Arrow error:', e);
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
              const text = prompt('Metin girin:', 'Metin');
              if (!text || text.trim() === '') {
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

                const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#3b82f6');
                const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#2563eb');
                const textColor = window.cesiumFunctions.hexToCesiumColor(options.textColor || '#ffffff');
                const outlineWidth = options.outlineWidth || 2;

                const shapeId = 'shape-textbox-' + Date.now();
                
                // İğne (pin) SVG
                const pinSvg = 'data:image/svg+xml;base64,' + btoa(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
                  '<path d="M12 2L13.09 8.26L20 9L13.09 15.74L12 22L10.91 15.74L4 9L10.91 8.26L12 2Z" fill="' + 
                  (options.fillColor || '#3b82f6').replace('#', '%23') + '"/>' +
                  '</svg>'
                );

                // Metin kutusu entity
                const entity = state.viewer.entities.add({
                  id: shapeId,
                  name: 'Textbox',
                  position: position,
                  label: {
                    text: textContent,
                    font: '14pt sans-serif',
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
                  type: 'textbox',
                  entityIds: [shapeId],
                  text: textContent,
                  fillColor: options.fillColor || '#3b82f6',
                  outlineColor: options.outlineColor || '#2563eb',
                  textColor: options.textColor || '#ffffff',
                  outlineWidth: outlineWidth
                });

                state.viewer.scene.requestRender();
              }).catch(function(error) {
                console.error('[Shape] Terrain sampling error for textbox:', error);
                // Fallback: terrain olmadan
                  const position = Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 2);
                const fillColor = window.cesiumFunctions.hexToCesiumColor(options.fillColor || '#3b82f6');
                const outlineColor = window.cesiumFunctions.hexToCesiumColor(options.outlineColor || '#2563eb');
                const textColor = window.cesiumFunctions.hexToCesiumColor(options.textColor || '#ffffff');
                const outlineWidth = options.outlineWidth || 2;

                // İğne (pin) SVG
                const pinSvg = 'data:image/svg+xml;base64,' + btoa(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
                  '<path d="M12 2L13.09 8.26L20 9L13.09 15.74L12 22L10.91 15.74L4 9L10.91 8.26L12 2Z" fill="' + 
                  (options.fillColor || '#3b82f6').replace('#', '%23') + '"/>' +
                  '</svg>'
                );

                const shapeId = 'shape-textbox-' + Date.now();
                const entity = state.viewer.entities.add({
                  id: shapeId,
                  name: 'Textbox',
                  position: position,
                  label: {
                    text: textContent,
                    font: '14pt sans-serif',
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
                  type: 'textbox',
                  entityIds: [shapeId],
                  text: textContent,
                  fillColor: options.fillColor || '#3b82f6',
                  outlineColor: options.outlineColor || '#2563eb',
                  textColor: options.textColor || '#ffffff',
                  outlineWidth: outlineWidth
                });

                state.viewer.scene.requestRender();
              });

              return null; // Async, return null for now
            } catch (e) {
              console.error('[Shape] TextBox error:', e);
              return null;
            }
          }

          // ============================================
          // UI EVENT HANDLERS
          // ============================================

          // Close button
          const closeBtn = document.getElementById('close-btn');
          if (closeBtn) {
            closeBtn.addEventListener('click', function() {
              if (window.sendToReactNative) {
                window.sendToReactNative('close-requested', {});
              }
            });
          }

          // Model select dropdown
          const modelDropdown = document.getElementById('model-select-dropdown');
          if (modelDropdown) {
            modelDropdown.addEventListener('change', function(e) {
              const value = this.value;
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              if (value) {
                const parts = value.split(':');
                if (parts.length === 2) {
                  state.selectedModel = value;
                  state.selectedType = parts[0];
                  state.selectedFile = parts[1];

                  const addBtn = document.getElementById('add-model-btn');
                  if (addBtn) {
                    addBtn.disabled = false;
                  }

                  const scaleSlider = document.getElementById('model-scale');
                  const rotationSlider = document.getElementById('model-rotation');
                  if (scaleSlider) scaleSlider.disabled = false;
                  if (rotationSlider) rotationSlider.disabled = false;
                }
              } else {
                state.selectedModel = null;
                state.selectedType = null;
                state.selectedFile = null;

                const addBtn = document.getElementById('add-model-btn');
                if (addBtn) {
                  addBtn.disabled = true;
                }

                const scaleSlider = document.getElementById('model-scale');
                const rotationSlider = document.getElementById('model-rotation');
                if (scaleSlider) scaleSlider.disabled = true;
                if (rotationSlider) rotationSlider.disabled = true;
              }
            });
          }

          // Add model button
          const addModelBtn = document.getElementById('add-model-btn');
          if (addModelBtn) {
            addModelBtn.addEventListener('click', function() {
              const state = window.cesiumFunctions.getCesiumState();
              if (!state || !state.selectedModel) return;

              // Enable map click handler for model placement
              state.drawingMode = 'model-placement';
              this.textContent = 'Haritaya tıklayın...';
              this.disabled = true;
            });
          }

          // Clear models button
          const clearModelsBtn = document.getElementById('clear-models-btn');
          if (clearModelsBtn) {
            clearModelsBtn.addEventListener('click', function() {
              window.cesiumFunctions.clearModels();
            });
          }

          // Scale slider
          const scaleSlider = document.getElementById('model-scale');
          if (scaleSlider) {
            scaleSlider.addEventListener('input', function(e) {
              const value = parseFloat(this.value);
              const scaleValue = document.getElementById('scale-value');
              if (scaleValue) {
                scaleValue.textContent = Math.round(value * 500) + ' m²';
              }
            });
          }

          // Rotation slider
          const rotationSlider = document.getElementById('model-rotation');
          if (rotationSlider) {
            rotationSlider.addEventListener('input', function(e) {
              const value = parseInt(this.value);
              const rotationValue = document.getElementById('rotation-value');
              if (rotationValue) {
                rotationValue.textContent = value + '°';
              }
            });
          }

          // Tab navigation
          document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
              const targetTab = this.getAttribute('data-tab');
              document.querySelectorAll('.tab-btn').forEach(function(b) {
                b.classList.remove('active');
              });
              this.classList.add('active');

              document.querySelectorAll('.tab-content').forEach(function(content) {
                content.classList.remove('active');
              });
              const targetContent = document.getElementById('tab-content-' + targetTab);
              if (targetContent) {
                targetContent.classList.add('active');
              }
            });
          });

          // Parsel seçim butonu
          const selectParcelBtn = document.getElementById('select-parcel-btn');
          if (selectParcelBtn) {
            selectParcelBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              const isActive = state.drawingMode === 'parcel-selection';

              if (isActive) {
                state.drawingMode = null;
                this.classList.remove('active');
                viewer.canvas.style.cursor = '';
              } else {
                state.drawingMode = 'parcel-selection';
                this.classList.add('active');
                viewer.canvas.style.cursor = 'crosshair';
                
                // Diğer butonları pasif yap
                document.querySelectorAll('.shape-btn').forEach(function(b) {
                  b.classList.remove('active');
                });
                const measurementMenuBtn = document.getElementById('measurement-menu-btn');
                if (measurementMenuBtn) measurementMenuBtn.classList.remove('active');
                const measureDistanceBtn = document.getElementById('measure-distance-btn');
                if (measureDistanceBtn) measureDistanceBtn.classList.remove('active');
                const measureAreaBtn = document.getElementById('measure-area-btn');
                if (measureAreaBtn) {
                  measureAreaBtn.classList.remove('active');
                  const finishBtn = document.getElementById('area-finish-btn');
                  if (finishBtn) finishBtn.style.display = 'none';
                }
                
                // Ölçüm state'lerini temizle
                state.rulerPoints = [];
                state.areaPoints = [];
              }

              closeAllModals();
            });
          }

          // Ölçüm menü butonu - modal aç
          const measurementMenuBtn = document.getElementById('measurement-menu-btn');
          if (measurementMenuBtn) {
            measurementMenuBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              openModal('measurement-modal');
            });
          }

          // Ölçüm modal kapat butonu
          const measurementModalClose = document.getElementById('measurement-modal-close');
          if (measurementModalClose) {
            measurementModalClose.addEventListener('click', function(e) {
              e.stopPropagation();
              closeAllModals();
            });
          }

          // Mesafe ölçüm butonu
          const measureDistanceBtn = document.getElementById('measure-distance-btn');
          if (measureDistanceBtn) {
            measureDistanceBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              const isActive = state.drawingMode === 'measure-distance';
              const measurementMenuBtn = document.getElementById('measurement-menu-btn');
              const measureAreaBtn = document.getElementById('measure-area-btn');

              if (isActive) {
                // Pasif yap
                state.drawingMode = null;
                state.rulerPoints = [];
                this.classList.remove('active');
                viewer.canvas.style.cursor = '';
                if (measurementMenuBtn) measurementMenuBtn.classList.remove('active');
              } else {
                // Aktif yap
                state.drawingMode = 'measure-distance';
                state.rulerPoints = [];
                if (measureAreaBtn) measureAreaBtn.classList.remove('active');
                this.classList.add('active');
                viewer.canvas.style.cursor = 'crosshair';
                if (measurementMenuBtn) measurementMenuBtn.classList.add('active');
                
                // Diğer modları kapat
                const selectParcelBtn = document.getElementById('select-parcel-btn');
                if (selectParcelBtn) selectParcelBtn.classList.remove('active');
                document.querySelectorAll('.shape-btn').forEach(function(b) {
                  b.classList.remove('active');
                });
                state.drawingStartPos = null;
                state.drawingPoints = [];
                state.ellipseAxes = [];
              }

              closeAllModals();
            });
          }

          // Alan ölçüm butonu
          const measureAreaBtn = document.getElementById('measure-area-btn');
          if (measureAreaBtn) {
            measureAreaBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              const isActive = state.drawingMode === 'measure-area';
              const measurementMenuBtn = document.getElementById('measurement-menu-btn');
              const measureDistanceBtn = document.getElementById('measure-distance-btn');
              const finishBtn = document.getElementById('area-finish-btn');

              if (isActive) {
                // Pasif yap
                state.drawingMode = null;
                state.areaPoints = [];
                this.classList.remove('active');
                viewer.canvas.style.cursor = '';
                if (finishBtn) finishBtn.style.display = 'none';
                if (measurementMenuBtn) measurementMenuBtn.classList.remove('active');
              } else {
                // Aktif yap
                state.drawingMode = 'measure-area';
                state.areaPoints = [];
                if (measureDistanceBtn) measureDistanceBtn.classList.remove('active');
                this.classList.add('active');
                viewer.canvas.style.cursor = 'crosshair';
                if (measurementMenuBtn) measurementMenuBtn.classList.add('active');
                
                // Diğer modları kapat
                const selectParcelBtn = document.getElementById('select-parcel-btn');
                if (selectParcelBtn) selectParcelBtn.classList.remove('active');
                document.querySelectorAll('.shape-btn').forEach(function(b) {
                  b.classList.remove('active');
                });
                state.drawingStartPos = null;
                state.drawingPoints = [];
                state.ellipseAxes = [];
              }

              closeAllModals();
            });
          }

          const clearMeasurementsBtn = document.getElementById('clear-measurements-btn');
          if (clearMeasurementsBtn) {
            clearMeasurementsBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              window.cesiumFunctions.clearAllMeasurements();
              closeAllModals();
            });
          }

          // Area finish button
          const areaFinishBtn = document.getElementById('area-finish-btn');
          if (areaFinishBtn) {
            areaFinishBtn.addEventListener('click', function() {
              window.cesiumFunctions.finishAreaMeasurement();
            });
          }

          // Şekil menü butonu - modal aç
          const shapeMenuBtn = document.getElementById('shape-menu-btn');
          if (shapeMenuBtn) {
            shapeMenuBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              openModal('shape-modal');
            });
          }

          // Şekil modal kapat butonu
          const shapeModalClose = document.getElementById('shape-modal-close');
          if (shapeModalClose) {
            shapeModalClose.addEventListener('click', function(e) {
              e.stopPropagation();
              closeAllModals();
            });
          }

          // Şekil butonları
          document.querySelectorAll('.shape-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
              e.stopPropagation();
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              const shapeType = this.getAttribute('data-shape');
              state.drawingMode = shapeType;
              state.drawingStartPos = null;
              state.drawingPoints = [];
              state.ellipseAxes = [];

              document.querySelectorAll('.shape-btn').forEach(function(b) {
                b.classList.remove('active');
              });
              this.classList.add('active');
              
              // Diğer modları kapat
              const selectParcelBtn = document.getElementById('select-parcel-btn');
              if (selectParcelBtn) selectParcelBtn.classList.remove('active');
              
              const measurementMenuBtn = document.getElementById('measurement-menu-btn');
              if (measurementMenuBtn) measurementMenuBtn.classList.remove('active');
              const measureDistanceBtn = document.getElementById('measure-distance-btn');
              if (measureDistanceBtn) measureDistanceBtn.classList.remove('active');
              const measureAreaBtn = document.getElementById('measure-area-btn');
              if (measureAreaBtn) {
                measureAreaBtn.classList.remove('active');
                const finishBtn = document.getElementById('area-finish-btn');
                if (finishBtn) finishBtn.style.display = 'none';
              }
              
              // Ölçüm state'lerini temizle
              state.rulerPoints = [];
              state.areaPoints = [];

              viewer.canvas.style.cursor = 'crosshair';
              closeAllModals();
            });
          });

          // ============================================
          // MAP CLICK HANDLERS (Cesium ScreenSpaceEventHandler)
          // ============================================

          const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

          handler.setInputAction(function(click) {
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return;

            // Önce entity seçim kontrolü (drawing mode yoksa)
            if (!state.drawingMode) {
              const pickedObject = viewer.scene.pick(click.position);
              
              // Eğer entity seçilmediyse, mevcut seçimi temizle
              if (!pickedObject || !pickedObject.id) {
                if (state.selectedShape) {
                  const prevShape = state.shapes.find(function(s) { return s.id === state.selectedShape; });
                  if (prevShape && prevShape.entityIds) {
                    prevShape.entityIds.forEach(function(id) {
                      const e = state.viewer.entities.getById(id);
                      if (e) {
                        if (e.polygon) {
                          e.polygon.outlineWidth = prevShape.outlineWidth || 2;
                        } else if (e.polyline) {
                          e.polyline.width = prevShape.outlineWidth || 3;
                        }
                      }
                    });
                  }
                  
                  state.selectedShape = null;
                  state.selectedShapeEntityIds = [];
                  
                  // Sekmeleri kapat
                  const textTab = document.getElementById('tab-content-text');
                  const shapeTab = document.getElementById('tab-content-shape');
                  const textboxProps = document.getElementById('selected-textbox-properties');
                  const shapeProps = document.getElementById('selected-shape-properties');
                  const noTextbox = document.getElementById('no-textbox-selected');
                  
                  if (textTab) textTab.classList.remove('active');
                  if (shapeTab) shapeTab.classList.remove('active');
                  if (textboxProps) textboxProps.style.display = 'none';
                  if (shapeProps) shapeProps.style.display = 'none';
                  if (noTextbox) noTextbox.style.display = 'block';
                  
                  document.querySelectorAll('.tab-btn').forEach(function(btn) {
                    btn.classList.remove('active');
                  });
                  
                  state.viewer.scene.requestRender();
                }
                return; // Entity seçilmedi, devam etme
              }
              
              const entity = pickedObject.id;
              const entityId = entity.id;
              
              // Şekil seçimi kontrolü
              const shape = state.shapes.find(function(s) {
                return s.entityIds && s.entityIds.indexOf(entityId) !== -1;
              });
              
              if (shape) {
                  // Şekil seçildi
                  if (state.selectedShape === shape.id) {
                    // Zaten seçili, seçimi kaldır
                    state.selectedShape = null;
                    state.selectedShapeEntityIds = [];
                    
                    // Entity highlight'ı kaldır
                    shape.entityIds.forEach(function(id) {
                      const e = state.viewer.entities.getById(id);
                      if (e) {
                        if (e.polygon) {
                          e.polygon.outlineWidth = shape.outlineWidth || 2;
                        } else if (e.polyline) {
                          e.polyline.width = shape.outlineWidth || 3;
                        }
                      }
                    });
                    
                    // Text sekmesini kapat
                    const textTab = document.getElementById('tab-content-text');
                    const shapeTab = document.getElementById('tab-content-shape');
                    if (textTab) textTab.classList.remove('active');
                    if (shapeTab) shapeTab.classList.remove('active');
                    document.querySelectorAll('.tab-btn').forEach(function(btn) {
                      btn.classList.remove('active');
                    });
                  } else {
                    // Yeni şekil seç
                    // Önceki seçimi temizle
                    if (state.selectedShape) {
                      const prevShape = state.shapes.find(function(s) { return s.id === state.selectedShape; });
                      if (prevShape && prevShape.entityIds) {
                        prevShape.entityIds.forEach(function(id) {
                          const e = state.viewer.entities.getById(id);
                          if (e) {
                            if (e.polygon) {
                              e.polygon.outlineWidth = prevShape.outlineWidth || 2;
                            } else if (e.polyline) {
                              e.polyline.width = prevShape.outlineWidth || 3;
                            }
                          }
                        });
                      }
                    }
                    
                    state.selectedShape = shape.id;
                    state.selectedShapeEntityIds = shape.entityIds || [];
                    
                    // Entity highlight
                    shape.entityIds.forEach(function(id) {
                      const e = state.viewer.entities.getById(id);
                      if (e) {
                        if (e.polygon) {
                          e.polygon.outlineWidth = (shape.outlineWidth || 2) * 2;
                        } else if (e.polyline) {
                          e.polyline.width = (shape.outlineWidth || 3) * 2;
                        }
                      }
                    });
                    
                    // Textbox ise text sekmesini aç, değilse shape sekmesini aç
                    if (shape.type === 'textbox') {
                      const textTabBtn = document.getElementById('tab-btn-text');
                      const textTab = document.getElementById('tab-content-text');
                      if (textTabBtn && textTab) {
                        document.querySelectorAll('.tab-btn').forEach(function(btn) {
                          btn.classList.remove('active');
                        });
                        document.querySelectorAll('.tab-content').forEach(function(content) {
                          content.classList.remove('active');
                        });
                        textTabBtn.classList.add('active');
                        textTab.classList.add('active');
                        
                        // Textbox özelliklerini göster
                        const textboxProps = document.getElementById('selected-textbox-properties');
                        const noTextbox = document.getElementById('no-textbox-selected');
                        const textboxContent = document.getElementById('textbox-properties-content');
                        
                        if (textboxProps && textboxContent && noTextbox) {
                          textboxProps.style.display = 'block';
                          noTextbox.style.display = 'none';
                          
                          textboxContent.innerHTML = 
                            '<div style="margin-bottom: 12px;">' +
                            '<label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;">Metin:</label>' +
                            '<input type="text" id="textbox-text-input" class="shape-input" value="' + 
                            (shape.text || '') + '" style="width: 100%; padding: 8px 12px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 6px; color: white; font-size: 13px;">' +
                            '</div>' +
                            '<div style="margin-bottom: 12px;">' +
                            '<label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;">Arka Plan Rengi:</label>' +
                            '<input type="color" id="textbox-fill-color" value="' + (shape.fillColor || '#3b82f6') + '" class="color-picker">' +
                            '</div>' +
                            '<div style="margin-bottom: 12px;">' +
                            '<label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;">Metin Rengi:</label>' +
                            '<input type="color" id="textbox-text-color" value="' + (shape.textColor || '#ffffff') + '" class="color-picker">' +
                            '</div>';
                          
                          // Event listeners
                          const textInput = document.getElementById('textbox-text-input');
                          const fillColorInput = document.getElementById('textbox-fill-color');
                          const textColorInput = document.getElementById('textbox-text-color');
                          
                          if (textInput) {
                            textInput.addEventListener('input', function() {
                              const entity = state.viewer.entities.getById(shape.entityIds[0]);
                              if (entity && entity.label) {
                                entity.label.text = this.value;
                                shape.text = this.value;
                                state.viewer.scene.requestRender();
                              }
                            });
                          }
                          
                          if (fillColorInput) {
                            fillColorInput.addEventListener('change', function() {
                              const entity = state.viewer.entities.getById(shape.entityIds[0]);
                              if (entity && entity.label) {
                                const fillColor = window.cesiumFunctions.hexToCesiumColor(this.value);
                                entity.label.backgroundColor = fillColor;
                                shape.fillColor = this.value;
                                state.viewer.scene.requestRender();
                              }
                            });
                          }
                          
                          if (textColorInput) {
                            textColorInput.addEventListener('change', function() {
                              const entity = state.viewer.entities.getById(shape.entityIds[0]);
                              if (entity && entity.label) {
                                const textColor = window.cesiumFunctions.hexToCesiumColor(this.value);
                                entity.label.fillColor = textColor;
                                shape.textColor = this.value;
                                state.viewer.scene.requestRender();
                              }
                            });
                          }
                          
                          // Delete button
                          const deleteBtn = document.getElementById('delete-textbox-btn');
                          if (deleteBtn) {
                            deleteBtn.addEventListener('click', function() {
                              if (confirm('Bu metni silmek istediğinize emin misiniz?')) {
                                shape.entityIds.forEach(function(id) {
                                  try {
                                    state.viewer.entities.removeById(id);
                                  } catch (e) {
                                    console.warn('[Handlers] Error removing entity:', id, e);
                                  }
                                });
                                
                                window.cesiumFunctions.removeShape(shape.id);
                                
                                if (state.selectedShape === shape.id) {
                                  state.selectedShape = null;
                                  state.selectedShapeEntityIds = [];
                                  textboxProps.style.display = 'none';
                                  if (noTextbox) noTextbox.style.display = 'block';
                                }
                                
                                if (window.sendToReactNative) {
                                  window.sendToReactNative('shape-deleted', {
                                    shapeId: shape.id,
                                    type: shape.type
                                  });
                                }
                                
                                state.viewer.scene.requestRender();
                              }
                            });
                          }
                        }
                      }
                    } else {
                      const shapeTabBtn = document.getElementById('tab-btn-shape');
                      const shapeTab = document.getElementById('tab-content-shape');
                      if (shapeTabBtn && shapeTab) {
                        document.querySelectorAll('.tab-btn').forEach(function(btn) {
                          btn.classList.remove('active');
                        });
                        document.querySelectorAll('.tab-content').forEach(function(content) {
                          content.classList.remove('active');
                        });
                        shapeTabBtn.classList.add('active');
                        shapeTab.classList.add('active');
                        
                        // Shape özelliklerini göster
                        const shapeProps = document.getElementById('selected-shape-properties');
                        const shapeContent = document.getElementById('shape-properties-content');
                        
                        if (shapeProps && shapeContent) {
                          shapeProps.style.display = 'block';
                          
                          shapeContent.innerHTML = 
                            '<div style="margin-bottom: 12px;">' +
                            '<label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;">Şekil Tipi:</label>' +
                            '<div style="font-size: 14px; font-weight: 600; color: #1e293b;">' + shape.type + '</div>' +
                            '</div>' +
                            '<div style="margin-bottom: 12px;">' +
                            '<label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;">Kenar Rengi:</label>' +
                            '<input type="color" id="shape-outline-color" value="' + (shape.outlineColor || '#2563eb') + '" class="color-picker">' +
                            '</div>' +
                            (shape.fillColor ? '<div style="margin-bottom: 12px;">' +
                            '<label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;">Dolgu Rengi:</label>' +
                            '<input type="color" id="shape-fill-color" value="' + shape.fillColor + '" class="color-picker">' +
                            '</div>' : '') +
                            '<div style="margin-bottom: 12px;">' +
                            '<label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;">Kenar Kalınlığı:</label>' +
                            '<input type="range" id="shape-outline-width" min="1" max="10" value="' + (shape.outlineWidth || 2) + '" style="width: 100%;">' +
                            '<div style="text-align: center; font-size: 12px; color: #64748b; margin-top: 4px;">' + (shape.outlineWidth || 2) + 'px</div>' +
                            '</div>' +
                            '<div class="form-actions" style="margin-top: 16px;">' +
                            '<button class="btn-clear" id="delete-shape-btn">🗑️ Şekli Sil</button>' +
                            '</div>';
                          
                          // Event listeners
                          const outlineColorInput = document.getElementById('shape-outline-color');
                          const fillColorInput = document.getElementById('shape-fill-color');
                          const outlineWidthInput = document.getElementById('shape-outline-width');
                          const deleteBtn = document.getElementById('delete-shape-btn');
                          
                          if (outlineColorInput) {
                            outlineColorInput.addEventListener('change', function() {
                              shape.entityIds.forEach(function(id) {
                                const entity = state.viewer.entities.getById(id);
                                if (entity) {
                                  const color = window.cesiumFunctions.hexToCesiumColor(this.value);
                                  if (entity.polygon) {
                                    entity.polygon.outlineColor = color;
                                  } else if (entity.polyline) {
                                    entity.polyline.material = color;
                                  }
                                }
                              });
                              shape.outlineColor = this.value;
                              state.viewer.scene.requestRender();
                            });
                          }
                          
                          if (fillColorInput) {
                            fillColorInput.addEventListener('change', function() {
                              shape.entityIds.forEach(function(id) {
                                const entity = state.viewer.entities.getById(id);
                                if (entity && entity.polygon) {
                                  const color = window.cesiumFunctions.hexToCesiumColor(this.value);
                                  const opacity = shape.fillOpacity !== undefined ? shape.fillOpacity : 0.5;
                                  entity.polygon.material = color.withAlpha(opacity);
                                }
                              });
                              shape.fillColor = this.value;
                              state.viewer.scene.requestRender();
                            });
                          }
                          
                          if (outlineWidthInput) {
                            outlineWidthInput.addEventListener('input', function() {
                              const width = parseInt(this.value);
                              shape.entityIds.forEach(function(id) {
                                const entity = state.viewer.entities.getById(id);
                                if (entity) {
                                  if (entity.polygon) {
                                    entity.polygon.outlineWidth = width;
                                  } else if (entity.polyline) {
                                    entity.polyline.width = width;
                                  }
                                }
                              });
                              shape.outlineWidth = width;
                              document.querySelector('#shape-outline-width').nextElementSibling.textContent = width + 'px';
                              state.viewer.scene.requestRender();
                            });
                          }
                          
                          if (deleteBtn) {
                            deleteBtn.addEventListener('click', function() {
                              if (confirm('Bu şekli silmek istediğinize emin misiniz?')) {
                                shape.entityIds.forEach(function(id) {
                                  try {
                                    state.viewer.entities.removeById(id);
                                  } catch (e) {
                                    console.warn('[Handlers] Error removing entity:', id, e);
                                  }
                                });
                                
                                window.cesiumFunctions.removeShape(shape.id);
                                
                                if (state.selectedShape === shape.id) {
                                  state.selectedShape = null;
                                  state.selectedShapeEntityIds = [];
                                  shapeProps.style.display = 'none';
                                }
                                
                                if (window.sendToReactNative) {
                                  window.sendToReactNative('shape-deleted', {
                                    shapeId: shape.id,
                                    type: shape.type
                                  });
                                }
                                
                                state.viewer.scene.requestRender();
                              }
                            });
                          }
                        }
                      }
                    }
                    
                    // React Native'e mesaj gönder
                    if (window.sendToReactNative) {
                      window.sendToReactNative('shape-selected', {
                        shapeId: shape.id,
                        type: shape.type,
                        properties: shape
                      });
                    }
                    
                    state.viewer.scene.requestRender();
                    return;
                  }
                  
                  state.viewer.scene.requestRender();
                  return;
                }
              }
            }

            // Terrain'e göre doğru koordinat al (ana projedeki pickTerrainPosition yöntemi)
            // Bu yöntem entity'leri ignore eder, sadece terrain/globe ile çalışır
            let cartesian = null;
            let lon = 0;
            let lat = 0;

            // Ray oluştur (camera'dan tıklanan ekran pozisyonuna)
            const ray = viewer.camera.getPickRay(click.position);
            if (!ray) {
              console.warn('[Handlers] Could not create pick ray');
              return;
            }

            // Önce globe.pick dene (terrain-aware, entity'leri ignore eder)
            // Bu, terrain yüksekliğini hesaba katarak globe üzerinde nokta bulur
            cartesian = viewer.scene.globe.pick(ray, viewer.scene);

            // Fallback: pickEllipsoid (terrain yoksa veya pick başarısızsa)
            if (!cartesian || !Cesium.defined(cartesian)) {
              cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            }

            if (!cartesian || !Cesium.defined(cartesian)) {
              console.warn('[Handlers] Could not determine click position');
              return;
            }

            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            lon = Cesium.Math.toDegrees(cartographic.longitude);
            lat = Cesium.Math.toDegrees(cartographic.latitude);

            // Model placement
            if (state.drawingMode === 'model-placement' && state.selectedModel) {
              const scaleSlider = document.getElementById('model-scale');
              const rotationSlider = document.getElementById('model-rotation');
              const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;
              const rotation = rotationSlider ? parseInt(rotationSlider.value) : 0;

              window.cesiumFunctions.addModelToMap(lon, lat, state.selectedType, state.selectedFile, scale, rotation).then(function(entityId) {
                if (entityId) {
                  state.drawingMode = null;
                  const addBtn = document.getElementById('add-model-btn');
                  if (addBtn) {
                    addBtn.textContent = '➕ Model Ekle';
                    addBtn.disabled = false;
                  }
                  viewer.canvas.style.cursor = '';
                }
              });
              return;
            }

            // Parcel selection
            if (state.drawingMode === 'parcel-selection') {
              window.cesiumFunctions.handleParcelSelectionClick(lon, lat).then(function(result) {
                if (result) {
                  state.drawingMode = null;
                  const selectParcelBtn = document.getElementById('select-parcel-btn');
                  if (selectParcelBtn) {
                    selectParcelBtn.classList.remove('active');
                  }
                  viewer.canvas.style.cursor = '';
                }
              });
              return;
            }

            // Distance measurement
            if (state.drawingMode === 'measure-distance') {
              window.cesiumFunctions.addDistanceMeasurementPoint({ lon: lon, lat: lat });
              return;
            }

            // Area measurement
            if (state.drawingMode === 'measure-area') {
              window.cesiumFunctions.addAreaMeasurementPoint({ lon: lon, lat: lat });
              return;
            }

            // Shape drawing
            if (state.drawingMode && ['rectangle', 'triangle', 'circle', 'ellipse', 'polygon', 'line', 'arrow', 'marker', 'textbox'].includes(state.drawingMode)) {
              if (state.drawingMode === 'rectangle') {
                if (!state.drawingStartPos) {
                  state.drawingStartPos = { lon: lon, lat: lat };
                } else {
                  drawRectangle(state.drawingStartPos, { lon: lon, lat: lat });
                  state.drawingMode = null;
                  state.drawingStartPos = null;
                  viewer.canvas.style.cursor = '';
                  document.querySelectorAll('.shape-btn').forEach(function(btn) {
                    btn.classList.remove('active');
                  });
                }
              } else if (state.drawingMode === 'triangle') {
                if (!state.drawingPoints) {
                  state.drawingPoints = [];
                }
                state.drawingPoints.push({ lon: lon, lat: lat });
                if (state.drawingPoints.length === 3) {
                  drawTriangle(state.drawingPoints);
                  state.drawingMode = null;
                  state.drawingPoints = [];
                  viewer.canvas.style.cursor = '';
                  document.querySelectorAll('.shape-btn').forEach(function(btn) {
                    btn.classList.remove('active');
                  });
                }
              } else if (state.drawingMode === 'circle') {
                if (!state.drawingStartPos) {
                  state.drawingStartPos = { lon: lon, lat: lat };
                } else {
                  drawCircle(state.drawingStartPos, { lon: lon, lat: lat });
                  state.drawingMode = null;
                  state.drawingStartPos = null;
                  viewer.canvas.style.cursor = '';
                  document.querySelectorAll('.shape-btn').forEach(function(btn) {
                    btn.classList.remove('active');
                  });
                }
              } else if (state.drawingMode === 'ellipse') {
                if (!state.drawingStartPos) {
                  state.drawingStartPos = { lon: lon, lat: lat };
                  if (!state.ellipseAxes) {
                    state.ellipseAxes = [];
                  }
                } else if (state.ellipseAxes.length === 0) {
                  state.ellipseAxes.push({ lon: lon, lat: lat });
                } else if (state.ellipseAxes.length === 1) {
                  drawEllipse(state.drawingStartPos, state.ellipseAxes[0], { lon: lon, lat: lat });
                  state.drawingMode = null;
                  state.drawingStartPos = null;
                  state.ellipseAxes = [];
                  viewer.canvas.style.cursor = '';
                  document.querySelectorAll('.shape-btn').forEach(function(btn) {
                    btn.classList.remove('active');
                  });
                }
              } else if (state.drawingMode === 'polygon') {
                if (!state.drawingPoints) {
                  state.drawingPoints = [];
                }
                state.drawingPoints.push({ lon: lon, lat: lat });
              } else if (state.drawingMode === 'line') {
                if (!state.drawingPoints) {
                  state.drawingPoints = [];
                }
                state.drawingPoints.push({ lon: lon, lat: lat });
              } else if (state.drawingMode === 'arrow') {
                if (!state.drawingStartPos) {
                  state.drawingStartPos = { lon: lon, lat: lat };
                } else {
                  drawArrow(state.drawingStartPos, { lon: lon, lat: lat });
                  state.drawingMode = null;
                  state.drawingStartPos = null;
                  viewer.canvas.style.cursor = '';
                  document.querySelectorAll('.shape-btn').forEach(function(btn) {
                    btn.classList.remove('active');
                  });
                }
              } else if (state.drawingMode === 'marker') {
                drawMarker({ lon: lon, lat: lat });
                state.drawingMode = null;
                viewer.canvas.style.cursor = '';
                document.querySelectorAll('.shape-btn').forEach(function(btn) {
                  btn.classList.remove('active');
                });
              } else if (state.drawingMode === 'textbox') {
                drawTextBox({ lon: lon, lat: lat });
                state.drawingMode = null;
                viewer.canvas.style.cursor = '';
                document.querySelectorAll('.shape-btn').forEach(function(btn) {
                  btn.classList.remove('active');
                });
              }
            }
          }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

          // Double-click to finish polygon/line
          handler.setInputAction(function(click) {
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return;

            if (state.drawingMode === 'polygon' && state.drawingPoints && state.drawingPoints.length >= 3) {
              drawPolygon(state.drawingPoints);
              state.drawingMode = null;
              state.drawingPoints = [];
              viewer.canvas.style.cursor = '';
              document.querySelectorAll('.shape-btn').forEach(function(btn) {
                btn.classList.remove('active');
              });
            } else if (state.drawingMode === 'line' && state.drawingPoints && state.drawingPoints.length >= 2) {
              drawLine(state.drawingPoints);
              state.drawingMode = null;
              state.drawingPoints = [];
              viewer.canvas.style.cursor = '';
              document.querySelectorAll('.shape-btn').forEach(function(btn) {
                btn.classList.remove('active');
              });
            }
          }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

          // Long press handler for mobile delete
          let longPressTimer = null;
          let longPressStartPos = null;
          
          handler.setInputAction(function(movement) {
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return;
            
            // Long press başlat
            if (longPressTimer) {
              clearTimeout(longPressTimer);
            }
            
            longPressStartPos = movement.endPosition;
            longPressTimer = setTimeout(function() {
              if (longPressStartPos) {
                const pickedObject = viewer.scene.pick(longPressStartPos);
                if (pickedObject && pickedObject.id) {
                  const entity = pickedObject.id;
                  const entityId = entity.id;
                  
                  // Şekil bul
                  const shape = state.shapes.find(function(s) {
                    return s.entityIds && s.entityIds.indexOf(entityId) !== -1;
                  });
                  
                  if (shape) {
                    // Silme onayı
                    if (confirm('Bu şekli silmek istediğinize emin misiniz?')) {
                      // Şekli sil
                      shape.entityIds.forEach(function(id) {
                        try {
                          state.viewer.entities.removeById(id);
                        } catch (e) {
                          console.warn('[Handlers] Error removing entity:', id, e);
                        }
                      });
                      
                      // State'den kaldır
                      window.cesiumFunctions.removeShape(shape.id);
                      
                      // Seçim temizle
                      if (state.selectedShape === shape.id) {
                        state.selectedShape = null;
                        state.selectedShapeEntityIds = [];
                      }
                      
                      // React Native'e mesaj gönder
                      if (window.sendToReactNative) {
                        window.sendToReactNative('shape-deleted', {
                          shapeId: shape.id,
                          type: shape.type
                        });
                      }
                      
                      state.viewer.scene.requestRender();
                    }
                  }
                }
              }
              longPressStartPos = null;
            }, 800); // 800ms long press
          }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
          
          handler.setInputAction(function(click) {
            // Long press iptal et
            if (longPressTimer) {
              clearTimeout(longPressTimer);
              longPressTimer = null;
            }
            longPressStartPos = null;
          }, Cesium.ScreenSpaceEventType.LEFT_UP);

          console.log('[Handlers] Event handlers initialized');
        }
      })();
    </script>
  `;
}
