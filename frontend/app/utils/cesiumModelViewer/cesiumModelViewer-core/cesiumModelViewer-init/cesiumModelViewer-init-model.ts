/**
 * Cesium Model Viewer - Model Management Functions
 * 3D model yönetimi fonksiyonları
 *
 * Bu modül 3D modellerin yüklenmesi, haritaya eklenmesi ve temizlenmesi ile ilgili fonksiyonları içerir.
 */

/**
 * Model management fonksiyonlarını içeren JavaScript kodunu oluştur
 * @returns Model management functions JavaScript string"i
 */
export function generateModelManagementScript(): string {
  return `
        // ============================================
        // MODEL MANAGEMENT FUNCTIONS
        // ============================================

        async function loadModelsList() {
          const dropdown = document.getElementById("model-select-dropdown");
          if (!dropdown) {
            console.warn("[Model] Dropdown not found");
            return;
          }

          try {
            dropdown.innerHTML = "<option value=\\\"\\\">Modeller yükleniyor...</option>";
            const apiUrl = window.BACKEND_URL + "/api/3d-models-list/";
            console.log("[Model] Loading from:", apiUrl);

            const controller = new AbortController();
            const timeoutId = setTimeout(function() { controller.abort(); }, 10000);

            let response;
            try {
              response = await fetch(apiUrl, {
                method: "GET",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                mode: "cors",
                signal: controller.signal
              });
            } catch (fetchError) {
              clearTimeout(timeoutId);
              if (fetchError.name === "AbortError") {
                throw new Error("İstek zaman aşımına uğradı (10 saniye)");
              } else {
                throw new Error("Backend sunucusuna bağlanılamadı: " + apiUrl);
              }
            }

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error("API error: " + response.status);
            }

            const data = await response.json();
            if (!data || typeof data !== "object") {
              throw new Error("Invalid API response");
            }

            let html = "<option value=\\\"\\\">-- Model Seçin --</option>";
            const categories = {
              house: { label: "🏠 Ev Modelleri", models: data.house || [] },
              car: { label: "🚗 Araç Modelleri", models: data.car || [] },
              tree: { label: "🌳 Ağaç Modelleri", models: data.tree || [] }
            };

            Object.keys(categories).forEach(function(type) {
              const category = categories[type];
              if (category.models.length > 0) {
                html += '<optgroup label="' + category.label + '">';
                category.models.forEach(function(model) {
                  html += '<option value="' + type + ':' + model.file + '">' + model.name + '</option>';
                });
                html += "</optgroup>";
              }
            });

            dropdown.innerHTML = html;
            const totalCount = Object.values(data).flat().length;
            console.log("[Model] Models loaded:", totalCount);

            if (window.sendToReactNative) {
              window.sendToReactNative("models-loaded", { count: totalCount });
            }
          } catch (e) {
            console.error("[Model] Load error:", e);
            dropdown.innerHTML = "<option value=\\\"\\\">Model listesi yüklenemedi</option>";
            if (window.sendToReactNative) {
              window.sendToReactNative("error", {
                message: e.message || "Model listesi yüklenemedi",
                url: window.BACKEND_URL + "/api/3d-models-list/",
                type: "api_error"
              });
            }
          }
        }

        async function addModelToMap(lon, lat, modelType, modelFile, scale, rotationDeg) {
          scale = scale || 1.0;
          rotationDeg = rotationDeg || 0;
          const state = getCesiumState();
          if (!state || !state.viewer) {
            console.warn("[Model] Viewer not available");
            return null;
          }

          const Cesium = window.Cesium;
          if (!Cesium) {
            console.warn("[Model] Cesium not available");
            return null;
          }

          try {
            const modelUrl = window.STATIC_URL + "/models/" + modelType + "/" + modelFile;
            console.log("[Model] Loading model from:", modelUrl);

            const position = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
            const heading = Cesium.Math.toRadians(rotationDeg);
            const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

            const entityId = "model-" + modelType + "-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);

            const entity = state.viewer.entities.add({
              id: entityId,
              name: modelType + " - " + modelFile,
              position: position,
              orientation: orientation,
              model: {
                uri: modelUrl,
                scale: scale,
                minimumPixelSize: 0,
                maximumScale: 20000
              }
            });

            if (entity.model && entity.model.readyPromise) {
              try {
                await entity.model.readyPromise;
                console.log("[Model] Model loaded:", entityId);
              } catch (e) {
                console.warn("[Model] Model load warning:", e);
              }
            }

            addModelEntity(entityId, entity);
            state.viewer.scene.requestRender();

            if (window.sendToReactNative) {
              window.sendToReactNative("model-added", {
                entityId: entityId,
                count: state.modelEntities.size,
                lon: lon,
                lat: lat,
                type: modelType,
                file: modelFile
              });
            }

            return entityId;
          } catch (e) {
            console.error("[Model] Add error:", e);
            if (window.sendToReactNative) {
              window.sendToReactNative("error", {
                message: "Model eklenemedi: " + e.message,
                type: "model_add_error"
              });
            }
            return null;
          }
        }

        function clearModels() {
          const state = getCesiumState();
          if (!state || !state.viewer) {
            console.warn("[Model] Viewer not available");
            return;
          }

          try {
            const entityIds = [];
            state.modelEntities.forEach(function(entity, entityId) {
              if (entity.model) {
                state.viewer.entities.remove(entity);
                entityIds.push(entityId);
              }
            });

            clearModelState();

            state.previewEntities.forEach(function(preview) {
              try {
                state.viewer.entities.remove(preview);
              } catch (e) {}
            });
            state.previewEntities = [];
            state.pendingPositions = [];

            state.viewer.scene.requestRender();

            if (window.sendToReactNative) {
              window.sendToReactNative("models-cleared", { removedCount: entityIds.length });
            }

            console.log("[Model] All models cleared:", entityIds.length);
          } catch (e) {
            console.error("[Model] Clear error:", e);
          }
        }
  `;
}
