/**
 * Cesium Model Viewer - Core HTML Generator
 * Ana HTML generator fonksiyonu
 *
 * Tüm modülleri birleştirerek final HTML string'ini oluşturur.
 * threeJsModelViewer yapısından esinlenilmiştir.
 */

import type { CesiumModelViewerOptions } from '../cesiumModelViewer-types';
import { generateHTMLStructure, generateCSSStyles } from './cesiumModelViewer-html';
import { generateInitScript } from './cesiumModelViewer-init';
import { generateEventHandlersScript } from './cesiumModelViewer-handlers/cesiumModelViewer-handlers';
import { validateJS, escapeScriptTag } from '../../jsParseValidator';

/**
 * Cesium Model Viewer HTML string'ini oluştur
 * 
 * @param options - Cesium Model Viewer seçenekleri
 * @returns HTML string (WebView için)
 */
export function generateCesiumModelViewerHTML(options: CesiumModelViewerOptions): string {
  const {
    backendUrl,
    cesiumIonToken = '',
    mapboxAccessToken = '',
    initialCenter = [35.0, 39.0],
    initialZoom = 15,
  } = options;

  const CESIUM_VERSION = '1.110';

  // HTML yapısı
  const htmlStructure = generateHTMLStructure();

  // CSS stilleri
  const cssStyles = generateCSSStyles();

  // Init script (Cesium initialization + modül fonksiyonları)
  const initScript = generateInitScript({
    backendUrl,
    cesiumIonToken,
    mapboxAccessToken,
    initialCenter,
    initialZoom,
  });

  // Event handlers script
  const handlersScript = generateEventHandlersScript();

  // JavaScript script'lerini validate et (script tag'lerini kaldırarak)
  const initScriptJS = initScript.replace(/<script>/g, '').replace(/<\/script>/g, '').trim();
  const handlersScriptJS = handlersScript.replace(/<script>/g, '').replace(/<\/script>/g, '').trim();

  // DEV'de parse validation (PROD'da atlanır)
  validateJS('InitScript', initScriptJS, { skipInProduction: true });
  validateJS('HandlersScript', handlersScriptJS, { skipInProduction: true });

  // Script tag'lerini escape et (HTML içinde güvenli kullanım için)
  const safeInitScript = escapeScriptTag(initScript);
  const safeHandlersScript = escapeScriptTag(handlersScript);

  // Satır numaralarını takip et (debug için)
  let currentLine = 1;
  const lineCounts = {
    doctype: 1,
    htmlStart: 1,
    headStart: 1,
    meta: 3,
    title: 1,
    cesiumCss: 1,
    cssStyles: cssStyles.split('\n').length,
    headEnd: 1,
    bodyStart: 1,
    htmlStructure: htmlStructure.split('\n').length,
    cesiumScript: 1,
    initScript: initScript.split('\n').length,
    handlersScript: handlersScript.split('\n').length,
    bodyEnd: 1,
    htmlEnd: 1
  };

  // Her bölümün başlangıç satırını hesapla
  const sectionStarts = {
    doctype: 1,
    htmlTag: 2,
    headTag: 3,
    metaTags: 4,
    title: 7,
    cesiumCssLink: 9,
    cssStyles: 11,
    headEnd: 11 + lineCounts.cssStyles,
    bodyTag: 12 + lineCounts.cssStyles,
    htmlStructure: 13 + lineCounts.cssStyles,
    cesiumScriptTag: 13 + lineCounts.cssStyles + lineCounts.htmlStructure + 1,
    initScript: 15 + lineCounts.cssStyles + lineCounts.htmlStructure,
    handlersScript: 15 + lineCounts.cssStyles + lineCounts.htmlStructure + lineCounts.initScript,
    bodyEnd: 15 + lineCounts.cssStyles + lineCounts.htmlStructure + lineCounts.initScript + lineCounts.handlersScript,
    htmlEnd: 16 + lineCounts.cssStyles + lineCounts.htmlStructure + lineCounts.initScript + lineCounts.handlersScript
  };

  // Debug: Bölüm bilgilerini logla
  if (__DEV__) {
    console.log('[CesiumModelViewer] 📊 HTML Bölüm Satır Numaraları:');
    console.log('[CesiumModelViewer]   DOCTYPE:', sectionStarts.doctype);
    console.log('[CesiumModelViewer]   HTML tag:', sectionStarts.htmlTag);
    console.log('[CesiumModelViewer]   HEAD tag:', sectionStarts.headTag);
    console.log('[CesiumModelViewer]   CSS Styles:', sectionStarts.cssStyles, `(${lineCounts.cssStyles} satır)`);
    console.log('[CesiumModelViewer]   HTML Structure:', sectionStarts.htmlStructure, `(${lineCounts.htmlStructure} satır)`);
    console.log('[CesiumModelViewer]   Cesium Script tag:', sectionStarts.cesiumScriptTag);
    console.log('[CesiumModelViewer]   Init Script:', sectionStarts.initScript, `(${lineCounts.initScript} satır)`);
    console.log('[CesiumModelViewer]   Handlers Script:', sectionStarts.handlersScript, `(${lineCounts.handlersScript} satır)`);
  }

  // Final HTML string
  return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>3D Model Viewer - Cesium</title>
    
    <!-- Cesium CSS -->
    <link href="https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
    
    ${cssStyles}
</head>
<body>
    ${htmlStructure}

    <!-- Cesium JavaScript -->
    <script src="https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Cesium.js"></script>
    
    ${safeInitScript}
    
    ${safeHandlersScript}
</body>
</html>`;
}
