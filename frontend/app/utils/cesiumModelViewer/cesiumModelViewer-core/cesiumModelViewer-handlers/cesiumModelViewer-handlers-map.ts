/**
 * Cesium Model Viewer - Map Click Handlers
 * Harita tıklama event handler'ları (inline JavaScript)
 * 
 * Bu modül harita üzerindeki tıklama, seçim, çizim modları ve long press handler'larını içerir.
 * Modüllere bölünmüş yapı - 200 satır limit kuralına uygun
 */

import { generateEntitySelectionHandler } from './cesiumModelViewer-handlers-map-entity';
import { generateMapClickHandlerCore } from './cesiumModelViewer-handlers-map-core';
import { generateDrawingModesHandler } from './cesiumModelViewer-handlers-map-drawing';
import { generateInteractionHandler } from './cesiumModelViewer-handlers-map-interaction';

/**
 * Map click handlers JavaScript kodunu oluştur
 */
export function generateMapClickHandlers(): string {
  const entitySelectionHandler = generateEntitySelectionHandler();
  const coreHandler = generateMapClickHandlerCore();
  const drawingModesHandler = generateDrawingModesHandler();
  const interactionHandler = generateInteractionHandler();

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/afa14471-3fdf-44e9-911d-0f8fda397631',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cesiumModelViewer-handlers-map.ts:17',message:'generateMapClickHandlers called',data:{entitySelectionLength:entitySelectionHandler.length,coreHandlerLength:coreHandler.length,drawingModesLength:drawingModesHandler.length,interactionLength:interactionHandler.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  return `
          // ============================================
          // MAP CLICK HANDLERS (Cesium ScreenSpaceEventHandler)
          // ============================================

          const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

          handler.setInputAction(function(click) {
            const state = window.cesiumFunctions.getCesiumState();
            if (!state || !state.viewer) return;

            ${entitySelectionHandler}

            ${coreHandler}

            ${drawingModesHandler}
          }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

          ${interactionHandler}
  `;
}
