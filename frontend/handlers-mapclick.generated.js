
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
                          
                          // shape.text'i güvenli şekilde escape et (HTML attribute için)
                          const escapedText = (shape.text || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                          
                          textboxContent.innerHTML = 
                            '<div style="margin-bottom: 12px;">' +
                            '<label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;">Metin:</label>' +
                            '<input type="text" id="textbox-text-input" class="shape-input" value="' + 
                            escapedText + '" style="width: 100%; padding: 8px 12px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 6px; color: white; font-size: 13px;">' +
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
                    // Sadece JSON-safe özellikleri gönder (circular reference'ları önlemek için)
                    console.log('[Handlers] Shape selected, preparing to send message. Shape:', shape.id, shape.type);
                    if (window.sendToReactNative) {
                      console.log('[Handlers] sendToReactNative function exists');
                      try {
                        const safeProperties = {
                          id: shape.id,
                          type: shape.type,
                          entityIds: shape.entityIds || [],
                          outlineColor: shape.outlineColor || null,
                          fillColor: shape.fillColor || null,
                          outlineWidth: shape.outlineWidth || null,
                          fillOpacity: shape.fillOpacity || null,
                          text: shape.text || null,
                          textColor: shape.textColor || null
                        };
                        
                        const messagePayload = {
                          shapeId: shape.id,
                          type: shape.type,
                          properties: safeProperties
                        };
                        
                        console.log('[Handlers] Sending shape-selected message:', messagePayload);
                        const result = window.sendToReactNative('shape-selected', messagePayload);
                        console.log('[Handlers] sendToReactNative result:', result);
                      } catch (e) {
                        console.error('[Handlers] Error sending shape-selected message:', e);
                        // Fallback: sadece temel bilgileri gönder
                        try {
                          window.sendToReactNative('shape-selected', {
                            shapeId: shape.id,
                            type: shape.type,
                            properties: {
                              id: shape.id,
                              type: shape.type
                            }
                          });
                        } catch (e2) {
                          console.error('[Handlers] Fallback send also failed:', e2);
                        }
                      }
                    } else {
                      console.warn('[Handlers] sendToReactNative function does not exist!');
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
