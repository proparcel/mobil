/**
 * Cesium Model Viewer - UI Event Handlers
 * UI event handler"ları (inline JavaScript)
 * 
 * Bu modül tüm UI element event handler"larını içerir.
 */

/**
 * UI event handlers JavaScript kodunu oluştur
 */
export function generateUIEventHandlers(): string {
  return `
          // ============================================
          // UI EVENT HANDLERS
          // ============================================

          // Close button
          const closeBtn = document.getElementById("close-btn");
          if (closeBtn) {
            closeBtn.addEventListener("click", function() {
              if (window.sendToReactNative) {
                window.sendToReactNative("close-requested", {});
              }
            });
          }

          // Model select dropdown
          const modelDropdown = document.getElementById("model-select-dropdown");
          if (modelDropdown) {
            modelDropdown.addEventListener("change", function(e) {
              const value = this.value;
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              if (value) {
                const parts = value.split(":");
                if (parts.length === 2) {
                  state.selectedModel = value;
                  state.selectedType = parts[0];
                  state.selectedFile = parts[1];

                  const addBtn = document.getElementById("add-model-btn");
                  if (addBtn) {
                    addBtn.disabled = false;
                  }

                  const scaleSlider = document.getElementById("model-scale");
                  const rotationSlider = document.getElementById("model-rotation");
                  if (scaleSlider) scaleSlider.disabled = false;
                  if (rotationSlider) rotationSlider.disabled = false;
                }
              } else {
                state.selectedModel = null;
                state.selectedType = null;
                state.selectedFile = null;

                const addBtn = document.getElementById("add-model-btn");
                if (addBtn) {
                  addBtn.disabled = true;
                }

                const scaleSlider = document.getElementById("model-scale");
                const rotationSlider = document.getElementById("model-rotation");
                if (scaleSlider) scaleSlider.disabled = true;
                if (rotationSlider) rotationSlider.disabled = true;
              }
            });
          }

          // Add model button
          const addModelBtn = document.getElementById("add-model-btn");
          if (addModelBtn) {
            addModelBtn.addEventListener("click", function() {
              const state = window.cesiumFunctions.getCesiumState();
              if (!state || !state.selectedModel) return;

              // Enable map click handler for model placement
              state.drawingMode = "model-placement";
              this.textContent = "Haritaya tıklayın...";
              this.disabled = true;
            });
          }

          // Clear models button
          const clearModelsBtn = document.getElementById("clear-models-btn");
          if (clearModelsBtn) {
            clearModelsBtn.addEventListener("click", function() {
              window.cesiumFunctions.clearModels();
            });
          }

          // Scale slider
          const scaleSlider = document.getElementById("model-scale");
          if (scaleSlider) {
            scaleSlider.addEventListener("input", function(e) {
              const value = parseFloat(this.value);
              const scaleValue = document.getElementById("scale-value");
              if (scaleValue) {
                scaleValue.textContent = Math.round(value * 500) + " m²";
              }
            });
          }

          // Rotation slider
          const rotationSlider = document.getElementById("model-rotation");
          if (rotationSlider) {
            rotationSlider.addEventListener("input", function(e) {
              const value = parseInt(this.value);
              const rotationValue = document.getElementById("rotation-value");
              if (rotationValue) {
                rotationValue.textContent = value + "°";
              }
            });
          }

          // Tab navigation
          document.querySelectorAll(".tab-btn").forEach(function(btn) {
            btn.addEventListener("click", function() {
              const targetTab = this.getAttribute("data-tab");
              document.querySelectorAll(".tab-btn").forEach(function(b) {
                b.classList.remove("active");
              });
              this.classList.add("active");

              document.querySelectorAll(".tab-content").forEach(function(content) {
                content.classList.remove("active");
              });
              const targetContent = document.getElementById("tab-content-" + targetTab);
              if (targetContent) {
                targetContent.classList.add("active");
              }
            });
          });

          // Parsel seçim butonu
          const selectParcelBtn = document.getElementById("select-parcel-btn");
          if (selectParcelBtn) {
            selectParcelBtn.addEventListener("click", function(e) {
              e.stopPropagation();
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              const isActive = state.drawingMode === "parcel-selection";

              if (isActive) {
                state.drawingMode = null;
                this.classList.remove("active");
                viewer.canvas.style.cursor = "";
              } else {
                state.drawingMode = "parcel-selection";
                this.classList.add("active");
                viewer.canvas.style.cursor = "crosshair";
                
                // Diğer butonları pasif yap
                document.querySelectorAll(".shape-btn").forEach(function(b) {
                  b.classList.remove("active");
                });
                const measurementMenuBtn = document.getElementById("measurement-menu-btn");
                if (measurementMenuBtn) measurementMenuBtn.classList.remove("active");
                const measureDistanceBtn = document.getElementById("measure-distance-btn");
                if (measureDistanceBtn) measureDistanceBtn.classList.remove("active");
                const measureAreaBtn = document.getElementById("measure-area-btn");
                if (measureAreaBtn) {
                  measureAreaBtn.classList.remove("active");
                  const finishBtn = document.getElementById("area-finish-btn");
                  if (finishBtn) finishBtn.style.display = "none";
                }
                
                // Ölçüm state"lerini temizle
                state.rulerPoints = [];
                state.areaPoints = [];
              }

              closeAllModals();
            });
          }

          // Ölçüm menü butonu - modal aç
          const measurementMenuBtn = document.getElementById("measurement-menu-btn");
          if (measurementMenuBtn) {
            measurementMenuBtn.addEventListener("click", function(e) {
              e.stopPropagation();
              openModal("measurement-modal");
            });
          }

          // Ölçüm modal kapat butonu
          const measurementModalClose = document.getElementById("measurement-modal-close");
          if (measurementModalClose) {
            measurementModalClose.addEventListener("click", function(e) {
              e.stopPropagation();
              closeAllModals();
            });
          }

          // Mesafe ölçüm butonu
          const measureDistanceBtn = document.getElementById("measure-distance-btn");
          if (measureDistanceBtn) {
            measureDistanceBtn.addEventListener("click", function(e) {
              e.stopPropagation();
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              const isActive = state.drawingMode === "measure-distance";
              const measurementMenuBtn = document.getElementById("measurement-menu-btn");
              const measureAreaBtn = document.getElementById("measure-area-btn");

              if (isActive) {
                // Pasif yap
                state.drawingMode = null;
                state.rulerPoints = [];
                this.classList.remove("active");
                viewer.canvas.style.cursor = "";
                if (measurementMenuBtn) measurementMenuBtn.classList.remove("active");
              } else {
                // Aktif yap
                state.drawingMode = "measure-distance";
                state.rulerPoints = [];
                if (measureAreaBtn) measureAreaBtn.classList.remove("active");
                this.classList.add("active");
                viewer.canvas.style.cursor = "crosshair";
                if (measurementMenuBtn) measurementMenuBtn.classList.add("active");
                
                // Diğer modları kapat
                const selectParcelBtn = document.getElementById("select-parcel-btn");
                if (selectParcelBtn) selectParcelBtn.classList.remove("active");
                document.querySelectorAll(".shape-btn").forEach(function(b) {
                  b.classList.remove("active");
                });
                state.drawingStartPos = null;
                state.drawingPoints = [];
                state.ellipseAxes = [];
              }

              closeAllModals();
            });
          }

          // Alan ölçüm butonu
          const measureAreaBtn = document.getElementById("measure-area-btn");
          if (measureAreaBtn) {
            measureAreaBtn.addEventListener("click", function(e) {
              e.stopPropagation();
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              const isActive = state.drawingMode === "measure-area";
              const measurementMenuBtn = document.getElementById("measurement-menu-btn");
              const measureDistanceBtn = document.getElementById("measure-distance-btn");
              const finishBtn = document.getElementById("area-finish-btn");

              if (isActive) {
                // Pasif yap
                state.drawingMode = null;
                state.areaPoints = [];
                this.classList.remove("active");
                viewer.canvas.style.cursor = "";
                if (finishBtn) finishBtn.style.display = "none";
                if (measurementMenuBtn) measurementMenuBtn.classList.remove("active");
              } else {
                // Aktif yap
                state.drawingMode = "measure-area";
                state.areaPoints = [];
                if (measureDistanceBtn) measureDistanceBtn.classList.remove("active");
                this.classList.add("active");
                viewer.canvas.style.cursor = "crosshair";
                if (measurementMenuBtn) measurementMenuBtn.classList.add("active");
                
                // Diğer modları kapat
                const selectParcelBtn = document.getElementById("select-parcel-btn");
                if (selectParcelBtn) selectParcelBtn.classList.remove("active");
                document.querySelectorAll(".shape-btn").forEach(function(b) {
                  b.classList.remove("active");
                });
                state.drawingStartPos = null;
                state.drawingPoints = [];
                state.ellipseAxes = [];
              }

              closeAllModals();
            });
          }

          const clearMeasurementsBtn = document.getElementById("clear-measurements-btn");
          if (clearMeasurementsBtn) {
            clearMeasurementsBtn.addEventListener("click", function(e) {
              e.stopPropagation();
              window.cesiumFunctions.clearAllMeasurements();
              closeAllModals();
            });
          }

          // Area finish button
          const areaFinishBtn = document.getElementById("area-finish-btn");
          if (areaFinishBtn) {
            areaFinishBtn.addEventListener("click", function() {
              window.cesiumFunctions.finishAreaMeasurement();
            });
          }

          // Şekil menü butonu - modal aç
          const shapeMenuBtn = document.getElementById("shape-menu-btn");
          if (shapeMenuBtn) {
            shapeMenuBtn.addEventListener("click", function(e) {
              e.stopPropagation();
              openModal("shape-modal");
            });
          }

          // Şekil modal kapat butonu
          const shapeModalClose = document.getElementById("shape-modal-close");
          if (shapeModalClose) {
            shapeModalClose.addEventListener("click", function(e) {
              e.stopPropagation();
              closeAllModals();
            });
          }

          // Şekil butonları
          document.querySelectorAll(".shape-btn").forEach(function(btn) {
            btn.addEventListener("click", function(e) {
              e.stopPropagation();
              const state = window.cesiumFunctions.getCesiumState();
              if (!state) return;

              const shapeType = this.getAttribute("data-shape");
              state.drawingMode = shapeType;
              state.drawingStartPos = null;
              state.drawingPoints = [];
              state.ellipseAxes = [];

              document.querySelectorAll(".shape-btn").forEach(function(b) {
                b.classList.remove("active");
              });
              this.classList.add("active");
              
              // Diğer modları kapat
              const selectParcelBtn = document.getElementById("select-parcel-btn");
              if (selectParcelBtn) selectParcelBtn.classList.remove("active");
              
              const measurementMenuBtn = document.getElementById("measurement-menu-btn");
              if (measurementMenuBtn) measurementMenuBtn.classList.remove("active");
              const measureDistanceBtn = document.getElementById("measure-distance-btn");
              if (measureDistanceBtn) measureDistanceBtn.classList.remove("active");
              const measureAreaBtn = document.getElementById("measure-area-btn");
              if (measureAreaBtn) {
                measureAreaBtn.classList.remove("active");
                const finishBtn = document.getElementById("area-finish-btn");
                if (finishBtn) finishBtn.style.display = "none";
              }
              
              // Ölçüm state"lerini temizle
              state.rulerPoints = [];
              state.areaPoints = [];

              viewer.canvas.style.cursor = "crosshair";
              closeAllModals();
            });
          });
  `;
}
