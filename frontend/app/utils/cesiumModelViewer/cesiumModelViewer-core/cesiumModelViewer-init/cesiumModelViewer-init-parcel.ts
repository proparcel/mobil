/**
 * Cesium Model Viewer - Parcel Selection Functions
 * Parsel seçim fonksiyonları
 *
 * Bu modül parsel seçimi ve görüntüleme ile ilgili fonksiyonları içerir.
 */

/**
 * Parcel selection fonksiyonlarını içeren JavaScript kodunu oluştur
 * @returns Parcel selection functions JavaScript string"i
 */
export function generateParcelSelectionScript(): string {
  return `
        // ============================================
        // PARCEL SELECTION FUNCTIONS
        // ============================================

        async function handleParcelSelectionClick(lon, lat) {
          const state = getCesiumState();
          if (!state || !state.viewer) {
            console.warn("[Parcel] Viewer not available");
            return null;
          }

          const Cesium = window.Cesium;
          if (!Cesium) {
            console.warn("[Parcel] Cesium not available");
            return null;
          }

          // Loading overlay göster
          const loadingOverlay = document.getElementById("loading-overlay");
          if (loadingOverlay) {
            loadingOverlay.classList.remove("hidden");
            loadingOverlay.innerHTML = "<div style=\\\"font-size: 16px; margin-bottom: 8px;\\\">Parsel yükleniyor...</div><div style=\\\"font-size: 12px; color: #94a3b8;\\\">Lütfen bekleyin</div>";
          }

          try {
            const apiUrl = window.BACKEND_URL + "/api/tkgm_view/";
            console.log("[Parcel] Fetching from:", apiUrl, { lon: lon, lat: lat });

            const response = await fetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lat: lat,
                lon: lon,
                map_mode: "2d",
                is3D: false
              })
            });

            if (!response.ok) {
              const errorText = await response.text().catch(function() { return ""; });
              throw new Error("API error: " + response.status + " - " + response.statusText);
            }

            const data = await response.json();

            if (!data.geometry) {
              console.warn("[Parcel] No geometry found");
              if (loadingOverlay) loadingOverlay.classList.add("hidden");
              return null;
            }

            // Clear old parcel
            const oldEntityIds = state.parcelEntityIds.slice();
            oldEntityIds.forEach(function(entityId) {
              try {
                state.viewer.entities.removeById(entityId);
              } catch (e) {}
            });
            clearParcelState();

            const geometry = data.geometry;
            let coords = [];

            // Koordinatları al
            if (geometry.type === "Polygon" && geometry.coordinates && geometry.coordinates[0]) {
              coords = geometry.coordinates[0];
            } else if (geometry.type === "MultiPolygon" && geometry.coordinates) {
              if (geometry.coordinates[0] && geometry.coordinates[0][0]) {
                coords = geometry.coordinates[0][0];
              }
            } else {
              console.warn("[Parcel] Unsupported geometry type:", geometry.type);
              if (loadingOverlay) loadingOverlay.classList.add("hidden");
              return null;
            }

            if (coords.length < 3) {
              console.warn("[Parcel] Insufficient coordinates");
              if (loadingOverlay) loadingOverlay.classList.add("hidden");
              return null;
            }

            // Parsel alanını hesapla
            const areaM2 = calculateArea(coords);
            const areaText = formatArea(areaM2);
            
            // Parsel bilgilerini al
            const properties = data.properties || {};
            const adaNo = properties.ada_no || properties.adaNo || "";
            const parselNo = properties.parsel_no || properties.parselNo || "";
            const adaParselText = (adaNo && parselNo) ? adaNo + "/" + parselNo : (adaNo || parselNo || "Ada/Parsel");

            // Tüm koordinatları Cartographic"e çevir
            const cartographics = coords.map(function(coord) {
              return Cesium.Cartographic.fromDegrees(coord[0], coord[1]);
            });

            // Terrain yüksekliklerini al (tüm noktaları bir kerede) ve Promise döndür
            return Cesium.sampleTerrainMostDetailed(state.viewer.terrainProvider, cartographics)
              .then(function(updatedCartographics) {
                // Yükseklikleri al ve pozisyonları oluştur
                const positions = updatedCartographics.map(function(cartographic) {
                  const height = cartographic.height || 0;
                  return Cesium.Cartesian3.fromRadians(
                    cartographic.longitude,
                    cartographic.latitude,
                    height
                  );
                });

                const fillColor = hexToCesiumColor("#3b82f6");
                const outlineColor = hexToCesiumColor("#2563eb");

                const parcelEntityId = "parcel-" + Date.now();
                
                // Terrain yüksekliğine göre sabit çizim - perPositionHeight ile her nokta kendi yüksekliğinde
                state.viewer.entities.add({
                  id: parcelEntityId,
                  name: "Parcel",
                  polygon: {
                    hierarchy: positions,
                    material: fillColor.withAlpha(0.3),
                    outline: true,
                    outlineColor: outlineColor,
                    outlineWidth: 3,
                    perPositionHeight: true
                  }
                });

                // Parsel sağ kenarına label ekle
                // En sağdaki noktayı bul
                let rightmostLon = -Infinity;
                let rightmostIndex = 0;
                coords.forEach(function(coord, index) {
                  if (coord[0] > rightmostLon) {
                    rightmostLon = coord[0];
                    rightmostIndex = index;
                  }
                });

                const rightmostCoord = coords[rightmostIndex];
                const rightmostCartographic = updatedCartographics[rightmostIndex];
                const labelPosition = Cesium.Cartesian3.fromRadians(
                  rightmostCartographic.longitude,
                  rightmostCartographic.latitude,
                  (rightmostCartographic.height || 0) + 5
                );

                // Label entity ekle
                const labelEntityId = parcelEntityId + "-label";
                state.viewer.entities.add({
                  id: labelEntityId,
                  name: "Parcel Label",
                  position: labelPosition,
                  label: {
                    text: adaParselText + "\\n" + areaText,
                    font: "16pt sans-serif",
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 3,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                    pixelOffset: new Cesium.Cartesian2(10, 0),
                    backgroundColor: fillColor.withAlpha(0.9),
                    backgroundPadding: new Cesium.Cartesian2(12, 8),
                    showBackground: true,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scale: 1.0
                  }
                });

                addParcelEntity(labelEntityId);
                addParcelEntity(parcelEntityId);
                state.drawingMode = null;

                // Loading overlay"i gizle
                if (loadingOverlay) {
                  loadingOverlay.classList.add("hidden");
                }

                if (window.sendToReactNative) {
                  window.sendToReactNative("parcel-selected", {
                    geometry: geometry,
                    properties: data.properties || {},
                    entityId: parcelEntityId,
                    area: areaM2,
                    areaText: areaText
                  });
                }

                state.viewer.scene.requestRender();
                console.log("[Parcel] Parcel selected with terrain heights:", parcelEntityId);

                return {
                  geometry: geometry,
                  properties: data.properties || {}
                };
              })
              .catch(function(error) {
                console.error("[Parcel] Terrain sampling error:", error);
                // Hata durumunda yükseklik olmadan çiz
                const positions = coords.map(function(coord) {
                  return Cesium.Cartesian3.fromDegrees(coord[0], coord[1], 0);
                });

                const fillColor = hexToCesiumColor("#3b82f6");
                const outlineColor = hexToCesiumColor("#2563eb");

                const parcelEntityId = "parcel-" + Date.now();
                
                state.viewer.entities.add({
                  id: parcelEntityId,
                  name: "Parcel",
                  polygon: {
                    hierarchy: positions,
                    material: fillColor.withAlpha(0.3),
                    outline: true,
                    outlineColor: outlineColor,
                    outlineWidth: 3,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                  }
                });

                // Parsel sağ kenarına label ekle (terrain olmadan)
                let rightmostLon = -Infinity;
                let rightmostIndex = 0;
                coords.forEach(function(coord, index) {
                  if (coord[0] > rightmostLon) {
                    rightmostLon = coord[0];
                    rightmostIndex = index;
                  }
                });

                const rightmostCoord = coords[rightmostIndex];
                const labelPosition = Cesium.Cartesian3.fromDegrees(rightmostCoord[0], rightmostCoord[1], 5);

                const labelEntityId = parcelEntityId + "-label";
                state.viewer.entities.add({
                  id: labelEntityId,
                  name: "Parcel Label",
                  position: labelPosition,
                  label: {
                    text: adaParselText + "\\n" + areaText,
                    font: "16pt sans-serif",
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 3,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                    pixelOffset: new Cesium.Cartesian2(10, 0),
                    backgroundColor: fillColor.withAlpha(0.9),
                    backgroundPadding: new Cesium.Cartesian2(12, 8),
                    showBackground: true,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                  }
                });

                addParcelEntity(labelEntityId);
                addParcelEntity(parcelEntityId);
                state.drawingMode = null;

                // Loading overlay"i gizle
                if (loadingOverlay) {
                  loadingOverlay.classList.add("hidden");
                }

                if (window.sendToReactNative) {
                  window.sendToReactNative("parcel-selected", {
                    geometry: geometry,
                    properties: data.properties || {},
                    entityId: parcelEntityId,
                    area: areaM2,
                    areaText: areaText
                  });
                }

                state.viewer.scene.requestRender();

                return {
                  geometry: geometry,
                  properties: data.properties || {}
                };
              });
          } catch (e) {
            console.error("[Parcel] Selection error:", e);
            // Loading overlay"i gizle
            const loadingOverlay = document.getElementById("loading-overlay");
            if (loadingOverlay) {
              loadingOverlay.classList.add("hidden");
            }
            if (window.sendToReactNative) {
              window.sendToReactNative("error", {
                message: "Parsel seçilemedi: " + e.message,
                type: "parcel_selection_error",
                url: window.BACKEND_URL + "/api/tkgm_view/"
              });
            }
            return null;
          }
        }
  `;
}
