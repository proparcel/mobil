/**
 * Cesium HTML Generator
 * Ana projedeki Cesium kodunu WebView için HTML olarak paketler
 */

import { generateInitCesiumScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-init/cesiumHtmlGenerator-init-core";
import { generateBridgeSetupScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-init/cesiumHtmlGenerator-init-bridge";
import { generateConfigScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-init/cesiumHtmlGenerator-init-config";
import { generateHtmlStructure } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-html-structure";
import { generateCssStyles } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-css-styles";
import { generateScriptLoaderScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-script-loader";
import { generateWaitForCesiumScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-wait-for-cesium";
import { generateModelHandlersScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-handlers/cesiumHtmlGenerator-handlers-models";
import { generateUIHandlersScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-handlers/cesiumHtmlGenerator-handlers-ui";
import { generateTerrainHtmlStructure } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-terrain-html";
import { generateTerrainCssStyles } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-terrain-css";
import { generateTerrainErrorHandlerScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-terrain-error-handler";
import { generateTerrainScriptLoaderScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-terrain-script-loader";
import { generateImageryProviderCode } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-terrain-providers";
import { generateTerrainInitScript } from "./cesiumHtmlGenerator/cesiumHtmlGenerator-terrain-init";

interface CesiumHtmlOptions {
  backendUrl: string;
  googleMapsApiKey?: string;
  cesiumIonToken?: string;
  mapboxAccessToken?: string;
  initialCenter?: [number, number]; // [lon, lat]
  initialZoom?: number;
}

/**
 * Cesium viewer için standalone HTML oluştur
 */
export function generateCesiumHTML(options: CesiumHtmlOptions): string {
  const {
    backendUrl,
    googleMapsApiKey = "",
    cesiumIonToken = "",
    mapboxAccessToken = "",
    initialCenter = [35.0, 39.0], // Türkiye default
    initialZoom = 15
  } = options;

  // Cesium version - Daha yeni versiyon deneyelim
  const CESIUM_VERSION = "1.110";
  // Alternatif CDN"ler
  const CESIUM_BASE_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;
  // Fallback: unpkg CDN
  const CESIUM_BASE_URL_FALLBACK = `https://unpkg.com/cesium@${CESIUM_VERSION}/Build/Cesium`;

  // Font Awesome CDN (icon"lar için)
  const FONT_AWESOME_CDN = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";

  // Initial camera height calculation
  const cameraHeight = 40075016.686 * Math.cos(initialCenter[1] * Math.PI / 180) / Math.pow(2, initialZoom + 1);

  // Modülleri oluştur
  const htmlStructure = generateHtmlStructure({
    cesiumBaseUrl: CESIUM_BASE_URL,
    fontAwesomeCdn: FONT_AWESOME_CDN
  });
  
  const cssStyles = generateCssStyles();
  const scriptLoaderScript = generateScriptLoaderScript({
    cesiumBaseUrl: CESIUM_BASE_URL,
    cesiumBaseUrlFallback: CESIUM_BASE_URL_FALLBACK
  });
  const waitForCesiumScript = generateWaitForCesiumScript({
    cesiumBaseUrl: CESIUM_BASE_URL
  });
  const modelHandlersScript = generateModelHandlersScript();
  const uiHandlersScript = generateUIHandlersScript();

  return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Cesium 3D Model Viewer</title>
    
    <!-- Cesium CSS -->
    <link href="${CESIUM_BASE_URL}/Widgets/widgets.css" rel="stylesheet">
    
    <!-- Font Awesome (icons için) -->
    <link href="${FONT_AWESOME_CDN}" rel="stylesheet">
    
    <style>
${cssStyles}
    </style>
</head>
<body>
${htmlStructure}

    <!-- Cesium JS - Fallback ile -->
    <script>
${scriptLoaderScript}
    </script>
    
    <script>
        ${generateBridgeSetupScript()}
        
        ${waitForCesiumScript}
        
        ${generateConfigScript({
          cesiumIonToken,
          googleMapsApiKey,
          mapboxAccessToken,
          backendUrl
        })}
        
        ${generateInitCesiumScript({ initialCenter, cameraHeight })}
        
        ${modelHandlersScript}
        
        ${uiHandlersScript}
        
        // Cesium yüklendikten sonra başlat
        waitForCesium(function() {
            try {
                // CDN kökünü net ver (Worker"lar için kritik)
                const base = window.CESIUM_BASE_URL || "${CESIUM_BASE_URL}/";
                if (typeof Cesium !== "undefined" && Cesium.buildModuleUrl && Cesium.buildModuleUrl.setBaseUrl) {
                    Cesium.buildModuleUrl.setBaseUrl(base);
                    console.log("[Cesium] buildModuleUrl base set:", base);
                } else {
                    console.warn("[Cesium] buildModuleUrl.setBaseUrl not available");
                }
            } catch(e) {
                console.error("[Cesium] buildModuleUrl base set failed:", e);
            }
            
            // Cesium"u başlat
            initCesium();
            
            // Tab navigation"ı kur
            setTimeout(setupTabNavigation, 100);
        });
    </script>
</body>
</html>`;
}

/**
 * Terrain Test için Cesium HTML Generator
 * Farklı imagery provider type"ları ile test yapmak için
 */
interface TerrainTestHtmlOptions {
  backendUrl: string;
  googleMapsApiKey?: string;
  mapboxAccessToken?: string;
  imageryProviderType: "google-direct" | "google-proxy" | "cesium-ion" | "mapbox" | "osm" | "google-3d";
  initialCenter?: [number, number]; // [lon, lat]
  initialZoom?: number;
}

export function generateCesiumHTMLForTerrainTest(options: TerrainTestHtmlOptions): string {
  const {
    backendUrl,
    googleMapsApiKey = "",
    mapboxAccessToken = "",
    imageryProviderType,
    initialCenter = [35.0, 39.0],
    initialZoom = 15
  } = options;

  const CESIUM_VERSION = "1.110";
  const CESIUM_BASE_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;
  const cameraHeight = 40075016.686 * Math.cos(initialCenter[1] * Math.PI / 180) / Math.pow(2, initialZoom + 1);

  // Modülleri oluştur
  const terrainHtmlStructure = generateTerrainHtmlStructure();
  const terrainCssStyles = generateTerrainCssStyles();
  const terrainErrorHandlerScript = generateTerrainErrorHandlerScript();
  const terrainScriptLoaderScript = generateTerrainScriptLoaderScript({
    cesiumBaseUrl: CESIUM_BASE_URL,
    cesiumVersion: CESIUM_VERSION
  });
  const providerCode = generateImageryProviderCode(imageryProviderType);
  const google3dCode = imageryProviderType === "google-3d" ? `
                // Google 3D Tiles için özel işlem (after provider is set)
                if (window.GOOGLE_MAPS_API_KEY && typeof Cesium.createGooglePhotorealistic3DTileset === "function") {
                    Cesium.createGooglePhotorealistic3DTileset({
                        key: window.GOOGLE_MAPS_API_KEY
                    }).then(function(tileset) {
                        viewer.scene.primitives.add(tileset);
                        logToReactNative("log", "[Cesium-TerrainTest] ✅ Google 3D Tiles added");
                    }).catch(function(e) {
                        logToReactNative("error", "[Cesium-TerrainTest] ❌ Google 3D Tiles failed:", e);
                    });
                }
                ` : "";
  
  const terrainInitScript = generateTerrainInitScript({
    imageryProviderType,
    initialCenter,
    cameraHeight,
    cesiumBaseUrl: CESIUM_BASE_URL,
    providerCode,
    google3dCode
  });

  return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Terrain Test - ${imageryProviderType}</title>
    <link href="${CESIUM_BASE_URL}/Widgets/widgets.css" rel="stylesheet">
    <style>
${terrainCssStyles}
    </style>
</head>
<body>
${terrainHtmlStructure}
    
    <script>
        ${terrainErrorHandlerScript}
        
        // Configuration
        window.BACKEND_URL = ${JSON.stringify(backendUrl)};
        ${googleMapsApiKey ? `window.GOOGLE_MAPS_API_KEY = ${JSON.stringify(googleMapsApiKey)};` : ""}
        ${mapboxAccessToken ? `window.MAPBOX_ACCESS_TOKEN = ${JSON.stringify(mapboxAccessToken)};` : ""}
        
        ${terrainScriptLoaderScript}
        
        ${terrainInitScript}
    </script>
</body>
</html>`;
}
