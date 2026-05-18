/**
 * Cesium Model Viewer - Map Click Handlers - Drawing Modes
 * Drawing modes logic'i (model-placement, parcel-selection, measurement, shape drawing)
 */

/**
 * Drawing modes handler JavaScript kodunu oluştur
 * @returns Drawing modes handler JavaScript string
 */
export function generateDrawingModesHandler(): string {
  return `
            // Model placement
            if (state.drawingMode === "model-placement" && state.selectedModel) {
              const scaleSlider = document.getElementById("model-scale");
              const rotationSlider = document.getElementById("model-rotation");
              const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;
              const rotation = rotationSlider ? parseInt(rotationSlider.value) : 0;

              window.cesiumFunctions.addModelToMap(lon, lat, state.selectedType, state.selectedFile, scale, rotation).then(function(entityId) {
                if (entityId) {
                  state.drawingMode = null;
                  const addBtn = document.getElementById("add-model-btn");
                  if (addBtn) {
                    addBtn.textContent = "➕ Model Ekle";
                    addBtn.disabled = false;
                  }
                  viewer.canvas.style.cursor = "";
                }
              });
              return;
            }

            // Parcel selection
            if (state.drawingMode === "parcel-selection") {
              window.cesiumFunctions.handleParcelSelectionClick(lon, lat).then(function(result) {
                if (result) {
                  state.drawingMode = null;
                  const selectParcelBtn = document.getElementById("select-parcel-btn");
                  if (selectParcelBtn) {
                    selectParcelBtn.classList.remove("active");
                  }
                  viewer.canvas.style.cursor = "";
                }
              });
              return;
            }

            // Distance measurement
            if (state.drawingMode === "measure-distance") {
              window.cesiumFunctions.addDistanceMeasurementPoint({ lon: lon, lat: lat });
              return;
            }

            // Area measurement
            if (state.drawingMode === "measure-area") {
              window.cesiumFunctions.addAreaMeasurementPoint({ lon: lon, lat: lat });
              return;
            }

            // Shape drawing
            if (state.drawingMode && ["rectangle", "triangle", "circle", "ellipse", "polygon", "line", "arrow", "marker", "textbox"].includes(state.drawingMode)) {
              if (state.drawingMode === "rectangle") {
                if (!state.drawingStartPos) {
                  state.drawingStartPos = { lon: lon, lat: lat };
                } else {
                  drawRectangle(state.drawingStartPos, { lon: lon, lat: lat });
                  state.drawingMode = null;
                  state.drawingStartPos = null;
                  viewer.canvas.style.cursor = "";
                  document.querySelectorAll(".shape-btn").forEach(function(btn) {
                    btn.classList.remove("active");
                  });
                }
              } else if (state.drawingMode === "triangle") {
                if (!state.drawingPoints) {
                  state.drawingPoints = [];
                }
                state.drawingPoints.push({ lon: lon, lat: lat });
                if (state.drawingPoints.length === 3) {
                  drawTriangle(state.drawingPoints);
                  state.drawingMode = null;
                  state.drawingPoints = [];
                  viewer.canvas.style.cursor = "";
                  document.querySelectorAll(".shape-btn").forEach(function(btn) {
                    btn.classList.remove("active");
                  });
                }
              } else if (state.drawingMode === "circle") {
                if (!state.drawingStartPos) {
                  state.drawingStartPos = { lon: lon, lat: lat };
                } else {
                  drawCircle(state.drawingStartPos, { lon: lon, lat: lat });
                  state.drawingMode = null;
                  state.drawingStartPos = null;
                  viewer.canvas.style.cursor = "";
                  document.querySelectorAll(".shape-btn").forEach(function(btn) {
                    btn.classList.remove("active");
                  });
                }
              } else if (state.drawingMode === "ellipse") {
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
                  viewer.canvas.style.cursor = "";
                  document.querySelectorAll(".shape-btn").forEach(function(btn) {
                    btn.classList.remove("active");
                  });
                }
              } else if (state.drawingMode === "polygon") {
                if (!state.drawingPoints) {
                  state.drawingPoints = [];
                }
                state.drawingPoints.push({ lon: lon, lat: lat });
              } else if (state.drawingMode === "line") {
                if (!state.drawingPoints) {
                  state.drawingPoints = [];
                }
                state.drawingPoints.push({ lon: lon, lat: lat });
              } else if (state.drawingMode === "arrow") {
                if (!state.drawingStartPos) {
                  state.drawingStartPos = { lon: lon, lat: lat };
                } else {
                  drawArrow(state.drawingStartPos, { lon: lon, lat: lat });
                  state.drawingMode = null;
                  state.drawingStartPos = null;
                  viewer.canvas.style.cursor = "";
                  document.querySelectorAll(".shape-btn").forEach(function(btn) {
                    btn.classList.remove("active");
                  });
                }
              } else if (state.drawingMode === "marker") {
                drawMarker({ lon: lon, lat: lat });
                state.drawingMode = null;
                viewer.canvas.style.cursor = "";
                document.querySelectorAll(".shape-btn").forEach(function(btn) {
                  btn.classList.remove("active");
                });
              } else if (state.drawingMode === "textbox") {
                drawTextBox({ lon: lon, lat: lat });
                state.drawingMode = null;
                viewer.canvas.style.cursor = "";
                document.querySelectorAll(".shape-btn").forEach(function(btn) {
                  btn.classList.remove("active");
                });
              }
            }

          // Double-click to finish polygon/line
          handler.setInputAction(function(click) {
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return;

            if (state.drawingMode === "polygon" && state.drawingPoints && state.drawingPoints.length >= 3) {
              drawPolygon(state.drawingPoints);
              state.drawingMode = null;
              state.drawingPoints = [];
              viewer.canvas.style.cursor = "";
              document.querySelectorAll(".shape-btn").forEach(function(btn) {
                btn.classList.remove("active");
              });
            } else if (state.drawingMode === "line" && state.drawingPoints && state.drawingPoints.length >= 2) {
              drawLine(state.drawingPoints);
              state.drawingMode = null;
              state.drawingPoints = [];
              viewer.canvas.style.cursor = "";
              document.querySelectorAll(".shape-btn").forEach(function(btn) {
                btn.classList.remove("active");
              });
            }
          }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  `;
}
