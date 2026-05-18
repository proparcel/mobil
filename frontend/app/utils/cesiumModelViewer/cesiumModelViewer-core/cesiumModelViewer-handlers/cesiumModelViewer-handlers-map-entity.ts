/**
 * Cesium Model Viewer - Map Click Handlers - Entity Selection
 * Entity seçim logic'i (shape selection, textbox selection)
 */

/**
 * Entity selection handler JavaScript kodunu oluştur
 * @returns Entity selection handler JavaScript string
 */
export function generateEntitySelectionHandler(): string {
  return `
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
                  const textTab = document.getElementById("tab-content-text");
                  const shapeTab = document.getElementById("tab-content-shape");
                  const textboxProps = document.getElementById("selected-textbox-properties");
                  const shapeProps = document.getElementById("selected-shape-properties");
                  const noTextbox = document.getElementById("no-textbox-selected");
                  
                  if (textTab) textTab.classList.remove("active");
                  if (shapeTab) shapeTab.classList.remove("active");
                  if (textboxProps) textboxProps.style.display = "none";
                  if (shapeProps) shapeProps.style.display = "none";
                  if (noTextbox) noTextbox.style.display = "block";
                  
                  document.querySelectorAll(".tab-btn").forEach(function(btn) {
                    btn.classList.remove("active");
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
                    const textTab = document.getElementById("tab-content-text");
                    const shapeTab = document.getElementById("tab-content-shape");
                    if (textTab) textTab.classList.remove("active");
                    if (shapeTab) shapeTab.classList.remove("active");
                    document.querySelectorAll(".tab-btn").forEach(function(btn) {
                      btn.classList.remove("active");
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
                    if (shape.type === "textbox") {
                      const textTabBtn = document.getElementById("tab-btn-text");
                      const textTab = document.getElementById("tab-content-text");
                      if (textTabBtn && textTab) {
                        document.querySelectorAll(".tab-btn").forEach(function(btn) {
                          btn.classList.remove("active");
                        });
                        document.querySelectorAll(".tab-content").forEach(function(content) {
                          content.classList.remove("active");
                        });
                        textTabBtn.classList.add("active");
                        textTab.classList.add("active");
                        
                        // Textbox özelliklerini göster
                        const textboxProps = document.getElementById("selected-textbox-properties");
                        const noTextbox = document.getElementById("no-textbox-selected");
                        const textboxContent = document.getElementById("textbox-properties-content");
                        
                        if (textboxProps && textboxContent && noTextbox) {
                          textboxProps.style.display = "block";
                          noTextbox.style.display = "none";
                          
                          // shape.text'i güvenli şekilde escape et (HTML attribute için)
                          const escapedText = (shape.text || "").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                          
                          textboxContent.innerHTML = 
                            "<div style=\"margin-bottom: 12px;\">" +
                            "<label style=\"display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;\">Metin:</label>" +
                            "<input type=\"text\" id=\"textbox-text-input\" class=\"shape-input\" value=\"" + 
                            escapedText + "\" style=\"width: 100%; padding: 8px 12px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 6px; color: white; font-size: 13px;\">" +
                            "</div>" +
                            "<div style=\"margin-bottom: 12px;\">" +
                            "<label style=\"display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;\">Arka Plan Rengi:</label>" +
                            "<input type=\"color\" id=\"textbox-fill-color\" value=\"" + (shape.fillColor || "#3b82f6") + "\" class=\"color-picker\">" +
                            "</div>" +
                            "<div style=\"margin-bottom: 12px;\">" +
                            "<label style=\"display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;\">Metin Rengi:</label>" +
                            "<input type=\"color\" id=\"textbox-text-color\" value=\"" + (shape.textColor || "#ffffff") + "\" class=\"color-picker\">" +
                            "</div>";
                          
                          // Event listeners
                          const textInput = document.getElementById("textbox-text-input");
                          const fillColorInput = document.getElementById("textbox-fill-color");
                          const textColorInput = document.getElementById("textbox-text-color");
                          
                          if (textInput) {
                            textInput.addEventListener("input", function() {
                              const entity = state.viewer.entities.getById(shape.entityIds[0]);
                              if (entity && entity.label) {
                                entity.label.text = this.value;
                                shape.text = this.value;
                                state.viewer.scene.requestRender();
                              }
                            });
                          }
                          
                          if (fillColorInput) {
                            fillColorInput.addEventListener("change", function() {
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
                            textColorInput.addEventListener("change", function() {
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
                          const deleteBtn = document.getElementById("delete-textbox-btn");
                          if (deleteBtn) {
                            deleteBtn.addEventListener("click", function() {
                              if (confirm("Bu metni silmek istediğinize emin misiniz?")) {
                                shape.entityIds.forEach(function(id) {
                                  try {
                                    state.viewer.entities.removeById(id);
                                  } catch (e) {
                                    console.warn("[Handlers] Error removing entity:", id, e);
                                  }
                                });
                                
                                window.cesiumFunctions.removeShape(shape.id);
                                
                                if (state.selectedShape === shape.id) {
                                  state.selectedShape = null;
                                  state.selectedShapeEntityIds = [];
                                  textboxProps.style.display = "none";
                                  if (noTextbox) noTextbox.style.display = "block";
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
                      const shapeTabBtn = document.getElementById("tab-btn-shape");
                      const shapeTab = document.getElementById("tab-content-shape");
                      if (shapeTabBtn && shapeTab) {
                        document.querySelectorAll(".tab-btn").forEach(function(btn) {
                          btn.classList.remove("active");
                        });
                        document.querySelectorAll(".tab-content").forEach(function(content) {
                          content.classList.remove("active");
                        });
                        shapeTabBtn.classList.add("active");
                        shapeTab.classList.add("active");
                        
                        // Shape özelliklerini göster
                        const shapeProps = document.getElementById("selected-shape-properties");
                        const shapeContent = document.getElementById("shape-properties-content");
                        
                        if (shapeProps && shapeContent) {
                          shapeProps.style.display = "block";
                          
                          shapeContent.innerHTML = 
                            "<div style=\"margin-bottom: 12px;\">" +
                            "<label style=\"display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;\">Şekil Tipi:</label>" +
                            "<div style=\"font-size: 14px; font-weight: 600; color: #1e293b;\">" + shape.type + "</div>" +
                            "</div>" +
                            "<div style=\"margin-bottom: 12px;\">" +
                            "<label style=\"display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;\">Kenar Rengi:</label>" +
                            "<input type=\"color\" id=\"shape-outline-color\" value=\"" + (shape.outlineColor || "#2563eb") + "\" class=\"color-picker\">" +
                            "</div>" +
                            (shape.fillColor ? "<div style=\"margin-bottom: 12px;\">" +
                            "<label style=\"display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;\">Dolgu Rengi:</label>" +
                            "<input type=\"color\" id=\"shape-fill-color\" value=\"" + shape.fillColor + "\" class=\"color-picker\">" +
                            "</div>" : "") +
                            "<div style=\"margin-bottom: 12px;\">" +
                            "<label style=\"display: block; font-size: 12px; color: #64748b; margin-bottom: 4px;\">Kenar Kalınlığı:</label>" +
                            "<input type=\"range\" id=\"shape-outline-width\" min=\"1\" max=\"10\" value=\"" + (shape.outlineWidth || 2) + "\" style=\"width: 100%;\">" +
                            "<div style=\"text-align: center; font-size: 12px; color: #64748b; margin-top: 4px;\">" + (shape.outlineWidth || 2) + "px</div>" +
                            "</div>" +
                            "<div class=\"form-actions\" style=\"margin-top: 16px;\">" +
                            "<button class=\"btn-clear\" id=\"delete-shape-btn\">🗑️ Şekli Sil</button>" +
                            "</div>";
                          
                          // Event listeners
                          const outlineColorInput = document.getElementById("shape-outline-color");
                          const fillColorInput = document.getElementById("shape-fill-color");
                          const outlineWidthInput = document.getElementById("shape-outline-width");
                          const deleteBtn = document.getElementById("delete-shape-btn");
                          
                          if (outlineColorInput) {
                            outlineColorInput.addEventListener("change", function() {
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
                            fillColorInput.addEventListener("change", function() {
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
                            outlineWidthInput.addEventListener("input", function() {
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
                              document.querySelector("#shape-outline-width").nextElementSibling.textContent = width + "px";
                              state.viewer.scene.requestRender();
                            });
                          }
                          
                          if (deleteBtn) {
                            deleteBtn.addEventListener("click", function() {
                              if (confirm("Bu şekli silmek istediğinize emin misiniz?")) {
                                shape.entityIds.forEach(function(id) {
                                  try {
                                    state.viewer.entities.removeById(id);
                                  } catch (e) {
                                    console.warn("[Handlers] Error removing entity:", id, e);
                                  }
                                });
                                
                                window.cesiumFunctions.removeShape(shape.id);
                                
                                if (state.selectedShape === shape.id) {
                                  state.selectedShape = null;
                                  state.selectedShapeEntityIds = [];
                                  shapeProps.style.display = "none";
                                }
                                
                                if (window.sendToReactNative) {
                                  window.sendToReactNative("shape-deleted", {
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
                    console.log("[Handlers] Shape selected, preparing to send message. Shape:", shape.id, shape.type);
                    if (window.sendToReactNative) {
                      console.log("[Handlers] sendToReactNative function exists");
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
                        
                        console.log("[Handlers] Sending shape-selected message:", messagePayload);
                        const result = window.sendToReactNative("shape-selected", messagePayload);
                        console.log("[Handlers] sendToReactNative result:", result);
                      } catch (e) {
                        console.error("[Handlers] Error sending shape-selected message:", e);
                        // Fallback: sadece temel bilgileri gönder
                        try {
                          window.sendToReactNative("shape-selected", {
                            shapeId: shape.id,
                            type: shape.type,
                            properties: {
                              id: shape.id,
                              type: shape.type
                            }
                          });
                        } catch (e2) {
                          console.error("[Handlers] Fallback send also failed:", e2);
                        }
                      }
                    } else {
                      console.warn("[Handlers] sendToReactNative function does not exist!");
                    }
                    
                    state.viewer.scene.requestRender();
                    return;
                  }
                }
              }
            }
`;
}
