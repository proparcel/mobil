/**
 * Cesium Model Viewer - Initialization Script
 * Cesium initialization ve modül fonksiyonları
 *
 * Bu dosya bölünen modülleri birleştirerek final JavaScript string'ini oluşturur.
 */

import type { CesiumModelViewerOptions } from '../cesiumModelViewer-types';
import { generateBridgeSetupScript } from './cesiumModelViewer-init/cesiumModelViewer-init-bridge';
import { generateStateInitializationScript } from './cesiumModelViewer-init/cesiumModelViewer-init-state';
import { generateUtilityFunctionsScript } from './cesiumModelViewer-init/cesiumModelViewer-init-utils';
import { generateModelManagementScript } from './cesiumModelViewer-init/cesiumModelViewer-init-model';
import { generateMeasurementFunctionsScript } from './cesiumModelViewer-init/cesiumModelViewer-init-measurement';
import { generateParcelSelectionScript } from './cesiumModelViewer-init/cesiumModelViewer-init-parcel';
import { generateViewerInitScript } from './cesiumModelViewer-init/cesiumModelViewer-init-viewer';
import { generateSetupScript } from './cesiumModelViewer-init/cesiumModelViewer-init-setup';
import { validateJS } from '../../jsParseValidator';

/**
 * Cesium initialization ve modül fonksiyonlarını içeren JavaScript string'i oluştur
 */
export function generateInitScript(options: CesiumModelViewerOptions): string {
  const {
    backendUrl,
    cesiumIonToken = '',
    mapboxAccessToken = '',
    initialCenter = [35.0, 39.0],
    initialZoom = 15,
  } = options;

  const CESIUM_VERSION = '1.110';
  const cameraHeight = 40075016.686 * Math.cos(initialCenter[1] * Math.PI / 180) / Math.pow(2, initialZoom + 1);
  // Ensure cameraHeight is a valid number (not Infinity or NaN) and format safely
  const safeCameraHeight = isFinite(cameraHeight) && !isNaN(cameraHeight) ? cameraHeight : 1000;
  // Format as string to avoid scientific notation in template literal - use toFixed to prevent scientific notation
  const safeCameraHeightStr = safeCameraHeight.toFixed(2);
  
  // Ensure initialCenter values are valid numbers and format them safely
  const safeInitialLon = typeof initialCenter[0] === 'number' && isFinite(initialCenter[0]) ? Number(initialCenter[0]) : 35.0;
  const safeInitialLat = typeof initialCenter[1] === 'number' && isFinite(initialCenter[1]) ? Number(initialCenter[1]) : 39.0;
  // Format as strings to ensure proper JavaScript number format - use toFixed to prevent scientific notation
  const safeInitialLonStr = safeInitialLon.toFixed(10);
  const safeInitialLatStr = safeInitialLat.toFixed(10);
  
  // Escape string values to prevent syntax errors in generated JavaScript
  const escapedCesiumIonToken = JSON.stringify(String(cesiumIonToken || ''));
  const escapedMapboxAccessToken = JSON.stringify(String(mapboxAccessToken || ''));
  const escapedBackendUrl = JSON.stringify(String(backendUrl || ''));

  // Bölünen modüllerden script'leri al
  const bridgeScript = generateBridgeSetupScript(escapedCesiumIonToken, escapedMapboxAccessToken, escapedBackendUrl);
  const stateScript = generateStateInitializationScript();
  const utilsScript = generateUtilityFunctionsScript();
  const modelScript = generateModelManagementScript();
  const measurementScript = generateMeasurementFunctionsScript();
  const parcelScript = generateParcelSelectionScript();
  const setupScript = generateSetupScript();
  const viewerInitScript = generateViewerInitScript({
    safeInitialLonStr,
    safeInitialLatStr,
    safeCameraHeightStr,
    setupScript
  });

  // Her bir modülü validate et
  validateJS('Init-Bridge', bridgeScript);
  validateJS('Init-State', stateScript);
  validateJS('Init-Utils', utilsScript);
  validateJS('Init-Model', modelScript);
  validateJS('Init-Measurement', measurementScript);
  validateJS('Init-Parcel', parcelScript);
  validateJS('Init-Viewer', viewerInitScript);
  validateJS('Init-Setup', setupScript);

  // Birleşik script'i oluştur
  const combinedScript = `
    <script>
      (function() {
        ${bridgeScript}

        ${stateScript}

        ${utilsScript}

        ${modelScript}

        ${measurementScript}

        ${parcelScript}

        ${viewerInitScript}

        })();
    </script>
  `;

  // Script tag'lerini kaldırarak sadece JavaScript kodunu validate et
  const jsCode = combinedScript
    .replace(/<script>/g, '')
    .replace(/<\/script>/g, '')
    .trim();

  // Birleşik script'i validate et
  validateJS('Init-Combined', jsCode);

  return combinedScript;
}
