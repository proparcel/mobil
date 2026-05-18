/**
 * Three.js Model Viewer HTML Generator
 * Cesium yerine Three.js kullanarak 3D model ekleme sistemi
 * Mapbox haritası ile koordinat senkronizasyonu
 */

export interface ThreeJsModelViewerOptions {
  backendUrl: string;
  googleMapsApiKey?: string;
  mapboxAccessToken?: string;
  initialCenter?: [number, number]; // [lon, lat]
  initialZoom?: number;
}

export function generateThreeJsModelViewerHTML(options: ThreeJsModelViewerOptions): string {
  const {
    backendUrl,
    googleMapsApiKey = '',
    mapboxAccessToken = '',
    initialCenter = [35.0, 39.0],
    initialZoom = 15
  } = options;

  const THREE_VERSION = '0.161.0';
  const MAPBOX_VERSION = '3.0.1';
  const STATIC_URL = `${backendUrl}/static`;
  // Ana projeden alındı: myapp/static/js/initialization/mapbox_gl_init.js
  const MAPBOX_TOKEN = mapboxAccessToken || "";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>3D Model Viewer</title>
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        html, body {
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        
        body {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
        }
        
        .model-viewer-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #0f172a;
        }
        
        .viewer-header {
            background: #1e293b;
            padding: 12px 16px;
            border-bottom: 1px solid #3b82f6;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
        }
        
        .viewer-title {
            color: #fff;
            font-size: 16px;
            font-weight: 700;
        }
        
        .close-btn {
            background: rgba(59, 130, 246, 0.2);
            border: 1px solid #3b82f6;
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .viewer-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
        }
        
        /* Mobile: Alt alta */
        @media (max-width: 768px) {
            .viewer-body {
                flex-direction: column;
            }
            
            .map-container {
                flex: 0.6;
                min-height: 50vh;
            }
            
            .controls-panel {
                flex: 0.4;
                max-height: 40vh;
                overflow-y: auto;
            }
        }
        
        /* Desktop: Yan yana */
        @media (min-width: 769px) {
            .viewer-body {
                flex-direction: row;
            }
            
            .map-container {
                flex: 0.7;
            }
            
            .controls-panel {
                flex: 0.3;
                border-left: 1px solid #3b82f6;
            }
        }
        
        .map-container {
            position: relative;
            background: #020617;
            overflow: hidden;
            flex: 1;
        }
        
        #mapbox-map {
            width: 100% !important;
            height: 100% !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
        }
        
        /* Three.js canvas artık gereksiz - Mapbox custom layer kullanıyoruz */
        .threejs-overlay {
            display: none;
        }
        
        .controls-panel {
            background: #f8fafc;
            overflow-y: auto;
            padding: 16px;
        }
        
        .tab-navigation {
            display: flex;
            border-bottom: 1px solid #e2e8f0;
            background: #ffffff;
            overflow-x: auto;
            margin: -16px -16px 16px -16px;
            padding: 0 16px;
        }
        
        .tab-btn {
            flex: 1;
            padding: 12px 8px;
            border: none;
            background: transparent;
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
            white-space: nowrap;
            min-width: 60px;
        }
        
        .tab-btn.active {
            color: #3b82f6;
            border-bottom-color: #3b82f6;
            background: #f8fafc;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .form-section {
            margin-bottom: 16px;
        }
        
        .model-select-dropdown {
            width: 100%;
            padding: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 14px;
            background: white;
        }
        
        .control-group {
            margin-bottom: 12px;
        }
        
        .control-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }
        
        .control-label {
            font-size: 12px;
            color: #64748b;
        }
        
        .control-value {
            font-size: 12px;
            color: #1e293b;
            font-weight: 600;
        }
        
        input[type="range"] {
            width: 100%;
        }
        
        .form-actions {
            display: flex;
            gap: 8px;
            margin-top: 16px;
        }
        
        .btn-add, .btn-clear {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        }
        
        .btn-add {
            background: #3b82f6;
            color: white;
        }
        
        .btn-add:disabled {
            background: #cbd5e1;
            cursor: not-allowed;
        }
        
        .btn-clear {
            background: #ef4444;
            color: white;
        }
        
        .map-controls {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 1000;
        }
        
        .map-controls-left {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .main-tool-btn {
            min-width: 100px;
        }
        
        .map-controls-right {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 2000;
        }
        
        .submenu-container {
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 8px;
            padding: 0;
            min-width: 180px;
            max-width: 250px;
            max-height: calc(100vh - 150px);
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            display: flex;
            flex-direction: column;
        }
        
        .submenu-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(59, 130, 246, 0.3);
            background: rgba(30, 41, 59, 0.8);
        }
        
        .submenu-title {
            color: #fff;
            font-size: 14px;
            font-weight: 700;
        }
        
        .submenu-close {
            background: transparent;
            border: none;
            color: #94a3b8;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
        }
        
        .submenu-close:hover {
            background: rgba(59, 130, 246, 0.2);
            color: #fff;
        }
        
        .submenu-content {
            padding: 12px;
            padding-bottom: 80px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-height: calc(100vh - 200px);
        }
        
        .submenu-content::-webkit-scrollbar {
            width: 6px;
        }
        
        .submenu-content::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.5);
            border-radius: 3px;
        }
        
        .submenu-content::-webkit-scrollbar-thumb {
            background: rgba(59, 130, 246, 0.6);
            border-radius: 3px;
        }
        
        .submenu-content::-webkit-scrollbar-thumb:hover {
            background: rgba(59, 130, 246, 0.8);
        }
        
        .submenu-content .control-btn {
            width: 100%;
            margin: 0;
            min-width: auto;
            padding: 10px 12px;
            font-size: 13px;
        }
        
        .submenu-content .shape-toolbar {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        
        .shape-editing-panel,
        .textbox-editing-panel {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .compact-form-row {
            display: flex;
            gap: 12px;
        }
        
        .compact-form-row .form-group {
            flex: 1;
        }
        
        .color-label {
            font-size: 12px;
            color: #94a3b8;
            margin-bottom: 4px;
            display: block;
        }
        
        .color-picker-group {
            display: flex;
            gap: 6px;
            align-items: center;
        }
        
        .color-picker {
            width: 40px;
            height: 32px;
            border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 4px;
            cursor: pointer;
        }
        
        .color-hex-input {
            flex: 1;
            padding: 6px 8px;
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 4px;
            color: white;
            font-size: 12px;
            font-family: monospace;
        }
        
        .shape-input {
            width: 100%;
            padding: 8px 12px;
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 6px;
            color: white;
            font-size: 13px;
        }
        
        .shape-input:focus {
            outline: none;
            border-color: #3b82f6;
        }
        
        .control-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }
        
        .control-label {
            font-size: 12px;
            color: #94a3b8;
        }
        
        .control-value {
            font-size: 12px;
            color: #3b82f6;
            font-weight: 600;
        }
        
        .checkbox-label {
            font-size: 13px;
            color: white;
            user-select: none;
        }
        
        .shape-management-buttons {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        
        .shape-management-buttons .control-btn {
            flex: 1;
            min-width: auto;
        }
        
        .area-finish-button {
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(59, 130, 246, 0.95);
            border: 2px solid #3b82f6;
            color: white;
            padding: 14px 28px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            z-index: 3000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            transition: all 0.2s ease;
        }
        
        .area-finish-button:hover {
            background: rgba(59, 130, 246, 1);
            transform: translateX(-50%) scale(1.05);
        }
        
        .control-btn {
            background: rgba(15, 23, 42, 0.9) !important;
            border: 1px solid rgba(59, 130, 246, 0.5) !important;
            color: white !important;
            padding: 10px 14px !important;
            border-radius: 8px !important;
            cursor: pointer !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            min-width: 100px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
            transition: all 0.2s ease !important;
        }
        
        .control-btn.active,
        .main-tool-btn.active,
        .control-btn.main-tool-btn.active {
            background: rgba(59, 130, 246, 1) !important;
            border: 2px solid #3b82f6 !important;
            box-shadow: 0 0 12px rgba(59, 130, 246, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4) !important;
            transform: scale(1.02);
            transition: all 0.2s ease;
        }
        
        .shape-toolbar-separator {
            height: 1px;
            background: rgba(59, 130, 246, 0.3);
            margin: 8px 0;
        }
        
        .shape-toolbar {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .textbox-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        
        .textbox-modal-content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            max-width: 90%;
        }
        
        .textbox-modal-content input {
            width: 100%;
            padding: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 14px;
            margin-bottom: 12px;
        }
        
        .textbox-modal-buttons {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        
        .textbox-modal-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        }
        
        .textbox-modal-btn-primary {
            background: #3b82f6;
            color: white;
        }
        
        .textbox-modal-btn-secondary {
            background: #e2e8f0;
            color: #475569;
        }
        
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            color: white;
            z-index: 2000;
        }
        
        .loading-overlay.hidden {
            display: none;
        }
        
        .debug-info {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            font-size: 10px;
            z-index: 10001;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.3);
            font-family: monospace;
        }
        
        .shape-list {
            max-height: 300px;
            overflow-y: auto;
            margin-bottom: 16px;
        }
        
        .shape-list-item {
            padding: 10px;
            margin-bottom: 8px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .shape-list-item:hover {
            background: #f8fafc;
            border-color: #3b82f6;
        }
        
        .shape-list-item.selected {
            background: #eff6ff;
            border-color: #3b82f6;
            border-width: 2px;
        }
        
        .shape-list-item-name {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 4px;
        }
        
        .shape-list-item-type {
            font-size: 11px;
            color: #64748b;
        }
        
        .movement-controls {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            gap: 4px;
            max-width: 150px;
            margin: 16px auto;
        }
        
        .movement-btn {
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(59, 130, 246, 0.5);
            color: white;
            padding: 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            min-height: 40px;
        }
        
        .movement-btn:active {
            background: rgba(59, 130, 246, 0.8);
            transform: scale(0.95);
        }
        
        .movement-btn.up {
            grid-column: 2;
            grid-row: 1;
        }
        
        .movement-btn.down {
            grid-column: 2;
            grid-row: 3;
        }
        
        .movement-btn.left {
            grid-column: 1;
            grid-row: 2;
        }
        
        .movement-btn.right {
            grid-column: 3;
            grid-row: 2;
        }
        
        .movement-controls-label {
            text-align: center;
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="model-viewer-container">
        <div class="viewer-header">
            <div class="viewer-title">3D Model Ekleme</div>
            <button class="close-btn" id="close-btn">Kapat</button>
        </div>
        
        <div class="viewer-body">
            <!-- Mapbox Container -->
            <div class="map-container">
                <div id="mapbox-map"></div>
                <div class="map-controls">
                    <div class="map-controls-left">
                        <button id="select-parcel-btn" class="control-btn main-tool-btn" title="Haritadan Parsel Seç">
                            📍 Parsel
                        </button>
                        <button id="measurement-menu-btn" class="control-btn main-tool-btn" title="Ölçüm Araçları">
                            📏 Ölçüm
                        </button>
                        <button id="shape-menu-btn" class="control-btn main-tool-btn" title="Şekil Çizim Araçları">
                            🔷 Şekil
                        </button>
                    </div>
                </div>
                
                <div class="map-controls-right" id="map-controls-right" style="display: none;">
                    <div class="submenu-container">
                        <div class="submenu-header">
                            <span class="submenu-title" id="submenu-title">Menü</span>
                            <button class="submenu-close" id="submenu-close">✕</button>
                        </div>
                        <div class="submenu-content" id="submenu-content">
                            <!-- İçerik dinamik olarak doldurulacak -->
                        </div>
                    </div>
                </div>
                
                <!-- Alan ölçümü tamamla butonu -->
                <button id="area-finish-btn" class="area-finish-button" style="display: none;" title="Alan Ölçümünü Tamamla">
                    ✓ Tamamla
                </button>
                
                <div class="loading-overlay" id="loading-overlay">
                    <div style="font-size: 16px; margin-bottom: 8px;">Three.js yükleniyor...</div>
                    <div style="font-size: 12px; color: #94a3b8;">Lütfen bekleyin</div>
                </div>
                <div class="debug-info" id="debug-info" style="display: none;">
                    <div>Models: <span id="debug-models">0</span></div>
                    <div>Camera: <span id="debug-camera">-</span></div>
                    <div>FPS: <span id="debug-fps">-</span></div>
                </div>
            </div>
            
            <!-- Controls Panel -->
            <div class="controls-panel">
                <!-- Tab Navigation -->
                <div class="tab-navigation">
                    <button class="tab-btn active" data-tab="model" id="tab-btn-model">
                        🎲 Model
                    </button>
                    <button class="tab-btn" data-tab="building" id="tab-btn-building">
                        🏢 Bina
                    </button>
                    <button class="tab-btn" data-tab="shape" id="tab-btn-shape">
                        🔷 Şekil
                    </button>
                    <button class="tab-btn" data-tab="text" id="tab-btn-text">
                        📝 Metin
                    </button>
                </div>
                
                <!-- Tab Contents -->
                <div class="tab-contents">
                    <!-- Model Tab -->
                    <div class="tab-content active" id="tab-content-model">
                        <div class="form-section">
                            <select class="model-select-dropdown" id="model-select-dropdown">
                                <option value="">-- Model Seçin --</option>
                            </select>
                        </div>
                        
                        <div class="form-section placement-controls" id="placement-controls">
                            <div class="control-group" id="scale-control-group" style="display:none;">
                                <div class="control-header">
                                    <span class="control-label">Alan:</span>
                                    <span class="control-value" id="scale-value">500 m²</span>
                                </div>
                                <input type="range" id="model-scale" min="0.1" max="3" step="0.1" value="1.0" disabled />
                            </div>
                            <div class="control-group">
                                <div class="control-header">
                                    <span class="control-label">Döndür:</span>
                                    <span class="control-value" id="rotation-value">0°</span>
                                </div>
                                <input type="range" id="model-rotation" min="0" max="360" step="5" value="0" disabled />
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button class="btn-add" id="add-model-btn" disabled>
                                ➕ Model Ekle
                            </button>
                            <button class="btn-clear" id="clear-models-btn">
                                🗑️ Tümünü Temizle
                            </button>
                        </div>
                    </div>
                    
                    <!-- Building Tab -->
                    <div class="tab-content" id="tab-content-building">
                        <div class="form-section">
                            <p style="color: #64748b; font-size: 12px;">Bina çizimi özelliği yakında eklenecek.</p>
                        </div>
                    </div>
                    
                    <!-- Shape Tab -->
                    <div class="tab-content" id="tab-content-shape">
                        <div class="form-section">
                            <div style="margin-bottom: 12px;">
                                <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Şekiller</h3>
                                <div class="shape-list" id="shape-list">
                                    <p style="color: #64748b; font-size: 12px; text-align: center; padding: 20px;">
                                        Henüz şekil eklenmedi. Haritaya şekil çizmek için "Şekil" menüsünü kullanın.
                                    </p>
                                </div>
                            </div>
                            
                            <div id="selected-shape-properties" style="display: none;">
                                <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Seçili Şekil Özellikleri</h3>
                                <div id="shape-properties-content"></div>
                                
                                <div class="movement-controls-label">Hareket Kontrolleri</div>
                                <div class="movement-controls" id="movement-controls">
                                    <button class="movement-btn up" id="move-up-btn" title="Yukarı">↑</button>
                                    <button class="movement-btn left" id="move-left-btn" title="Sol">←</button>
                                    <button class="movement-btn right" id="move-right-btn" title="Sağ">→</button>
                                    <button class="movement-btn down" id="move-down-btn" title="Aşağı">↓</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Text Tab -->
                    <div class="tab-content" id="tab-content-text">
                        <div class="form-section">
                            <p style="color: #64748b; font-size: 12px;">Metin ekleme özelliği yakında eklenecek.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Mapbox GL JS -->
    <script src="https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_VERSION}/mapbox-gl.js"></script>
    <link href="https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_VERSION}/mapbox-gl.css" rel="stylesheet" />
    
    <!-- Bridge setup - React Native WebView ile iletişim için (modül script'ten önce) -->
    <script>
        // Bridge setup - React Native WebView ile iletişim için
        window.sendToReactNative = function(type, payload) {
            try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    const message = JSON.stringify({
                        type: type,
                        payload: payload
                    });
                    window.ReactNativeWebView.postMessage(message);
                    return true;
                } else {
                    return false;
                }
            } catch (e) {
                return false;
            }
        };
        
        // TEST: Bridge'in çalışıp çalışmadığını kontrol et (hızlı test)
        setTimeout(function() {
            if (window.sendToReactNative && typeof window.sendToReactNative === 'function') {
                window.sendToReactNative('debug', {
                    level: 'log',
                    message: '✅ Bridge test: sendToReactNative çalışıyor!',
                    timestamp: new Date().toISOString()
                });
            } else {
                // Eğer sendToReactNative yoksa, ReactNativeWebView'ı kontrol et
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'debug',
                        payload: {
                            level: 'warn',
                            message: '⚠️ Bridge test: sendToReactNative fonksiyonu yok ama ReactNativeWebView var',
                            timestamp: new Date().toISOString()
                        }
                    }));
                }
            }
        }, 100);
        
        // Global error handlers - Module script hatalarını yakalamak için
        window.addEventListener('error', function(event) {
            // Module script hatalarını yakala
            if (event.error && event.error.message && (
                event.error.message.includes('three') || 
                event.error.message.includes('THREE') ||
                event.error.stack && event.error.stack.includes('three')
            )) {
                console.error('[Three.js] ❌ Global error caught:', event.error);
                window.sendToReactNative('error', {
                    message: 'Three.js yükleme hatası: ' + (event.error.message || 'Bilinmeyen hata'),
                    type: 'threejs_module_error',
                    error: event.error.toString(),
                    stack: event.error.stack
                });
            }
        });
        
        window.addEventListener('unhandledrejection', function(event) {
            // Module script promise rejection'larını yakala
            const reason = event.reason;
            const errorMsg = reason?.message || reason?.toString() || 'Bilinmeyen promise rejection';
            
            if (errorMsg.includes('three') || errorMsg.includes('THREE') || 
                (reason?.stack && reason.stack.includes('three'))) {
                console.error('[Three.js] ❌ Unhandled promise rejection:', reason);
                window.sendToReactNative('error', {
                    message: 'Three.js promise rejection: ' + errorMsg,
                    type: 'threejs_module_error',
                    error: errorMsg,
                    stack: reason?.stack
                });
            }
        });
        
        // Three.js ES Module yükleme (importmap ile)
        // Test sonuçlarına göre: UMD build script tag ile yüklenemiyor ama ES Module fetch ile başarılı
        window._threeJsModuleCheckTimeout = setTimeout(function() {
            if (!window._threeJsModuleLoaded) {
                console.error('[Three.js] ❌ Three.js yüklenemedi (15s timeout)');
                window.sendToReactNative('error', {
                    message: 'Three.js kütüphanesi yüklenemedi (15 saniye timeout). İnternet bağlantınızı kontrol edin.',
                    type: 'threejs_module_timeout'
                });
            }
        }, 15000); // 15 saniye
        
        // Importmap ekle (ES module imports için gerekli)
        const importMap = document.createElement('script');
        importMap.type = 'importmap';
        importMap.textContent = JSON.stringify({
            "imports": {
                "three": "https://unpkg.com/three@${THREE_VERSION}/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@${THREE_VERSION}/examples/jsm/"
            }
        });
        document.head.appendChild(importMap);
        console.log('[Three.js] Importmap eklendi');
        
        // Three.js ES Module yükle (fetch ile ve eval ile - importmap dynamic import'u destekler)
        const loadThreeJs = async function() {
            try {
                console.log('[Three.js] 🔄 Fetch ile ES Module yükleniyor...');
                
                // ES Module'ü fetch ile al
                const response = await fetch('https://unpkg.com/three@${THREE_VERSION}/build/three.module.js');
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const moduleCode = await response.text();
                console.log('[Three.js] ✅ Module code fetched, size:', moduleCode.length, 'bytes');
                
                // Module'ü yükle ve global'e expose et
                // Not: ES module'leri doğrudan eval edemeyiz, import() kullanmalıyız
                // Ancak importmap sayesinde dynamic import çalışacak
                
                // Önce importmap'in yüklenmesini bekle
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Dynamic import kullan (importmap sayesinde "three" specifier çalışacak)
                try {
                    const THREE = await import('three');
                    
                    // Three.js ES module'ü tüm export'ları doğrudan modülde yapar
                    // Default export yok, tüm sınıflar ve fonksiyonlar modülde
                    // Global'e expose et - THREE modülünün kendisini kullan
                    window.THREE = THREE;
                    window._threeJsModuleLoaded = true;
                    
                    // Timeout'u iptal et
                    if (window._threeJsModuleCheckTimeout) {
                        clearTimeout(window._threeJsModuleCheckTimeout);
                        window._threeJsModuleCheckTimeout = null;
                    }
                    
                    console.log('[Three.js] ✅ THREE loaded via dynamic import:', !!window.THREE, 'Version:', window.THREE.REVISION);
                    
                    // Not: threejs-ready mesajı Mapbox hazır olduğunda gönderilecek
                    // THREE yüklenmesi arka planda devam edebilir
                    
                    // Global state'i initialize et
                    initializeGlobalState();
                    
                } catch (importError) {
                    console.error('[Three.js] ❌ Dynamic import failed:', importError);
                    // Fallback: jsdelivr CDN dene
                    console.log('[Three.js] ⚠️ unpkg.com başarısız, jsdelivr.com deneniyor...');
                    
                    // Importmap'i güncelle
                    importMap.textContent = JSON.stringify({
                        "imports": {
                            "three": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js",
                            "three/addons/": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"
                        }
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    const THREE = await import('three');
                    window.THREE = THREE; // THREE modülünün kendisini kullan
                    window._threeJsModuleLoaded = true;
                    
                    if (window._threeJsModuleCheckTimeout) {
                        clearTimeout(window._threeJsModuleCheckTimeout);
                        window._threeJsModuleCheckTimeout = null;
                    }
                    
                    console.log('[Three.js] ✅ THREE loaded via jsdelivr CDN');
                    initializeGlobalState();
                }
                
            } catch (e) {
                console.error('[Three.js] ❌ THREE load error:', e);
                window.sendToReactNative('error', {
                    message: 'Three.js kütüphanesi yüklenemedi: ' + (e.message || 'Bilinmeyen hata'),
                    type: 'threejs_module_error',
                    error: e.toString()
                });
            }
        };
        
        // Global state initialization (module script yerine)
        function initializeGlobalState() {
            // sendToReactNative zaten normal script'te tanımlanmış, burada override etme
            // Global state
            window.threeJsState = {
            map: null,
            scene: null,
            camera: null,
            renderer: null,
            controls: null,
            selectedModel: null,
            selectedType: null,
            selectedFile: null,
            models: [],
            clickHandler: null,
            modelLayers: [], // Mapbox custom layers
            selectedModelLayer: null, // Seçili model layer ID
            selectedModelEntity: null, // Seçili model entity (Three.js object)
            modelEntities: {}, // Layer ID -> Three.js entity mapping
            drawingMode: null, // null | 'parcel-selection' | 'rectangle' | 'triangle' | 'circle' | 'ellipse' | 'polygon' | 'line' | 'arrow' | 'marker' | 'textbox'
            drawingStartPos: null,
            drawingPoints: [],
            ellipseAxes: [],
            shapes: [], // Çizilen şekiller
            selectedShape: null, // Seçili şekil ID
            selectedShapeLayers: [], // Seçili şeklin layer ID'leri
            parcelSource: null, // Parsel source ID
            parcelLayers: [], // Parsel layer ID'leri
            measurementLayers: [], // Ölçüm layer ID'leri
            measurementFeatures: [], // Ölçüm feature'ları
            areaPreviewLayer: null, // Alan ölçüm preview layer ID
            rulerPoints: [], // Mesafe ölçümü noktaları
            areaPoints: [] // Alan ölçümü noktaları
        };
        
            // Backend URL
            window.BACKEND_URL = '${backendUrl}';
            window.STATIC_URL = '${STATIC_URL}';
            window.MAPBOX_TOKEN = '${MAPBOX_TOKEN}';
            
            // Console log'ları React Native'e gönder (debug için)
            const originalConsoleLog = console.log;
            const originalConsoleError = console.error;
            const originalConsoleWarn = console.warn;
            
            function sendDebugLog(level, ...args) {
                try {
                    if (window.sendToReactNative && typeof window.sendToReactNative === 'function') {
                        window.sendToReactNative('debug', {
                            level: level, // 'log', 'error', 'warn'
                            message: args.map(arg => {
                                if (typeof arg === 'object') {
                                    try {
                                        return JSON.stringify(arg);
                                    } catch {
                                        return String(arg);
                                    }
                                }
                                return String(arg);
                            }).join(' '),
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (e) {
                    // sendToReactNative henüz hazır değilse ignore et
                }
            }
            
            console.log = function(...args) {
                originalConsoleLog.apply(console, args);
                sendDebugLog('log', ...args);
            };
            
            console.error = function(...args) {
                originalConsoleError.apply(console, args);
                sendDebugLog('error', ...args);
            };
            
            console.warn = function(...args) {
                originalConsoleWarn.apply(console, args);
                sendDebugLog('warn', ...args);
            };
            
            console.log('[WebView] Console logging redirected to React Native');
        }
        
        // Three.js'i yükle
        loadThreeJs();
        
        // Initialize Mapbox
        async function initMapbox() {
            const mapContainer = document.getElementById('mapbox-map');
            if (!mapContainer) {
                console.error('[Mapbox] Container not found');
                return;
            }
            
            // Mapbox script'inin yüklendiğini bekle
            if (!window.mapboxgl) {
                console.log('[Mapbox] ⏳ Waiting for mapboxgl script to load...');
                await new Promise((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 100; // 10 saniye
                    const checkInterval = setInterval(() => {
                        attempts++;
                        if (window.mapboxgl) {
                            clearInterval(checkInterval);
                            console.log('[Mapbox] ✅ mapboxgl loaded after', attempts * 100, 'ms');
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            clearInterval(checkInterval);
                            console.error('[Mapbox] ❌ mapboxgl failed to load after 10s timeout');
                            window.sendToReactNative('error', {
                                message: 'Mapbox GL JS kütüphanesi yüklenemedi (10 saniye timeout)',
                                type: 'mapbox_load_timeout'
                            });
                            resolve(); // Devam et ama hata handle edilsin
                        }
                    }, 100);
                });
            }
            
            if (!window.mapboxgl) {
                console.error('[Mapbox] ❌ mapboxgl still not available after wait');
                return;
            }
            
            if (!window.mapboxgl.accessToken) {
                window.mapboxgl.accessToken = window.MAPBOX_TOKEN;
            }
            
            const center = [${initialCenter[0]}, ${initialCenter[1]}];
            const zoom = ${initialZoom};
            
            console.log('[Mapbox] 🚀 Creating map with center:', center, 'zoom:', zoom);
            const map = new window.mapboxgl.Map({
                container: mapContainer,
                style: 'mapbox://styles/mapbox/satellite-streets-v12',
                center: center,
                zoom: zoom,
                pitch: 0,
                bearing: 0,
                antialias: true
            });
            
            console.log('[Mapbox] ✅ Map instance created, waiting for load event...');
            
            // Map load event handler
            map.on('load', () => {
                console.log('[Mapbox] ✅✅✅ Map load event triggered!');
                window.threeJsState.map = map;
                
                // Harita tıklama handler
                map.on('click', (e) => {
                    handleMapClick(e);
                });
                
                // Double-click handler
                map.on('dblclick', (e) => {
                    handleMapDoubleClick(e);
                });
                
                // Alan ölçümü tamamla butonu event listener'ını ekle
                setTimeout(setupAreaFinishButton, 100);
                
                // Loading'i hemen kapat (Mapbox yüklendi, Three.js model eklerken yüklenecek)
                const loadingEl = document.getElementById('loading-overlay');
                if (loadingEl) {
                    loadingEl.classList.add('hidden');
                    console.log('[Mapbox] Loading overlay hidden');
                }
                
                // React Native'e bildir (Mapbox hazır) - Hemen gönder
                console.log('[Mapbox] ✅ Map loaded, sending threejs-ready message to React Native');
                console.log('[Mapbox] sendToReactNative function available:', typeof window.sendToReactNative === 'function');
                console.log('[Mapbox] ReactNativeWebView available:', !!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage));
                
                // Mesajı göndermeyi dene, eğer başarısız olursa tekrar dene
                function sendReadyMessage(attempt = 0) {
                    const maxAttempts = 20; // 10 saniye toplam (500ms * 20)
                    try {
                        if (window.sendToReactNative && typeof window.sendToReactNative === 'function') {
                            const messagePayload = {
                                mapboxReady: true
                            };
                            console.log('[Mapbox] Attempting to send threejs-ready message (attempt ' + (attempt + 1) + '):', messagePayload);
                            
                            window.sendToReactNative('threejs-ready', messagePayload);
                            console.log('[Mapbox] ✅ threejs-ready message sent successfully (attempt ' + (attempt + 1) + ')');
                        } else {
                            if (attempt < maxAttempts) {
                                console.warn('[Mapbox] sendToReactNative not available (attempt ' + (attempt + 1) + '/' + maxAttempts + '), retrying in 500ms...');
                                setTimeout(() => sendReadyMessage(attempt + 1), 500);
                            } else {
                                console.error('[Mapbox] ❌ Failed to send threejs-ready message after ' + maxAttempts + ' attempts');
                            }
                        }
                    } catch (e) {
                        console.error('[Mapbox] ❌ Error sending threejs-ready message (attempt ' + (attempt + 1) + '):', e);
                        if (attempt < maxAttempts) {
                            // 500ms sonra tekrar dene
                            setTimeout(() => sendReadyMessage(attempt + 1), 500);
                        }
                    }
                }
                
                // Hemen gönder
                console.log('[Mapbox] 🔄 Starting to send threejs-ready message...');
                sendReadyMessage(0);
                
                // Ayrıca direkt bir kez daha dene (güvenlik için)
                setTimeout(() => {
                    console.log('[Mapbox] 🔄 Direct send attempt after 1 second...');
                    if (window.sendToReactNative && typeof window.sendToReactNative === 'function') {
                        try {
                            window.sendToReactNative('threejs-ready', { mapboxReady: true });
                            console.log('[Mapbox] ✅ Direct send successful');
                        } catch (e) {
                            console.error('[Mapbox] ❌ Direct send error:', e);
                        }
                    } else {
                        console.warn('[Mapbox] ⚠️ sendToReactNative still not available');
                    }
                }, 1000);
                
                // Three.js'i arka planda başlat (model eklerken lazım olacak)
                // Ama loading'i kapatmayı beklemeyiz
                initThreeJs().catch(err => {
                    console.warn('[Three.js] Background initialization failed (will retry when needed):', err);
                });
                
                // Model listesini yükle (hata olsa bile devam et)
                loadModelsList().catch(err => {
                    console.warn('[Mapbox] Model list loading failed (non-critical):', err);
                    // Hata olsa bile Three.js yüklemesini engelleme
                });
            });
            
            map.on('error', (e) => {
                console.error('[Mapbox] ❌ Map error:', e);
                window.sendToReactNative('error', { 
                    message: 'Harita yüklenemedi: ' + (e.error?.message || 'Bilinmeyen hata'),
                    type: 'mapbox_error'
                });
            });
            
            // Debug: Map'in durumunu kontrol et
            console.log('[Mapbox] Map instance:', {
                loaded: map.loaded(),
                style: map.getStyle(),
                center: map.getCenter(),
                zoom: map.getZoom()
            });
        }
        
        // Harita tıklama handler
        function handleMapClick(e) {
            if (!window.threeJsState.map) return;
            
            const lng = e.lngLat.lng;
            const lat = e.lngLat.lat;
            
            console.log('[Mapbox] Map clicked:', { lng, lat });
            
            // Drawing mode kontrolü
            const drawingMode = window.threeJsState.drawingMode;
            
            if (drawingMode === 'parcel-selection') {
                handleParcelSelectionClick(lng, lat);
                return;
            }
            
            if (drawingMode === 'rectangle') {
                handleRectangleClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'triangle') {
                handleTriangleClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'circle') {
                handleCircleClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'ellipse') {
                handleEllipseClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'polygon') {
                handlePolygonClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'line') {
                handleLineClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'arrow') {
                handleArrowClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'marker') {
                handleMarkerClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'textbox') {
                handleTextBoxClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'measure-distance') {
                handleMeasurementDistanceClick({ lon: lng, lat: lat });
                return;
            }
            
            if (drawingMode === 'measure-area') {
                handleMeasurementAreaClick({ lon: lng, lat: lat });
                return;
            }
            
            // Model ekleme (eski mantık)
            if (window.threeJsState.selectedModel) {
                addModelToMap(lng, lat);
                return;
            }
            
            // Model seçimi kontrolü (drawing mode yoksa)
            if (!drawingMode) {
                // Önce model seçimini kontrol et
                const modelSelected = handleModelSelection(e);
                if (!modelSelected) {
                    // Model seçilmediyse şekil seçimini dene
                    handleShapeSelection(e);
                }
            }
        }
        
        // Model seçim handler
        function handleModelSelection(e) {
            const map = window.threeJsState.map;
            if (!map) return false;
            
            // Tıklanan noktadaki model marker'larını sorgula
            const features = map.queryRenderedFeatures(e.point, {
                layers: map.getStyle().layers
                    .map(layer => layer.id)
                    .filter(id => id.endsWith('-marker') && id.startsWith('model-layer-'))
            });
            
            if (features.length > 0) {
                const clickedFeature = features[0];
                const modelLayerId = clickedFeature.properties.modelLayerId;
                
                if (modelLayerId && window.threeJsState.modelEntities[modelLayerId]) {
                    // Model'i seç
                    selectModel(modelLayerId);
                    return true;
                }
            }
            
            return false;
        }
        
        // Model seç
        function selectModel(layerId) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            // Eski seçimi temizle
            deselectModel();
            
            const modelEntity = window.threeJsState.modelEntities[layerId];
            if (!modelEntity) return;
            
            // Seçili model'i state'e kaydet
            window.threeJsState.selectedModelLayer = layerId;
            window.threeJsState.selectedModelEntity = modelEntity;
            
            // Model tipini state'e kaydet (slider'lar için)
            if (modelEntity.type) {
                window.threeJsState.selectedType = modelEntity.type;
            }
            
            // Model'i highlight et (outline ekle)
            if (modelEntity.model) {
                // Three.js model'e outline eklemek için EdgeGeometry kullanabiliriz
                // Şimdilik sadece state'te saklayalım, görsel highlight için daha sonra eklenebilir
                console.log('[Model] Model selected:', layerId, 'type:', modelEntity.type);
            }
            
            // Slider'ları aktif et ve değerleri senkronize et
            syncSlidersWithModel(modelEntity);
            
            // Model sekmesine geç
            const modelTab = document.querySelector('[data-tab="model"]');
            if (modelTab) {
                modelTab.click();
            }
            
            // React Native'e bildir
            window.sendToReactNative('model-selected', {
                layerId: layerId,
                position: modelEntity.position
            });
        }
        
        // Model seçimini kaldır
        function deselectModel() {
            if (window.threeJsState.selectedModelLayer) {
                window.threeJsState.selectedModelLayer = null;
                window.threeJsState.selectedModelEntity = null;
                
                // Slider'ları disable et
                const rotationSlider = document.getElementById('model-rotation');
                const scaleSlider = document.getElementById('model-scale');
                const scaleControl = document.getElementById('scale-control-group');
                
                if (rotationSlider) rotationSlider.disabled = true;
                if (scaleSlider) scaleSlider.disabled = true;
                if (scaleControl) scaleControl.style.display = 'none';
            }
        }
        
        // Slider'ları model ile senkronize et
        function syncSlidersWithModel(modelEntity) {
            const rotationSlider = document.getElementById('model-rotation');
            const scaleSlider = document.getElementById('model-scale');
            const scaleControl = document.getElementById('scale-control-group');
            
            if (rotationSlider) {
                rotationSlider.value = modelEntity.rotation || 0;
                rotationSlider.disabled = false;
                const rotationValueEl = document.getElementById('rotation-value');
                if (rotationValueEl) {
                    rotationValueEl.textContent = Math.round(modelEntity.rotation || 0) + '°';
                }
            }
            
            // Model tipini belirle (entity'den veya selectedType'dan)
            let modelType = modelEntity.type || window.threeJsState.selectedType;
            if (!modelType) {
                // Varsayılan olarak house (scale aktif olsun)
                modelType = 'house';
            }
            
            if (modelType === 'house') {
                if (scaleControl) scaleControl.style.display = 'block';
                if (scaleSlider) {
                    scaleSlider.value = modelEntity.scale || 1.0;
                    scaleSlider.disabled = false;
                    const scaleValueEl = document.getElementById('scale-value');
                    if (scaleValueEl) {
                        const baseArea = 500;
                        const currentArea = Math.round(baseArea * (modelEntity.scale || 1.0) * (modelEntity.scale || 1.0));
                        scaleValueEl.textContent = currentArea + ' m²';
                    }
                }
            } else {
                if (scaleControl) scaleControl.style.display = 'none';
                if (scaleSlider) {
                    scaleSlider.value = '1.0';
                    scaleSlider.disabled = true;
                }
            }
        }
        
        // Şekil seçim handler
        function handleShapeSelection(e) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            // Tıklanan noktadaki feature'ları sorgula
            const features = map.queryRenderedFeatures(e.point, {
                layers: map.getStyle().layers
                    .map(layer => layer.id)
                    .filter(id => id.startsWith('shape-'))
            });
            
            if (features.length > 0) {
                // İlk bulunan shape layer'ını al
                const clickedLayerId = features[0].layer.id;
                
                // Shape ID'yi çıkar (örn: "shape-rectangle-1234567890-fill" -> "shape-rectangle-1234567890")
                let shapeId = clickedLayerId;
                if (clickedLayerId.includes('-fill') || clickedLayerId.includes('-line') || 
                    clickedLayerId.includes('-text') || clickedLayerId.includes('-bg') || 
                    clickedLayerId.includes('-pin') || clickedLayerId.includes('-border')) {
                    // Layer ID'den base shape ID'yi çıkar
                    const parts = clickedLayerId.split('-');
                    const timestampIndex = parts.findIndex(p => /^\d+$/.test(p));
                    if (timestampIndex > 0) {
                        shapeId = parts.slice(0, timestampIndex + 1).join('-');
                    } else {
                        // Fallback: son "-" öncesini al
                        const lastDash = clickedLayerId.lastIndexOf('-');
                        if (lastDash > 0) {
                            shapeId = clickedLayerId.substring(0, lastDash);
                        }
                    }
                }
                
                selectShape(shapeId);
            } else {
                // Boş yere tıklandı - seçimi kaldır
                deselectShape();
            }
        }
        
        // Şekil seç
        function selectShape(shapeId) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            // Eski seçimi kaldır
            deselectShape();
            
            // Shape'i bul
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (!shape) {
                console.warn('[Shape Selection] Shape not found:', shapeId);
                return;
            }
            
            // Seçili şekli kaydet
            window.threeJsState.selectedShape = shapeId;
            
            // Shape'in tüm layer'larını bul ve highlight et
            const shapeLayers = [];
            const allLayers = map.getStyle().layers;
            
            allLayers.forEach(layer => {
                if (layer.id.startsWith(shapeId + '-') || layer.id === shapeId) {
                    shapeLayers.push(layer.id);
                    
                    // Orijinal değerleri sakla
                    if (!shape.originalLineColor && layer.type === 'line') {
                        shape.originalLineColor = map.getPaintProperty(layer.id, 'line-color');
                        shape.originalLineWidth = map.getPaintProperty(layer.id, 'line-width') || 2;
                    }
                    if (!shape.originalFillOpacity && layer.type === 'fill') {
                        shape.originalFillOpacity = map.getPaintProperty(layer.id, 'fill-opacity') || 0.5;
                    }
                    
                    // Highlight: outline rengini değiştir veya ek highlight layer ekle
                    if (layer.type === 'line') {
                        // Mevcut line rengini daha parlak yap
                        map.setPaintProperty(layer.id, 'line-color', '#ffff00'); // Sarı highlight
                        map.setPaintProperty(layer.id, 'line-width', 
                            (map.getPaintProperty(layer.id, 'line-width') || 2) + 2); // Daha kalın
                    } else if (layer.type === 'fill') {
                        // Fill için opacity artır
                        map.setPaintProperty(layer.id, 'fill-opacity', 0.8);
                    }
                }
            });
            
            window.threeJsState.selectedShapeLayers = shapeLayers;
            
            // Şekil düzenleme panelini aç
            openShapeEditingPanel(shape);
            
            // Şekil sekmesindeki listeyi güncelle
            updateShapeList();
            
            // Seçili şekil özelliklerini göster
            showSelectedShapeProperties(shape);
            
            console.log('[Shape Selection] Shape selected:', shapeId, shape);
        }
        
        // Şekil seçimini kaldır
        function deselectShape() {
            const map = window.threeJsState.map;
            if (!map || !window.threeJsState.selectedShape) return;
            
            // Highlight'ı kaldır
            window.threeJsState.selectedShapeLayers.forEach(layerId => {
                try {
                    if (map.getLayer(layerId)) {
                        if (map.getLayer(layerId).type === 'line') {
                            // Orijinal rengi geri yükle (shape metadata'dan)
                            const shape = window.threeJsState.shapes.find(s => s.id === window.threeJsState.selectedShape);
                            if (shape && shape.originalLineColor) {
                                map.setPaintProperty(layerId, 'line-color', shape.originalLineColor);
                            }
                            const originalWidth = shape?.originalLineWidth || 2;
                            map.setPaintProperty(layerId, 'line-width', originalWidth);
                        } else if (map.getLayer(layerId).type === 'fill') {
                            const originalOpacity = shape?.originalFillOpacity || 0.5;
                            map.setPaintProperty(layerId, 'fill-opacity', originalOpacity);
                        }
                    }
                } catch (e) {
                    console.warn('[Shape Selection] Error removing highlight:', e);
                }
            });
            
            window.threeJsState.selectedShape = null;
            window.threeJsState.selectedShapeLayers = [];
            
            // Panel'i kapat
            closeShapeEditingPanel();
        }
        
        // Şekil düzenleme panelini aç
        function openShapeEditingPanel(shape) {
            const isTextBox = shape.type === 'textbox';
            
            // Submenu'yu aç ve içeriği doldur
            if (isTextBox) {
                openTextBoxEditingPanel(shape);
            } else {
                openGeneralShapeEditingPanel(shape);
            }
        }
        
        // Genel şekil düzenleme paneli
        function openGeneralShapeEditingPanel(shape) {
            const props = getShapeProperties(shape.id);
            if (!props) return;
            
            const content = \`
                <div class="shape-editing-panel">
                    <div class="control-group">
                        <input type="text" id="shape-name" class="shape-input" placeholder="Şekil adı..." value="\${props.name || ''}" />
                    </div>
                    
                    <div class="compact-form-row">
                        <div class="form-group">
                            <label class="color-label">Çizgi Renk</label>
                            <div class="color-picker-group">
                                <input type="color" id="shape-outline-color" class="color-picker" value="\${props.outlineColor || '#3b82f6'}" />
                                <input type="text" id="shape-outline-color-hex" class="color-hex-input" value="\${props.outlineColor || '#3b82f6'}" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="color-label">Dolgu Renk</label>
                            <div class="color-picker-group">
                                <input type="color" id="shape-fill-color" class="color-picker" value="\${props.fillColor || '#3b82f6'}" />
                                <input type="text" id="shape-fill-color-hex" class="color-hex-input" value="\${props.fillColor || '#3b82f6'}" />
                            </div>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-header">
                            <span class="control-label">Çizgi Kalınlığı:</span>
                            <span class="control-value" id="shape-outline-width-value">\${props.outlineWidth || 2}px</span>
                        </div>
                        <input type="range" id="shape-outline-width" min="1" max="10" step="1" value="\${props.outlineWidth || 2}" />
                    </div>
                    
                    <div class="control-group">
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; margin: 0;">
                            <input type="checkbox" id="shape-fill-enabled" \${props.fillEnabled ? 'checked' : ''} />
                            <span class="checkbox-label">Dolgu Aktif</span>
                        </label>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-header">
                            <span class="control-label">Şeffaflık:</span>
                            <span class="control-value" id="shape-opacity-value">\${Math.round((props.opacity || 1) * 100)}%</span>
                        </div>
                        <input type="range" id="shape-opacity" min="0" max="100" step="5" value="\${Math.round((props.opacity || 1) * 100)}" />
                    </div>
                    
                    <div class="compact-form-row">
                        <div class="form-group">
                            <div class="control-header">
                                <span class="control-label">Açı:</span>
                                <span class="control-value" id="shape-rotation-value">\${Math.round(props.rotation || 0)}°</span>
                            </div>
                            <input type="range" id="shape-rotation" min="0" max="360" step="5" value="\${Math.round(props.rotation || 0)}" />
                        </div>
                        <div class="form-group">
                            <div class="control-header">
                                <span class="control-label">Boyut:</span>
                                <span class="control-value" id="shape-scale-value">\${Math.round((props.scale || 1) * 100)}%</span>
                            </div>
                            <input type="range" id="shape-scale" min="10" max="500" step="5" value="\${Math.round((props.scale || 1) * 100)}" />
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-header">
                            <span class="control-label">Katman:</span>
                            <span class="control-value" id="shape-layer-value">\${props.layer || 0}</span>
                        </div>
                        <input type="range" id="shape-layer" min="0" max="10" step="1" value="\${props.layer || 0}" />
                    </div>
                    
                    <div class="control-group">
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; margin: 0;">
                            <input type="checkbox" id="shape-visible" \${props.visible !== false ? 'checked' : ''} />
                            <span class="checkbox-label">Görünür</span>
                        </label>
                    </div>
                    
                    <div class="shape-management-buttons">
                        <button id="shape-duplicate-btn" class="control-btn" title="Kopyala">
                            📋 Kopyala
                        </button>
                        <button id="shape-delete-btn" class="control-btn" title="Sil" style="background: rgba(239, 68, 68, 0.9);">
                            🗑️ Sil
                        </button>
                    </div>
                </div>
            \`;
            
            openSubmenu('Şekil Düzenleme', content);
            
            // Event listener'ları ekle
            setTimeout(() => {
                setupShapeEditingPanelEventListeners(shape.id);
            }, 10);
        }
        
        // TextBox düzenleme paneli
        function openTextBoxEditingPanel(shape) {
            const props = getShapeProperties(shape.id);
            if (!props) return;
            
            const content = \`
                <div class="textbox-editing-panel">
                    <div class="control-group">
                        <textarea id="shape-text-content" class="shape-input" rows="2" placeholder="Metin yazın...">\${props.text || 'Metin'}</textarea>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-header">
                            <span class="control-label">Metin Boyutu:</span>
                            <span class="control-value" id="shape-text-size-value">\${props.fontSize || 16}px</span>
                        </div>
                        <input type="range" id="shape-text-size" min="8" max="72" step="2" value="\${props.fontSize || 16}" />
                    </div>
                    
                    <div class="compact-form-row">
                        <div class="form-group">
                            <label for="shape-text-weight" class="color-label">Kalınlık</label>
                            <select id="shape-text-weight" class="shape-input">
                                <option value="normal" \${props.fontWeight === 'normal' ? 'selected' : ''}>Normal</option>
                                <option value="bold" \${props.fontWeight === 'bold' ? 'selected' : ''}>Kalın</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="shape-text-font" class="color-label">Font</label>
                            <select id="shape-text-font" class="shape-input">
                                <option value="Arial" \${props.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                                <option value="Times New Roman" \${props.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                                <option value="Courier New" \${props.fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                                <option value="sans-serif" \${props.fontFamily === 'sans-serif' ? 'selected' : ''}>Sans-serif</option>
                                <option value="serif" \${props.fontFamily === 'serif' ? 'selected' : ''}>Serif</option>
                                <option value="monospace" \${props.fontFamily === 'monospace' ? 'selected' : ''}>Monospace</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="compact-form-row">
                        <div class="form-group">
                            <label class="color-label">Metin Renk</label>
                            <div class="color-picker-group">
                                <input type="color" id="shape-text-color" class="color-picker" value="\${props.textColor || '#ffffff'}" />
                                <input type="text" id="shape-text-color-hex" class="color-hex-input" value="\${props.textColor || '#ffffff'}" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="color-label">Kenarlık Renk</label>
                            <div class="color-picker-group">
                                <input type="color" id="shape-text-outline-color" class="color-picker" value="\${props.outlineColor || '#000000'}" />
                                <input type="text" id="shape-text-outline-color-hex" class="color-hex-input" value="\${props.outlineColor || '#000000'}" />
                            </div>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-header">
                            <span class="control-label">Kenarlık Kalınlığı:</span>
                            <span class="control-value" id="shape-text-outline-width-value">\${props.outlineWidth || 2}px</span>
                        </div>
                        <input type="range" id="shape-text-outline-width" min="0" max="10" step="1" value="\${props.outlineWidth || 2}" />
                    </div>
                    
                    <div class="control-group">
                        <label class="color-label">Kutu Renk</label>
                        <div class="color-picker-group">
                            <input type="color" id="shape-background-color" class="color-picker" value="\${props.backgroundColor || '#3b82f6'}" />
                            <input type="text" id="shape-background-color-hex" class="color-hex-input" value="\${props.backgroundColor || '#3b82f6'}" />
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; margin: 0;">
                            <input type="checkbox" id="shape-background-enabled" \${props.showBackground !== false ? 'checked' : ''} />
                            <span class="checkbox-label">Kutu Göster</span>
                        </label>
                    </div>
                    
                    <div class="compact-form-row">
                        <div class="form-group">
                            <div class="control-header">
                                <span class="control-label">Padding:</span>
                                <span class="control-value" id="shape-background-padding-value">\${props.backgroundPadding || 6}px</span>
                            </div>
                            <input type="range" id="shape-background-padding" min="0" max="20" step="1" value="\${props.backgroundPadding || 6}" />
                        </div>
                        <div class="form-group">
                            <div class="control-header">
                                <span class="control-label">Köşe:</span>
                                <span class="control-value" id="shape-border-radius-value">\${props.borderRadius || 0}px</span>
                            </div>
                            <input type="range" id="shape-border-radius" min="0" max="20" step="1" value="\${props.borderRadius || 0}" />
                        </div>
                    </div>
                    
                    <div class="shape-management-buttons">
                        <button id="shape-duplicate-btn" class="control-btn" title="Kopyala">
                            📋 Kopyala
                        </button>
                        <button id="shape-delete-btn" class="control-btn" title="Sil" style="background: rgba(239, 68, 68, 0.9);">
                            🗑️ Sil
                        </button>
                    </div>
                </div>
            \`;
            
            openSubmenu('Metin Kutusu Düzenleme', content);
            
            // Event listener'ları ekle
            setTimeout(() => {
                setupTextBoxEditingPanelEventListeners(shape.id);
            }, 10);
        }
        
        // Şekil düzenleme panelini kapat
        function closeShapeEditingPanel() {
            const submenu = document.getElementById('map-controls-right');
            if (submenu) {
                submenu.style.display = 'none';
            }
        }
        
        // Şekil özelliklerini oku
        function getShapeProperties(shapeId) {
            const map = window.threeJsState.map;
            if (!map) return null;
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (!shape) return null;
            
            const props = {
                name: shape.name || '',
                outlineColor: '#3b82f6',
                outlineWidth: 2,
                fillColor: '#3b82f6',
                fillEnabled: true,
                opacity: 1.0,
                rotation: 0,
                scale: 1.0,
                layer: 0,
                visible: true
            };
            
            // Mapbox layer'larından özellikleri oku
            const allLayers = map.getStyle().layers;
            const shapeLayers = allLayers.filter(layer => 
                layer.id.startsWith(shapeId + '-') || layer.id === shapeId
            );
            
            shapeLayers.forEach(layer => {
                if (layer.type === 'line') {
                    const lineColor = map.getPaintProperty(layer.id, 'line-color');
                    if (lineColor) props.outlineColor = rgbToHex(lineColor);
                    const lineWidth = map.getPaintProperty(layer.id, 'line-width');
                    if (lineWidth) props.outlineWidth = lineWidth;
                } else if (layer.type === 'fill') {
                    const fillColor = map.getPaintProperty(layer.id, 'fill-color');
                    if (fillColor) props.fillColor = rgbToHex(fillColor);
                    const fillOpacity = map.getPaintProperty(layer.id, 'fill-opacity');
                    if (fillOpacity !== undefined) props.opacity = fillOpacity;
                    props.fillEnabled = fillOpacity > 0;
                }
                
                const visibility = map.getLayoutProperty(layer.id, 'visibility');
                if (visibility === 'none') props.visible = false;
            });
            
            // TextBox için özel özellikler
            if (shape.type === 'textbox') {
                const textLayer = shapeLayers.find(l => l.id.includes('-text'));
                if (textLayer) {
                    const textColor = map.getPaintProperty(textLayer.id, 'text-color');
                    if (textColor) props.textColor = rgbToHex(textColor);
                    const textSize = map.getLayoutProperty(textLayer.id, 'text-size');
                    if (textSize) props.fontSize = textSize;
                }
                
                props.text = shape.text || 'Metin';
                props.fontWeight = shape.fontWeight || 'normal';
                props.fontFamily = shape.fontFamily || 'Arial';
                props.backgroundColor = shape.backgroundColor || '#3b82f6';
                props.showBackground = shape.showBackground !== false;
                props.backgroundPadding = shape.backgroundPadding || 6;
                props.borderRadius = shape.borderRadius || 0;
            }
            
            // Shape metadata'dan ek özellikler
            if (shape.rotation !== undefined) props.rotation = shape.rotation;
            if (shape.scale !== undefined) props.scale = shape.scale;
            if (shape.layer !== undefined) props.layer = shape.layer;
            if (shape.name) props.name = shape.name;
            
            return props;
        }
        
        // RGB/RGBA string'ini hex'e çevir
        function rgbToHex(rgb) {
            if (typeof rgb === 'string' && rgb.startsWith('#')) return rgb;
            if (typeof rgb === 'string') {
                const match = rgb.match(/rgba?\\(\\s*(\\d+),\\s*(\\d+),\\s*(\\d+)/);
                if (match) {
                    const r = parseInt(match[1]);
                    const g = parseInt(match[2]);
                    const b = parseInt(match[3]);
                    return '#' + [r, g, b].map(x => {
                        const hex = x.toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                    }).join('');
                }
            }
            // Mapbox color array formatı [r, g, b, a] veya string
            if (Array.isArray(rgb) && rgb.length >= 3) {
                const r = Math.round(rgb[0] * 255);
                const g = Math.round(rgb[1] * 255);
                const b = Math.round(rgb[2] * 255);
                return '#' + [r, g, b].map(x => {
                    const hex = x.toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                }).join('');
            }
            return '#3b82f6'; // Default
        }
        
        // Double-click handler (polygon, line ve area measurement için)
        function handleMapDoubleClick(e) {
            const drawingMode = window.threeJsState.drawingMode;
            const map = window.threeJsState.map;
            
            if (drawingMode === 'polygon') {
                finishPolygon();
            } else if (drawingMode === 'line') {
                finishLine();
            } else if (drawingMode === 'measure-area') {
                // Alan ölçümünü tamamla (ana sayfadaki stratejiye göre)
                finishAreaMeasurement();
            }
        }
        
        // Model ekleme (Mapbox custom layer olarak)
        async function addModelToMap(lng, lat) {
            if (!window.threeJsState.map || !window.threeJsState.selectedFile) {
                console.warn('[Model] Cannot add model: map or selectedFile missing');
                return;
            }
            
            const addBtn = document.getElementById('add-model-btn');
            if (addBtn) {
                addBtn.disabled = true;
                addBtn.textContent = 'Ekleniyor...';
            }
            
            const scaleSlider = document.getElementById('model-scale');
            const rotationSlider = document.getElementById('model-rotation');
            const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;
            const rotationDeg = rotationSlider ? parseFloat(rotationSlider.value) : 0;
            
            // Model URL path düzeltmesi - STATIC_URL kontrolü
            const staticUrl = window.STATIC_URL || window.BACKEND_URL + '/static';
            const modelUrl = staticUrl + '/models/' + window.threeJsState.selectedType + '/' + window.threeJsState.selectedFile;
            console.log('[Model] Loading model from:', modelUrl);
            
            const layerId = 'model-layer-' + Date.now();
            
            try {
                // Mapbox custom layer olarak ekle (ana projedeki gibi)
                const modelAsMercator = window.mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
                const metersInMercator = modelAsMercator.meterInMercatorCoordinateUnits();
                
                const map = window.threeJsState.map;
                
                // Model entity'yi saklamak için
                let modelEntity = null;
                
                // Custom layer ekle
                map.addLayer({
                    id: layerId,
                    type: 'custom',
                    renderingMode: '3d',
                    onAdd: async function(mapRef, gl) {
                        console.log('[Model] Custom layer onAdd called, loading Three.js deps...');
                        const { THREE, GLTFLoader } = await loadThreeJsDeps();
                        console.log('[Model] Three.js deps loaded:', {
                            hasTHREE: !!THREE,
                            hasGLTFLoader: !!GLTFLoader
                        });
                        
                        // THREE'yi sakla (render'da kullanmak için)
                        this._THREE = THREE;
                        
                        this.camera = new THREE.Camera();
                        this.scene = new THREE.Scene();
                        
                        // Lights
                        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
                        this.scene.add(ambientLight);
                        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
                        dirLight.position.set(50, 100, 50);
                        this.scene.add(dirLight);
                        
                        this.map = mapRef;
                        this.renderer = new THREE.WebGLRenderer({
                            canvas: mapRef.getCanvas(),
                            context: gl,
                            antialias: true
                        });
                        this.renderer.autoClear = false;
                        
                        // Model pozisyon ve transform bilgilerini sakla
                        this._modelPosition = { lng: lng, lat: lat };
                        this._modelScale = scale;
                        this._modelRotation = rotationDeg;
                        this._modelAsMercator = modelAsMercator;
                        this._metersInMercator = metersInMercator;
                        
                        const loader = new GLTFLoader();
                        // Texture ve resource path'lerini doğru çözmek için base path ayarla
                        // Ana projedeki gibi: URL'yi basePath ve fileName olarak ayır
                        const lastSlashIdx = modelUrl.lastIndexOf('/');
                        const basePath = lastSlashIdx >= 0 ? modelUrl.substring(0, lastSlashIdx + 1) : '';
                        const fileName = lastSlashIdx >= 0 ? modelUrl.substring(lastSlashIdx + 1) : modelUrl;
                        loader.setPath(basePath);
                        
                        console.log('[Model] GLTFLoader basePath:', basePath);
                        console.log('[Model] GLTFLoader fileName:', fileName);
                        
                        loader.load(
                            fileName,
                            (gltf) => {
                                const model = gltf.scene;
                                
                                // Transform
                                const transform = {
                                    translateX: modelAsMercator.x,
                                    translateY: modelAsMercator.y,
                                    translateZ: modelAsMercator.z,
                                    rotateX: Math.PI / 2,
                                    rotateY: 0,
                                    rotateZ: THREE.MathUtils.degToRad(rotationDeg),
                                    scale: metersInMercator * scale
                                };
                                
                                // Model transform uygula
                                model.position.set(transform.translateX, transform.translateY, transform.translateZ);
                                model.rotation.set(transform.rotateX, transform.rotateY, transform.rotateZ);
                                model.scale.set(transform.scale, transform.scale, transform.scale);
                                
                                // Model entity'yi sakla (seçim ve hareket için)
                                modelEntity = model;
                                window.threeJsState.modelEntities[layerId] = {
                                    model: model,
                                    layerId: layerId,
                                    position: { lng: lng, lat: lat },
                                    scale: scale,
                                    rotation: rotationDeg,
                                    mercator: modelAsMercator,
                                    metersInMercator: metersInMercator,
                                    type: window.threeJsState.selectedType // Model tipini sakla
                                };
                                
                                this.scene.add(model);
                                this._modelLoaded = true;
                                
                                console.log('[Model] Model loaded successfully:', layerId);
                            },
                            undefined,
                            (err) => {
                                console.error('[Mapbox] Model load error:', err);
                                console.error('[Mapbox] Model URL was:', modelUrl);
                                window.sendToReactNative('error', { 
                                    message: 'Model yüklenemedi: ' + (err.message || 'Bilinmeyen hata') + ' (URL: ' + modelUrl + ')',
                                    type: 'model_load_error'
                                });
                                
                                // Button'ı reset et
                                if (addBtn) {
                                    addBtn.disabled = false;
                                    addBtn.textContent = '➕ Model Ekle';
                                }
                            }
                        );
                    },
                    render: async function(gl, matrix) {
                        if (!this.renderer || !this.scene || !this.camera || !this._modelLoaded) return;
                        
                        // THREE'yi yükle (eğer yüklenmediyse)
                        if (!this._THREE) {
                            const deps = await loadThreeJsDeps();
                            this._THREE = deps.THREE;
                        }
                        
                        const THREE = this._THREE;
                        const m = new THREE.Matrix4().fromArray(matrix);
                        const l = new THREE.Matrix4()
                            .makeTranslation(-this.map.transform.pixelRatio * 6378137.0, 0, 0)
                            .scale(new THREE.Vector3(1, -1, 1));
                        
                        this.camera.projectionMatrix = m.multiply(l);
                        this.renderer.resetState();
                        this.renderer.render(this.scene, this.camera);
                    }
                });
                
                window.threeJsState.modelLayers.push(layerId);
                
                // Model seçimi için invisible marker ekle (click detection)
                const markerId = layerId + '-marker';
                map.addSource(markerId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [lng, lat]
                        },
                        properties: {
                            modelLayerId: layerId
                        }
                    }
                });
                
                map.addLayer({
                    id: markerId,
                    type: 'circle',
                    source: markerId,
                    paint: {
                        'circle-radius': 20, // Click detection için yeterince büyük
                        'circle-opacity': 0, // Görünmez
                        'circle-stroke-width': 0
                    }
                });
                
                // Button'ı reset et
                if (addBtn) {
                    addBtn.disabled = false;
                    addBtn.textContent = '➕ Model Ekle';
                }
                
                // Dropdown'ı reset et
                const dropdown = document.getElementById('model-select-dropdown');
                if (dropdown) dropdown.value = '';
                window.threeJsState.selectedModel = null;
                window.threeJsState.selectedType = null;
                window.threeJsState.selectedFile = null;
                
                window.sendToReactNative('model-added', { 
                    count: window.threeJsState.modelLayers.length,
                    lng: lng,
                    lat: lat
                });
                
            } catch (e) {
                console.error('[Mapbox] Model add error:', e);
                console.error('[Mapbox] Model URL was:', modelUrl);
                if (addBtn) {
                    addBtn.disabled = false;
                    addBtn.textContent = '➕ Model Ekle';
                }
                window.sendToReactNative('error', { 
                    message: 'Model eklenemedi: ' + e.message + ' (URL: ' + modelUrl + ')',
                    type: 'model_add_error'
                });
            }
        }
        
        // Three.js dependencies loader
        async function loadThreeJsDeps() {
            console.log('[Three.js] 🔄 loadThreeJsDeps() başladı');
            
            if (window._threeJsDepsLoaded) {
                console.log('[Three.js] ✅ Dependencies already loaded, returning cached');
                return window._threeJsDepsLoaded;
            }
            
            // THREE'nin yüklenmesini bekle
            if (!window.THREE) {
                console.log('[Three.js] ⏳ THREE not available, waiting...');
                await new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 100; // 10 saniye
                    const checkInterval = setInterval(() => {
                        attempts++;
                        if (window.THREE) {
                            clearInterval(checkInterval);
                            console.log(\`[Three.js] ✅ THREE available after \${attempts * 100}ms\`);
                            resolve(null);
                        } else if (attempts >= maxAttempts) {
                            clearInterval(checkInterval);
                            reject(new Error('THREE not available after 10s timeout'));
                        }
                    }, 100);
                });
            }
            
            // GLTFLoader'ı dinamik olarak yükle (eğer yüklenmediyse)
            if (!window.GLTFLoader) {
                console.log('[Three.js] ⏳ GLTFLoader not available, loading dynamically...');
                try {
                    // Dynamic import kullan - importmap sayesinde "three/addons/" specifier çalışacak
                    const GLTFLoaderModule = await import('three/addons/loaders/GLTFLoader.js');
                    window.GLTFLoader = GLTFLoaderModule.GLTFLoader;
                    console.log('[Three.js] ✅ GLTFLoader loaded via dynamic import (importmap)');
                } catch (e) {
                    console.error('[Three.js] ❌ Failed to load GLTFLoader via dynamic import:', e);
                    // Fallback: Tam URL ile dene
                    console.log('[Three.js] ⚠️ Trying fallback URL method...');
                    try {
                        const GLTFLoaderModule = await import('https://unpkg.com/three@${THREE_VERSION}/examples/jsm/loaders/GLTFLoader.js');
                        window.GLTFLoader = GLTFLoaderModule.GLTFLoader;
                        console.log('[Three.js] ✅ GLTFLoader loaded via fallback URL');
                    } catch (e2) {
                        console.error('[Three.js] ❌ Fallback URL also failed:', e2);
                        // jsdelivr fallback
                        console.log('[Three.js] ⚠️ Trying jsdelivr CDN...');
                        try {
                            const GLTFLoaderModule = await import('https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/loaders/GLTFLoader.js');
                            window.GLTFLoader = GLTFLoaderModule.GLTFLoader;
                            console.log('[Three.js] ✅ GLTFLoader loaded via jsdelivr CDN');
                        } catch (e3) {
                            console.error('[Three.js] ❌ All GLTFLoader loading methods failed');
                            throw new Error('GLTFLoader yüklenemedi. Tüm CDN kaynakları başarısız oldu: ' + e3.message);
                        }
                    }
                }
            }
            
            if (!window.THREE || !window.GLTFLoader) {
                const errorMsg = '[Three.js] ❌ THREE or GLTFLoader not available after loading';
                console.error(errorMsg);
                throw new Error('THREE or GLTFLoader not available after loading');
            }
            
            const deps = {
                THREE: window.THREE,
                GLTFLoader: window.GLTFLoader
            };
            
            window._threeJsDepsLoaded = deps;
            console.log('[Three.js] ✅ Dependencies loaded and cached');
            return deps;
        }
        
        // Initialize Three.js (Mapbox custom layer'lar için - canvas gereksiz artık)
        // Bu fonksiyon arka planda çalışır, loading'i kapatmaz
        async function initThreeJs() {
            console.log('[Three.js] 🚀 initThreeJs() başladı (background)');
            
            try {
                console.log('[Three.js] Initializing for Mapbox custom layers (background)...');
                
                const initialCheck = {
                    moduleLoaded: !!window._threeJsModuleLoaded,
                    THREE: !!window.THREE,
                    GLTFLoader: !!window.GLTFLoader
                };
                console.log('[Three.js] Module loaded check:', initialCheck);
                
                // Module script zaten yüklenmiş olabilir, kontrol et
                if (window._threeJsModuleLoaded && window.THREE && window.GLTFLoader) {
                    console.log('[Three.js] ✅ Module already loaded, skipping wait');
                } else {
                    // Module script'in yüklendiğini bekle
                    console.log('[Three.js] ⏳ Waiting for module script to load...');
                    
                    await new Promise((resolve) => {
                        let attempts = 0;
                        const maxAttempts = 100; // 10 saniye
                        const checkInterval = setInterval(() => {
                            attempts++;
                            if (window._threeJsModuleLoaded && window.THREE && window.GLTFLoader) {
                                clearInterval(checkInterval);
                                const msg = \`[Three.js] ✅ Module script loaded successfully after \${attempts * 100}ms\`;
                                console.log(msg);
                                resolve(null);
                            } else if (attempts >= maxAttempts) {
                                clearInterval(checkInterval);
                                // Timeout oldu ama hata fırlatma, sadece log
                                const missing = [];
                                if (!window._threeJsModuleLoaded) missing.push('module script');
                                if (!window.THREE) missing.push('THREE');
                                if (!window.GLTFLoader) missing.push('GLTFLoader');
                                const warnMsg = \`[Three.js] ⚠️ Module script loading timeout after 10s. Missing: \${missing.join(', ')}\`;
                                console.warn(warnMsg);
                                console.warn('[Three.js] Will retry when model is added');
                                resolve(null); // Hata fırlatma, model eklerken tekrar denenecek
                            } else if (attempts % 10 === 0) {
                                // Her 1 saniyede bir durum logla
                                const status = {
                                    moduleLoaded: !!window._threeJsModuleLoaded,
                                    THREE: !!window.THREE,
                                    GLTFLoader: !!window.GLTFLoader,
                                    attempts: attempts,
                                    elapsed: attempts * 100 + 'ms'
                                };
                                console.log('[Three.js] ⏳ Still waiting for module... (attempt ' + attempts + '/100)', status);
                            } else if (attempts % 2 === 0) {
                                // Her 200ms'de bir kısa log
                                const status = {
                                    moduleLoaded: !!window._threeJsModuleLoaded,
                                    THREE: !!window.THREE,
                                    GLTFLoader: !!window.GLTFLoader,
                                    attempts: attempts,
                                    elapsed: attempts * 100 + 'ms'
                                };
                                console.log('[Three.js] Waiting for module...', JSON.stringify(status));
                            }
                        }, 100);
                    });
                }
                
                // THREE ve GLTFLoader kontrolü
                if (!window.THREE || !window.GLTFLoader) {
                    console.warn('[Three.js] ⚠️ THREE or GLTFLoader still not available after wait');
                    console.warn('[Three.js] Will retry when model is added');
                    return; // Hata fırlatma, model eklerken tekrar denenecek
                }
                
                // Dependencies'i test et
                console.log('[Three.js] 🔄 Testing dependencies with loadThreeJsDeps()...');
                
                try {
                    const deps = await loadThreeJsDeps();
                    const successInfo = {
                        hasTHREE: !!deps.THREE,
                        hasGLTFLoader: !!deps.GLTFLoader,
                        THREEVersion: deps.THREE?.REVISION || 'unknown'
                    };
                    console.log('[Three.js] ✅ Dependencies loaded successfully:', successInfo);
                } catch (depsError) {
                    const errorMsg = \`[Three.js] ⚠️ Dependencies loading failed: \${depsError.message || depsError}\`;
                    console.warn(errorMsg);
                    console.warn('[Three.js] Will retry when model is added');
                    return; // Hata fırlatma
                }
                
                // Three.js artık Mapbox custom layer'lar içinde kullanılıyor
                // Canvas'a gerek yok, Mapbox canvas kullanılıyor
                
                // State'i kaydet (minimal)
                window.threeJsState.scene = null; // Mapbox custom layer'lar kendi scene'lerini kullanır
                window.threeJsState.camera = null;
                window.threeJsState.renderer = null;
                window.threeJsState.controls = null;
                
                console.log('[Three.js] ✅ Initialized successfully for Mapbox custom layers');
                console.log('[Three.js] Ready for model loading');
                
            } catch (e) {
                // Hataları logla ama fırlatma (arka plan işlemi)
                const errorMsg = \`[Three.js] ❌ Background initialization error (non-critical): \${e.message || e}\`;
                console.error(errorMsg);
                console.warn('[Three.js] Will retry when model is added');
            }
        }
        
        // Model listesini yükle
        async function loadModelsList() {
            const dropdown = document.getElementById('model-select-dropdown');
            if (!dropdown) return;
            
            try {
                dropdown.innerHTML = '<option value="">Modeller yükleniyor...</option>';
                
                // Backend URL kontrolü - FastAPI portu (8001) kullan
                const backendUrl = window.BACKEND_URL || 'http://127.0.0.1:8001';
                const apiUrl = backendUrl + '/api/3d-models-list/';
                
                console.log('[Model] Loading models from:', apiUrl);
                console.log('[Model] Backend URL:', window.BACKEND_URL);
                
                // Timeout ile fetch (10 saniye)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                let response;
                try {
                    response = await fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        mode: 'cors', // CORS desteği
                        signal: controller.signal
                    });
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    if (fetchError.name === 'AbortError') {
                        throw new Error('İstek zaman aşımına uğradı (10 saniye). Backend sunucusunun çalıştığından emin olun.');
                    } else if (fetchError.message && fetchError.message.includes('Failed to fetch')) {
                        throw new Error('Backend sunucusuna bağlanılamadı. Lütfen backend sunucusunun çalıştığından ve URL\'in doğru olduğundan emin olun. (URL: ' + apiUrl + ')');
                    } else {
                        throw fetchError;
                    }
                }
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    throw new Error('API error: ' + response.status + ' - ' + response.statusText + ' (URL: ' + apiUrl + ')');
                }
                
                const data = await response.json();
                
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid API response format');
                }
                
                let html = '<option value="">-- Model Seçin --</option>';
                
                const categories = {
                    house: { label: '🏠 Ev Modelleri', models: data.house || [] },
                    car: { label: '🚗 Araç Modelleri', models: data.car || [] },
                    tree: { label: '🌳 Ağaç Modelleri', models: data.tree || [] }
                };
                
                Object.entries(categories).forEach(([type, category]) => {
                    if (category.models.length > 0) {
                        html += '<optgroup label="' + category.label + '">';
                        category.models.forEach(model => {
                            html += '<option value="' + type + ':' + model.file + '">' + model.name + '</option>';
                        });
                        html += '</optgroup>';
                    }
                });
                
                dropdown.innerHTML = html;
                
                const totalCount = Object.values(data).flat().length;
                console.log('[Model] Models loaded:', totalCount);
                window.sendToReactNative('models-loaded', { count: totalCount });
                
            } catch (e) {
                // Model listesi yükleme hatası kritik değil - sadece log yaz, error mesajı gönderme
                // (threejs-ready mesajı zaten gönderildi, loading ekranı kapatıldı)
                console.error('[Three.js] Model list load error (non-critical):', e);
                const backendUrlFinal = window.BACKEND_URL || 'http://127.0.0.1:8001';
                console.error('[Three.js] Backend URL:', window.BACKEND_URL);
                console.error('[Three.js] API URL:', backendUrlFinal + '/api/3d-models-list/');
                
                // Dropdown'da hata mesajı göster ama error mesajı gönderme
                dropdown.innerHTML = '<option value="">Model listesi yüklenemedi (isteğe bağlı)</option>';
                
                // Error mesajı gönderme - bu kritik değil ve loading ekranını kapatmamalı
                // window.sendToReactNative('error', { ... }) kaldırıldı
            }
        }
        
        // Model seçimi handler
        document.getElementById('model-select-dropdown').addEventListener('change', function(e) {
            const value = e.target.value;
            if (value) {
                const [type, file] = value.split(':');
                window.threeJsState.selectedModel = value;
                window.threeJsState.selectedType = type;
                window.threeJsState.selectedFile = file;
                
                // Slider'ları aktif et
                const rotationSlider = document.getElementById('model-rotation');
                const scaleSlider = document.getElementById('model-scale');
                const scaleControl = document.getElementById('scale-control-group');
                
                if (type === 'house') {
                    if (scaleControl) scaleControl.style.display = 'block';
                    if (scaleSlider) scaleSlider.disabled = false;
                } else {
                    if (scaleControl) scaleControl.style.display = 'none';
                    if (scaleSlider) scaleSlider.disabled = false;
                    if (scaleSlider) scaleSlider.value = '1.0';
                }
                if (rotationSlider) rotationSlider.disabled = false;
                
                window.sendToReactNative('model-selected', { value: value, type: type, file: file });
            } else {
                window.threeJsState.selectedModel = null;
                window.threeJsState.selectedType = null;
                window.threeJsState.selectedFile = null;
                
                const rotationSlider = document.getElementById('model-rotation');
                const scaleSlider = document.getElementById('model-scale');
                const scaleControl = document.getElementById('scale-control-group');
                if (rotationSlider) rotationSlider.disabled = true;
                if (scaleSlider) scaleSlider.disabled = true;
                if (scaleControl) scaleControl.style.display = 'none';
            }
        });
        
        // Scale slider (model seçiliyse güncelle, değilse sadece UI güncelle)
        const scaleSlider = document.getElementById('model-scale');
        if (scaleSlider) {
            scaleSlider.addEventListener('input', function(e) {
                const value = parseFloat(e.target.value);
                const scaleValueEl = document.getElementById('scale-value');
                
                // Seçili model varsa güncelle
                if (window.threeJsState.selectedModelLayer) {
                    updateModelScale(window.threeJsState.selectedModelLayer, value);
                }
                
                // UI güncelle (house için alan göster)
                if (scaleValueEl && window.threeJsState.selectedType === 'house') {
                    const baseArea = 500;
                    const currentArea = Math.round(baseArea * value * value);
                    scaleValueEl.textContent = currentArea + ' m²';
                }
            });
        }
        
        // Rotation slider (model seçiliyse güncelle, değilse sadece UI güncelle)
        const rotationSlider = document.getElementById('model-rotation');
        if (rotationSlider) {
            rotationSlider.addEventListener('input', function(e) {
                const value = parseFloat(e.target.value);
                const rotationValueEl = document.getElementById('rotation-value');
                
                // Seçili model varsa güncelle
                if (window.threeJsState.selectedModelLayer) {
                    updateModelRotation(window.threeJsState.selectedModelLayer, value);
                }
                
                // UI güncelle
                if (rotationValueEl) {
                    rotationValueEl.textContent = Math.round(value) + '°';
                }
            });
        }
        
        // Add model button - Haritaya tıklama modunu aktif et
        function setupModelClickHandler() {
            if (!window.threeJsState.map || !window.threeJsState.selectedModel) return;
            
            // Harita zaten tıklama modunda (handleMapClick ile)
            const addBtn = document.getElementById('add-model-btn');
            if (addBtn) {
                addBtn.textContent = 'Haritaya tıklayın...';
                addBtn.disabled = true;
            }
        }
        
        // Eski Three.js scene model ekleme (kullanılmıyor, Mapbox custom layer kullanıyoruz)
        async function addModelToScene(position) {
            if (!window.threeJsState.scene || !window.threeJsState.selectedFile) return;
            
            const addBtn = document.getElementById('add-model-btn');
            if (addBtn) {
                addBtn.disabled = true;
                addBtn.textContent = 'Ekleniyor...';
            }
            
            const scaleSlider = document.getElementById('model-scale');
            const rotationSlider = document.getElementById('model-rotation');
            const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;
            const rotationDeg = rotationSlider ? parseFloat(rotationSlider.value) : 0;
            
            const modelUrl = window.STATIC_URL + '/models/' + window.threeJsState.selectedType + '/' + window.threeJsState.selectedFile;
            
            try {
                const loader = new GLTFLoader();
                // Texture ve resource path'lerini doğru çözmek için base path ayarla
                const lastSlashIdx = modelUrl.lastIndexOf('/');
                const basePath = lastSlashIdx >= 0 ? modelUrl.substring(0, lastSlashIdx + 1) : '';
                const fileName = lastSlashIdx >= 0 ? modelUrl.substring(lastSlashIdx + 1) : modelUrl;
                loader.setPath(basePath);
                
                loader.load(
                    fileName,
                    function(gltf) {
                        const model = gltf.scene;
                        model.position.copy(position);
                        model.scale.set(scale, scale, scale);
                        model.rotation.y = THREE.MathUtils.degToRad(rotationDeg);
                        
                        // Shadow
                        model.traverse(function(child) {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });
                        
                        window.threeJsState.scene.add(model);
                        window.threeJsState.models.push(model);
                        
                        // Button'ı reset et
                        if (addBtn) {
                            addBtn.disabled = false;
                            addBtn.textContent = '➕ Model Ekle';
                        }
                        
                        // Dropdown'ı reset et
                        const dropdown = document.getElementById('model-select-dropdown');
                        if (dropdown) dropdown.value = '';
                        window.threeJsState.selectedModel = null;
                        window.threeJsState.selectedType = null;
                        window.threeJsState.selectedFile = null;
                        
                        window.sendToReactNative('model-added', { count: window.threeJsState.models.length });
                    },
                    undefined,
                    function(error) {
                        console.error('[Three.js] Model load error:', error);
                        if (addBtn) {
                            addBtn.disabled = false;
                            addBtn.textContent = '➕ Model Ekle';
                        }
                        window.sendToReactNative('error', { message: 'Model yüklenemedi: ' + error.message });
                    }
                );
                
            } catch (e) {
                console.error('[Three.js] Model add error:', e);
                if (addBtn) {
                    addBtn.disabled = false;
                    addBtn.textContent = '➕ Model Ekle';
                }
                window.sendToReactNative('error', { message: 'Model eklenemedi: ' + e.message });
            }
        }
        
        // Add model button
        document.getElementById('add-model-btn').addEventListener('click', function() {
            // Canvas'a tıklama handler'ı kur (ilk tıklamada model ekle)
            if (window.threeJsState.selectedModel) {
                setupModelClickHandler();
                this.textContent = 'Haritaya tıklayın...';
                this.disabled = true;
            }
        });
        
        // Clear models button
        document.getElementById('clear-models-btn').addEventListener('click', function() {
            const map = window.threeJsState.map;
            
            // Mapbox custom layer'ları temizle
            if (map && window.threeJsState.modelLayers.length > 0) {
                window.threeJsState.modelLayers.forEach(layerId => {
                    try {
                        // Model layer'ını kaldır
                        if (map.getLayer(layerId)) {
                            map.removeLayer(layerId);
                        }
                        
                        // Marker layer'ını kaldır
                        const markerId = layerId + '-marker';
                        if (map.getLayer(markerId)) {
                            map.removeLayer(markerId);
                        }
                        if (map.getSource(markerId)) {
                            map.removeSource(markerId);
                        }
                    } catch (e) {
                        console.warn('[Mapbox] Layer remove error:', e);
                    }
                });
                window.threeJsState.modelLayers = [];
            }
            
            // Model entities'i temizle
            window.threeJsState.modelEntities = {};
            window.threeJsState.selectedModelLayer = null;
            window.threeJsState.selectedModelEntity = null;
            
            // Three.js scene'deki modelleri temizle
            if (window.threeJsState.scene) {
                window.threeJsState.models.forEach(model => {
                    window.threeJsState.scene.remove(model);
                });
                window.threeJsState.models = [];
            }
            
            // Slider'ları disable et
            deselectModel();
            
            window.sendToReactNative('models-cleared', {});
        });
        
        // Close button
        document.getElementById('close-btn').addEventListener('click', function() {
            window.sendToReactNative('close-requested', {});
        });
        
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                const targetContent = document.getElementById('tab-content-' + targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');
                    
                    // Şekil sekmesi açıldığında listeyi güncelle
                    if (targetTab === 'shape') {
                        updateShapeList();
                    }
                }
            });
        });
        
        // Sağ menüyü kapat
        function closeSubmenu() {
            const submenu = document.getElementById('map-controls-right');
            if (submenu) {
                submenu.style.display = 'none';
            }
            
            // Ölçüm modu kontrolü
            const isMeasurementModeActive = window.threeJsState.drawingMode === 'measure-distance' || 
                                            window.threeJsState.drawingMode === 'measure-area';
            
            // Tüm menü butonlarını kontrol et
            document.querySelectorAll('.main-tool-btn').forEach(btn => {
                if (btn.id === 'measurement-menu-btn') {
                    // Ölçüm menü butonu: sadece ölçüm modu aktifse aktif kal
                    if (isMeasurementModeActive) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                } else {
                    // Diğer menü butonları: pasif yap
                    btn.classList.remove('active');
                }
            });
        }
        
        // Sağ menüyü aç ve içeriği doldur
        function openSubmenu(title, content) {
            const submenu = document.getElementById('map-controls-right');
            const submenuTitle = document.getElementById('submenu-title');
            const submenuContent = document.getElementById('submenu-content');
            
            if (submenu && submenuTitle && submenuContent) {
                submenuTitle.textContent = title;
                submenuContent.innerHTML = content;
                submenu.style.display = 'block';
            }
        }
        
        // Submenu close butonu
        document.getElementById('submenu-close').addEventListener('click', function() {
            closeSubmenu();
        });
        
        // Menü dışına tıklanınca kapat
        document.addEventListener('click', function(e) {
            const submenu = document.getElementById('map-controls-right');
            const leftControls = document.querySelector('.map-controls-left');
            if (submenu && leftControls && 
                !submenu.contains(e.target) && 
                !leftControls.contains(e.target)) {
                closeSubmenu();
            }
        });
        
        // Parsel Seç butonu
        document.getElementById('select-parcel-btn').addEventListener('click', function() {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const isActive = this.classList.contains('active');
            
            if (isActive) {
                // Pasif yap
                window.threeJsState.drawingMode = null;
                this.classList.remove('active');
                map.getCanvas().style.cursor = '';
            } else {
                // Aktif yap
                window.threeJsState.drawingMode = 'parcel-selection';
                window.threeJsState.drawingStartPos = null;
                
                // Buton aktif durumu
                document.querySelectorAll('.main-tool-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
                
                // Cursor değiştir
                map.getCanvas().style.cursor = 'crosshair';
            }
            
            // Menüyü kapat (parsel seç direkt çalışır)
            closeSubmenu();
        });
        
        // Ölçüm menü butonu
        document.getElementById('measurement-menu-btn').addEventListener('click', function() {
            const submenu = document.getElementById('map-controls-right');
            const isSubmenuOpen = submenu && submenu.style.display === 'block';
            const isMeasurementModeActive = window.threeJsState.drawingMode === 'measure-distance' || 
                                            window.threeJsState.drawingMode === 'measure-area';
            
            if (isSubmenuOpen && !isMeasurementModeActive) {
                // Menü açık ama ölçüm modu aktif değil - menüyü kapat ve butonu pasif yap
                closeSubmenu();
                this.classList.remove('active');
            } else {
                // Menüyü aç veya güncelle
                document.querySelectorAll('.main-tool-btn').forEach(btn => {
                    if (btn.id !== 'measurement-menu-btn') {
                        btn.classList.remove('active');
                    }
                });
                
                // Ölçüm modu aktifse butonu aktif tut, değilse toggle yap
                if (isMeasurementModeActive) {
                    this.classList.add('active');
                } else {
                    // Toggle: eğer zaten aktifse kapat, değilse aç
                    if (this.classList.contains('active')) {
                        this.classList.remove('active');
                        closeSubmenu();
                        return;
                    } else {
                        this.classList.add('active');
                    }
                }
                
                // Aktif durum kontrolü
                const isDistanceActive = window.threeJsState.drawingMode === 'measure-distance';
                const isAreaActive = window.threeJsState.drawingMode === 'measure-area';
                
                const content = \`
                    <button id="measure-distance-btn" class="control-btn \${isDistanceActive ? 'active' : ''}" title="Mesafe Ölç">
                        📏 Mesafe Ölç
                    </button>
                    <button id="measure-area-btn" class="control-btn \${isAreaActive ? 'active' : ''}" title="Alan Ölç">
                        📐 Alan Ölç
                    </button>
                    <button id="clear-measurements-btn" class="control-btn" title="Ölçümleri Temizle">
                        🗑️ Ölçümleri Temizle
                    </button>
                \`;
                
                openSubmenu('Ölçüm Araçları', content);
                
                // Yeni eklenen butonlar için event listener'lar
                setTimeout(() => {
                    const map = window.threeJsState.map;
                    if (!map) return;
                    
                    // Mesafe ölçüm butonu (toggle mantığı)
                    const measureDistanceBtn = document.getElementById('measure-distance-btn');
                    if (measureDistanceBtn) {
                        measureDistanceBtn.addEventListener('click', function() {
                            const isActive = window.threeJsState.drawingMode === 'measure-distance';
                            
                            if (isActive) {
                                // Pasif yap
                                window.threeJsState.drawingMode = null;
                                window.threeJsState.rulerPoints = [];
                                this.classList.remove('active');
                                map.getCanvas().style.cursor = '';
                                
                                // Ana ölçüm menü butonunu da pasif yap
                                const measurementMenuBtn = document.getElementById('measurement-menu-btn');
                                if (measurementMenuBtn) {
                                    measurementMenuBtn.classList.remove('active');
                                }
                            } else {
                                // Aktif yap
                                window.threeJsState.drawingMode = 'measure-distance';
                                window.threeJsState.rulerPoints = [];
                                window.threeJsState.measurementFeatures = [];
                                
                                // Diğer ölçüm butonlarını pasif yap
                                const measureAreaBtn = document.getElementById('measure-area-btn');
                                if (measureAreaBtn) measureAreaBtn.classList.remove('active');
                                
                                this.classList.add('active');
                                map.getCanvas().style.cursor = 'crosshair';
                                
                                // Ana ölçüm menü butonunu aktif tut
                                const measurementMenuBtn = document.getElementById('measurement-menu-btn');
                                if (measurementMenuBtn) {
                                    measurementMenuBtn.classList.add('active');
                                }
                            }
                            
                            closeSubmenu();
                        });
                    }
                    
                    // Alan ölçüm butonu (toggle mantığı)
                    const measureAreaBtn = document.getElementById('measure-area-btn');
                    if (measureAreaBtn) {
                        measureAreaBtn.addEventListener('click', function() {
                            const isActive = window.threeJsState.drawingMode === 'measure-area';
                            
                            if (isActive) {
                                // Pasif yap
                                window.threeJsState.drawingMode = null;
                                window.threeJsState.areaPoints = [];
                                window.threeJsState.areaPreviewLayer = null;
                                this.classList.remove('active');
                                map.getCanvas().style.cursor = '';
                                
                                // Tamamla butonunu gizle
                                const finishBtn = document.getElementById('area-finish-btn');
                                if (finishBtn) {
                                    finishBtn.style.display = 'none';
                                }
                                
                                // Ana ölçüm menü butonunu da pasif yap
                                const measurementMenuBtn = document.getElementById('measurement-menu-btn');
                                if (measurementMenuBtn) {
                                    measurementMenuBtn.classList.remove('active');
                                }
                            } else {
                                // Aktif yap
                                window.threeJsState.drawingMode = 'measure-area';
                                window.threeJsState.areaPoints = [];
                                window.threeJsState.areaPreviewLayer = null;
                                window.threeJsState.measurementFeatures = [];
                                
                                // Diğer ölçüm butonlarını pasif yap
                                const measureDistanceBtn = document.getElementById('measure-distance-btn');
                                if (measureDistanceBtn) measureDistanceBtn.classList.remove('active');
                                
                                this.classList.add('active');
                                map.getCanvas().style.cursor = 'crosshair';
                                
                                // Tamamla butonunu gizle (henüz nokta yok)
                                const finishBtn = document.getElementById('area-finish-btn');
                                if (finishBtn) {
                                    finishBtn.style.display = 'none';
                                }
                                
                                // Ana ölçüm menü butonunu aktif tut
                                const measurementMenuBtn = document.getElementById('measurement-menu-btn');
                                if (measurementMenuBtn) {
                                    measurementMenuBtn.classList.add('active');
                                }
                            }
                            
                            closeSubmenu();
                        });
                    }
                    
                    // Alan ölçümü tamamla butonu (zaten setupAreaFinishButton'da ekleniyor, burada tekrar ekleme)
                    setupAreaFinishButton();
                    
                    // Ölçümleri temizle butonu
                    const clearMeasurementsBtn = document.getElementById('clear-measurements-btn');
                    if (clearMeasurementsBtn) {
                        clearMeasurementsBtn.addEventListener('click', function() {
                            // Ölçüm layer'larını temizle
                            if (window.threeJsState.measurementLayers) {
                                window.threeJsState.measurementLayers.forEach(layerId => {
                                    try {
                                        if (map.getLayer(layerId)) {
                                            map.removeLayer(layerId);
                                        }
                                        if (map.getSource(layerId)) {
                                            map.removeSource(layerId);
                                        }
                                    } catch (e) {
                                        console.warn('[Measurement] Layer remove error:', e);
                                    }
                                });
                                window.threeJsState.measurementLayers = [];
                            }
                            window.threeJsState.drawingMode = null;
                            window.threeJsState.drawingPoints = [];
                            window.threeJsState.measurementFeatures = [];
                            map.getCanvas().style.cursor = '';
                            closeSubmenu();
                        });
                    }
                }, 10);
            }
        });
        
        // Şekil menü butonu
        document.getElementById('shape-menu-btn').addEventListener('click', function() {
            const isActive = this.classList.contains('active');
            
            if (isActive) {
                closeSubmenu();
            } else {
                document.querySelectorAll('.main-tool-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                const content = \`
                    <div class="shape-toolbar">
                        <button id="shape-rectangle-btn" class="control-btn shape-btn" data-shape="rectangle" title="Kare/Dikdörtgen (R)">
                            ⬜ Kare
                        </button>
                        <button id="shape-triangle-btn" class="control-btn shape-btn" data-shape="triangle" title="Üçgen (T)">
                            🔺 Üçgen
                        </button>
                        <button id="shape-circle-btn" class="control-btn shape-btn" data-shape="circle" title="Yuvarlak (C)">
                            ⭕ Yuvarlak
                        </button>
                        <button id="shape-ellipse-btn" class="control-btn shape-btn" data-shape="ellipse" title="Elips (E)">
                            🔵 Elips
                        </button>
                        <button id="shape-polygon-btn" class="control-btn shape-btn" data-shape="polygon" title="Çokgen (P)">
                            🔷 Çokgen
                        </button>
                        <button id="shape-line-btn" class="control-btn shape-btn" data-shape="line" title="Çizgi (L)">
                            ➖ Çizgi
                        </button>
                        <button id="shape-arrow-btn" class="control-btn shape-btn" data-shape="arrow" title="Ok (A)">
                            ➡️ Ok
                        </button>
                        <button id="shape-marker-btn" class="control-btn shape-btn" data-shape="marker" title="Nokta (M)">
                            📍 Nokta
                        </button>
                        <button id="shape-textbox-btn" class="control-btn shape-btn" data-shape="textbox" title="Metin Kutusu (X)">
                            📝 Metin
                        </button>
                        <div style="height: 20px;"></div>
                        <div style="height: 20px;"></div>
                        <div style="height: 20px;"></div>
                        <div style="height: 20px;"></div>
                    </div>
                \`;
                
                openSubmenu('Şekil Çizim Araçları', content);
                
                // Yeni eklenen shape butonları için event listener'lar
                setTimeout(() => {
                    document.querySelectorAll('.shape-btn').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const map = window.threeJsState.map;
                            if (!map) return;
                            
                            const shapeType = this.getAttribute('data-shape');
                            window.threeJsState.drawingMode = shapeType;
                            window.threeJsState.drawingStartPos = null;
                            window.threeJsState.drawingPoints = [];
                            window.threeJsState.ellipseAxes = [];
                            
                            // Buton aktif durumu
                            document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
                            this.classList.add('active');
                            document.getElementById('select-parcel-btn').classList.remove('active');
                            
                            // Cursor değiştir
                            map.getCanvas().style.cursor = 'crosshair';
                            
                            // Menüyü kapat
                            closeSubmenu();
                        });
                    });
                }, 10);
            }
        });
        
        // Parsel seçim handler
        async function handleParcelSelectionClick(lng, lat) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            try {
                // Backend API'ye parsel sorgusu
                const response = await fetch(window.BACKEND_URL + '/api/tkgm_view/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat: lat, lon: lng, map_mode: '2d', is3D: false })
                });
                
                if (!response.ok) {
                    throw new Error('API error: ' + response.status);
                }
                
                const data = await response.json();
                
                if (!data.geometry) {
                    console.warn('[Parcel] No geometry found');
                    return;
                }
                
                // Eski parsel layer'larını temizle
                if (window.threeJsState.parcelSource) {
                    try {
                        if (map.getSource(window.threeJsState.parcelSource)) {
                            window.threeJsState.parcelLayers.forEach(layerId => {
                                if (map.getLayer(layerId)) {
                                    map.removeLayer(layerId);
                                }
                            });
                            map.removeSource(window.threeJsState.parcelSource);
                        }
                    } catch (e) {
                        console.warn('[Parcel] Cleanup error:', e);
                    }
                }
                
                // Yeni parsel source ve layer ekle
                const sourceId = 'parcel-source-' + Date.now();
                const fillLayerId = 'parcel-fill-' + Date.now();
                const lineLayerId = 'parcel-line-' + Date.now();
                
                map.addSource(sourceId, {
                    type: 'geojson',
                    data: data.geometry
                });
                
                map.addLayer({
                    id: fillLayerId,
                    type: 'fill',
                    source: sourceId,
                    paint: {
                        'fill-color': '#3b82f6',
                        'fill-opacity': 0.3
                    }
                });
                
                map.addLayer({
                    id: lineLayerId,
                    type: 'line',
                    source: sourceId,
                    paint: {
                        'line-color': '#2563eb',
                        'line-width': 2
                    }
                });
                
                window.threeJsState.parcelSource = sourceId;
                window.threeJsState.parcelLayers = [fillLayerId, lineLayerId];
                
                // Drawing mode'u reset et
                window.threeJsState.drawingMode = null;
                document.getElementById('select-parcel-btn').classList.remove('active');
                map.getCanvas().style.cursor = '';
                
                // React Native'e mesaj gönder
                window.sendToReactNative('parcel-selected', {
                    geometry: data.geometry,
                    properties: data.properties || {}
                });
                
            } catch (e) {
                console.error('[Parcel] Selection error:', e);
                window.sendToReactNative('error', {
                    message: 'Parsel seçilemedi: ' + e.message,
                    type: 'parcel_selection_error'
                });
            }
        }
        
        // Mesafe ölçüm handler (ana sayfadaki stratejiye göre)
        function handleMeasurementDistanceClick(point) {
            const map = window.threeJsState.map;
            if (!map) return;

            if (!window.threeJsState.rulerPoints) {
                window.threeJsState.rulerPoints = [];
            }

            const coord = [point.lon, point.lat];
            
            if (window.threeJsState.rulerPoints.length === 0) {
                // İlk nokta - temporary marker ekle
                window.threeJsState.rulerPoints = [coord];
                
                const geometry = {
                    type: 'Point',
                    coordinates: coord
                };
                const sourceId = 'measure-ruler-temp-' + Date.now();
                map.addSource(sourceId, { type: 'geojson', data: geometry });
                map.addLayer({
                    id: sourceId,
                    type: 'circle',
                    source: sourceId,
                    paint: {
                        'circle-radius': 6,
                        'circle-color': '#3B82F6',
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 2
                    }
                });
                if (!window.threeJsState.measurementLayers) {
                    window.threeJsState.measurementLayers = [];
                }
                window.threeJsState.measurementLayers.push(sourceId);
            } else {
                // İkinci nokta - ölçümü tamamla
                const point1 = window.threeJsState.rulerPoints[0];
                const point2 = coord;
                
                // Mesafe hesapla
                const distance = calculateShapeDistance(
                    { lon: point1[0], lat: point1[1] },
                    { lon: point2[0], lat: point2[1] }
                );
                const distanceText = formatDistance(distance);
                
                // Feature'ları oluştur ve Mapbox'a ekle
                const timestamp = Date.now();
                
                // Temporary marker'ı kaldır
                const tempLayers = window.threeJsState.measurementLayers.filter(id => id.startsWith('measure-ruler-temp-'));
                tempLayers.forEach(layerId => {
                    try {
                        if (map.getLayer(layerId)) map.removeLayer(layerId);
                        if (map.getSource(layerId)) map.removeSource(layerId);
                        window.threeJsState.measurementLayers = window.threeJsState.measurementLayers.filter(id => id !== layerId);
                    } catch (e) {}
                });
                
                // İlk nokta marker
                const point1Geometry = {
                    type: 'Point',
                    coordinates: point1
                };
                const point1SourceId = 'measure-ruler-point1-' + timestamp;
                map.addSource(point1SourceId, { type: 'geojson', data: point1Geometry });
                map.addLayer({
                    id: point1SourceId,
                    type: 'circle',
                    source: point1SourceId,
                    paint: {
                        'circle-radius': 6,
                        'circle-color': '#3B82F6',
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 2
                    }
                });
                window.threeJsState.measurementLayers.push(point1SourceId);
                
                // İkinci nokta marker
                const point2Geometry = {
                    type: 'Point',
                    coordinates: point2
                };
                const point2SourceId = 'measure-ruler-point2-' + timestamp;
                map.addSource(point2SourceId, { type: 'geojson', data: point2Geometry });
                map.addLayer({
                    id: point2SourceId,
                    type: 'circle',
                    source: point2SourceId,
                    paint: {
                        'circle-radius': 6,
                        'circle-color': '#3B82F6',
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 2
                    }
                });
                window.threeJsState.measurementLayers.push(point2SourceId);
                
                // Çizgi
                const lineGeometry = {
                    type: 'LineString',
                    coordinates: [point1, point2]
                };
                const lineSourceId = 'measure-ruler-line-' + timestamp;
                map.addSource(lineSourceId, { type: 'geojson', data: lineGeometry });
                map.addLayer({
                    id: lineSourceId,
                    type: 'line',
                    source: lineSourceId,
                    paint: {
                        'line-color': '#3B82F6',
                        'line-width': 3
                    }
                });
                window.threeJsState.measurementLayers.push(lineSourceId);
                
                // Label (orta noktada)
                const midPoint = getMidpoint(
                    { lon: point1[0], lat: point1[1] },
                    { lon: point2[0], lat: point2[1] }
                );
                const labelFeature = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [midPoint.lon, midPoint.lat]
                    },
                    properties: {
                        label: distanceText
                    }
                };
                const labelSourceId = 'measure-ruler-label-' + timestamp;
                map.addSource(labelSourceId, { 
                    type: 'geojson', 
                    data: labelFeature
                });
                map.addLayer({
                    id: labelSourceId,
                    type: 'symbol',
                    source: labelSourceId,
                    layout: {
                        'text-field': ['get', 'label'],
                        'text-size': 14,
                        'text-anchor': 'center',
                        'text-allow-overlap': true,
                        'text-ignore-placement': true
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#000000',
                        'text-halo-width': 2
                    }
                }, map.getLayer(lineSourceId) ? lineSourceId : undefined);
                window.threeJsState.measurementLayers.push(labelSourceId);
                
                // Reset rulerPoints (yeni ölçüm yapılabilir)
                window.threeJsState.rulerPoints = [];
                // Mode aktif kalıyor, yeni ölçüm yapılabilir
            }
        }
        
        // Alan ölçüm handler (ana sayfadaki stratejiye göre)
        function handleMeasurementAreaClick(point) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            if (!window.threeJsState.areaPoints) {
                window.threeJsState.areaPoints = [];
            }
            
            const coord = [point.lon, point.lat];
            window.threeJsState.areaPoints.push(coord);
            
            // Her nokta için marker ekle
            const pointGeometry = {
                type: 'Point',
                coordinates: coord
            };
            const pointSourceId = 'measure-area-point-' + Date.now();
            map.addSource(pointSourceId, { type: 'geojson', data: pointGeometry });
            map.addLayer({
                id: pointSourceId,
                type: 'circle',
                source: pointSourceId,
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#FBBF24',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });
            if (!window.threeJsState.measurementLayers) {
                window.threeJsState.measurementLayers = [];
            }
            window.threeJsState.measurementLayers.push(pointSourceId);
            
            // En az 2 nokta varsa dinamik polygon çiz (preview)
            if (window.threeJsState.areaPoints.length >= 2) {
                // Eski preview polygon'u temizle
                if (window.threeJsState.areaPreviewLayer) {
                    try {
                        const previewId = window.threeJsState.areaPreviewLayer;
                        if (map.getLayer(previewId + '-fill')) map.removeLayer(previewId + '-fill');
                        if (map.getLayer(previewId + '-line')) map.removeLayer(previewId + '-line');
                        if (map.getSource(previewId)) map.removeSource(previewId);
                        window.threeJsState.measurementLayers = window.threeJsState.measurementLayers.filter(id => 
                            id !== previewId + '-fill' && id !== previewId + '-line'
                        );
                    } catch (e) {}
                }
                
                const coordinates = [...window.threeJsState.areaPoints];
                if (coordinates.length >= 3) {
                    coordinates.push(coordinates[0]); // Kapalı
                }
                
                const previewGeometry = {
                    type: 'Polygon',
                    coordinates: [coordinates]
                };
                
                const previewSourceId = 'measure-area-preview-' + Date.now();
                map.addSource(previewSourceId, { type: 'geojson', data: previewGeometry });
                map.addLayer({
                    id: previewSourceId + '-fill',
                    type: 'fill',
                    source: previewSourceId,
                    paint: {
                        'fill-color': '#FBBF24',
                        'fill-opacity': 0.3
                    }
                });
                map.addLayer({
                    id: previewSourceId + '-line',
                    type: 'line',
                    source: previewSourceId,
                    paint: {
                        'line-color': '#FBBF24',
                        'line-width': 2
                    }
                });
                
                window.threeJsState.areaPreviewLayer = previewSourceId;
                window.threeJsState.measurementLayers.push(previewSourceId + '-fill', previewSourceId + '-line');
                
                // En az 3 nokta varsa dinamik alan etiketi göster
                if (window.threeJsState.areaPoints.length >= 3) {
                    // Eski dinamik label'ı temizle
                    const oldLabelLayers = window.threeJsState.measurementLayers.filter(id => id.startsWith('measure-area-dynamic-label-'));
                    oldLabelLayers.forEach(layerId => {
                        try {
                            if (map.getLayer(layerId)) map.removeLayer(layerId);
                            if (map.getSource(layerId)) map.removeSource(layerId);
                            window.threeJsState.measurementLayers = window.threeJsState.measurementLayers.filter(id => id !== layerId);
                        } catch (e) {}
                    });
                    
                    const tempArea = calculateArea(window.threeJsState.areaPoints);
                    const centroid = getCentroid(window.threeJsState.areaPoints.map(c => [c[0], c[1]]));
                    const areaText = formatArea(tempArea);
                    
                    const labelFeature = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [centroid.lon, centroid.lat]
                        },
                        properties: {
                            label: areaText
                        }
                    };
                    const labelSourceId = 'measure-area-dynamic-label-' + Date.now();
                    map.addSource(labelSourceId, { type: 'geojson', data: labelFeature });
                    map.addLayer({
                        id: labelSourceId,
                        type: 'symbol',
                        source: labelSourceId,
                        layout: {
                            'text-field': ['get', 'label'],
                            'text-size': 14,
                            'text-anchor': 'center',
                            'text-allow-overlap': true,
                            'text-ignore-placement': true
                        },
                        paint: {
                            'text-color': '#ffffff',
                            'text-halo-color': '#000000',
                            'text-halo-width': 2
                        }
                    }, map.getLayer(previewSourceId + '-line') ? previewSourceId + '-line' : undefined);
                    window.threeJsState.measurementLayers.push(labelSourceId);
                }
                
                // Tamamla butonunu göster (en az 3 nokta varsa)
                const finishBtn = document.getElementById('area-finish-btn');
                if (finishBtn && window.threeJsState.areaPoints.length >= 3) {
                    finishBtn.style.display = 'block';
                }
            }
        }
        
        // Alan ölçümünü tamamla (double-click veya finishAreaMeasurement)
        function finishAreaMeasurement() {
            const map = window.threeJsState.map;
            if (!map || !window.threeJsState.areaPoints || window.threeJsState.areaPoints.length < 3) {
                console.log('[Area Measurement] Cannot finish - insufficient points or map not ready');
                return;
            }
            
            console.log('[Area Measurement] Finishing measurement with', window.threeJsState.areaPoints.length, 'points');
            
            const coordinates = window.threeJsState.areaPoints.map(c => [c[0], c[1]]);
            const areaM2 = calculateArea(coordinates);
            const areaText = formatArea(areaM2);
            
            const timestamp = Date.now();
            const previewId = window.threeJsState.areaPreviewLayer;
            
            // Dinamik label'ı kaldır
            const dynamicLabelLayers = window.threeJsState.measurementLayers.filter(id => id.startsWith('measure-area-dynamic-label-'));
            dynamicLabelLayers.forEach(layerId => {
                try {
                    if (map.getLayer(layerId)) map.removeLayer(layerId);
                    if (map.getSource(layerId)) map.removeSource(layerId);
                    window.threeJsState.measurementLayers = window.threeJsState.measurementLayers.filter(id => id !== layerId);
                } catch (e) {
                    console.warn('[Area Measurement] Error removing dynamic label:', e);
                }
            });
            
            // Final label ekle (centroid'te)
            const centroid = getCentroid(coordinates);
            const labelFeature = {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [centroid.lon, centroid.lat]
                },
                properties: {
                    label: areaText
                }
            };
            const labelSourceId = 'measure-area-label-' + timestamp;
            
            try {
                map.addSource(labelSourceId, { type: 'geojson', data: labelFeature });
                
                // Layer'ı preview line layer'ının üstüne ekle
                const beforeId = previewId && map.getLayer(previewId + '-line') ? previewId + '-line' : undefined;
                map.addLayer({
                    id: labelSourceId,
                    type: 'symbol',
                    source: labelSourceId,
                    layout: {
                        'text-field': ['get', 'label'],
                        'text-size': 14,
                        'text-anchor': 'center',
                        'text-allow-overlap': true,
                        'text-ignore-placement': true
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#000000',
                        'text-halo-width': 2
                    }
                }, beforeId);
                window.threeJsState.measurementLayers.push(labelSourceId);
                
                console.log('[Area Measurement] Final label added:', areaText);
            } catch (e) {
                console.error('[Area Measurement] Error adding final label:', e);
            }
            
            // Reset areaPoints (yeni ölçüm yapılabilir)
            window.threeJsState.areaPoints = [];
            window.threeJsState.areaPreviewLayer = null;
            
            // Tamamla butonunu gizle
            const finishBtn = document.getElementById('area-finish-btn');
            if (finishBtn) {
                finishBtn.style.display = 'none';
            }
            
            console.log('[Area Measurement] Measurement finished, ready for new measurement');
            // Mode aktif kalıyor, yeni ölçüm yapılabilir
        }
        
        // Alan ölçümü tamamla butonu event listener
        function setupAreaFinishButton() {
            const finishBtn = document.getElementById('area-finish-btn');
            if (finishBtn && !finishBtn.hasAttribute('data-listener-added')) {
                finishBtn.setAttribute('data-listener-added', 'true');
                finishBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Area Measurement] Finish button clicked');
                    finishAreaMeasurement();
                    return false;
                });
                console.log('[Area Measurement] Finish button listener added');
            }
        }
        
        // İlk yüklemede
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(setupAreaFinishButton, 100);
            });
        } else {
            setTimeout(setupAreaFinishButton, 100);
        }
        
        // Mesafe hesapla (yardımcı fonksiyon - Haversine)
        function calculateShapeDistance(point1, point2) {
            const lon1 = point1.lon * Math.PI / 180;
            const lat1 = point1.lat * Math.PI / 180;
            const lon2 = point2.lon * Math.PI / 180;
            const lat2 = point2.lat * Math.PI / 180;
            
            const R = 6371000; // Dünya yarıçapı (metre)
            const dLat = lat2 - lat1;
            const dLon = lon2 - lon1;
            
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1) * Math.cos(lat2) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            
            return R * c; // metre
        }
        
        // Alan hesapla (Shoelace formülü)
        function calculateArea(coords) {
            if (!coords || coords.length < 3) return 0;
            
            let area = 0;
            const n = coords.length;
            
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                area += coords[i][0] * coords[j][1]; // lon1 * lat2
                area -= coords[j][0] * coords[i][1]; // lon2 * lat1
            }
            
            area = Math.abs(area / 2); // degree² cinsinden
            
            // Degree²'den metrekare'ye dönüşüm
            const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / n;
            const latRad = avgLat * Math.PI / 180;
            const metersPerDegreeLat = 111320;
            const metersPerDegreeLon = 111320 * Math.cos(latRad);
            
            return area * metersPerDegreeLat * metersPerDegreeLon;
        }
        
        // Mesafe formatla (m veya km)
        function formatDistance(meters) {
            if (meters < 1000) {
                return Math.round(meters) + ' m';
            } else {
                return (meters / 1000).toFixed(2) + ' km';
            }
        }
        
        // Alan formatla (m²)
        function formatArea(sqMeters) {
            return Math.round(sqMeters).toLocaleString('tr-TR') + ' m²';
        }
        
        // İki nokta arası orta nokta
        function getMidpoint(point1, point2) {
            return {
                lon: (point1.lon + point2.lon) / 2,
                lat: (point1.lat + point2.lat) / 2
            };
        }
        
        // Polygon centroid hesapla
        function getCentroid(coords) {
            if (!coords || coords.length === 0) return { lon: 0, lat: 0 };
            let sumLon = 0, sumLat = 0;
            coords.forEach(c => {
                sumLon += c[0];
                sumLat += c[1];
            });
            return {
                lon: sumLon / coords.length,
                lat: sumLat / coords.length
            };
        }
        
        // Rectangle (Kare/Dikdörtgen) çizim
        function handleRectangleClick(point) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            if (!window.threeJsState.drawingStartPos) {
                // İlk tıklama - başlangıç noktasını kaydet
                window.threeJsState.drawingStartPos = point;
                window.threeJsState.drawingPoints = [point];
            } else {
                // İkinci tıklama - rectangle çiz
                const start = window.threeJsState.drawingStartPos;
                const end = point;
                
                // En uzun kenarı referans al (kare için)
                const deltaLon = Math.abs(end.lon - start.lon);
                const deltaLat = Math.abs(end.lat - start.lat);
                const maxDim = Math.max(deltaLon, deltaLat);
                
                // Rectangle köşeleri
                const coordinates = [
                    [start.lon, start.lat],
                    [start.lon + (end.lon >= start.lon ? maxDim : -maxDim), start.lat],
                    [start.lon + (end.lon >= start.lon ? maxDim : -maxDim), start.lat + (end.lat >= start.lat ? maxDim : -maxDim)],
                    [start.lon, start.lat + (end.lat >= start.lat ? maxDim : -maxDim)],
                    [start.lon, start.lat] // Kapalı polygon
                ];
                
                const geometry = {
                    type: 'Polygon',
                    coordinates: [coordinates]
                };
                
                // Mapbox'da çiz
                const shapeId = 'shape-rectangle-' + Date.now();
                map.addSource(shapeId, { type: 'geojson', data: geometry });
                map.addLayer({
                    id: shapeId + '-fill',
                    type: 'fill',
                    source: shapeId,
                    paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.5 }
                });
                map.addLayer({
                    id: shapeId + '-line',
                    type: 'line',
                    source: shapeId,
                    paint: { 'line-color': '#2563eb', 'line-width': 2 }
                });
                
                window.threeJsState.shapes.push({ id: shapeId, type: 'rectangle', geometry: geometry });
                
                // Şekil listesini güncelle
                updateShapeList();
                
                // Reset
                window.threeJsState.drawingStartPos = null;
                window.threeJsState.drawingPoints = [];
                window.threeJsState.drawingMode = null;
                document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
                map.getCanvas().style.cursor = '';
            }
        }
        
        // Triangle (Üçgen) çizim
        function handleTriangleClick(point) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            if (!window.threeJsState.drawingPoints) {
                window.threeJsState.drawingPoints = [];
            }
            
            window.threeJsState.drawingPoints.push(point);
            
            if (window.threeJsState.drawingPoints.length === 3) {
                // 3 nokta var - üçgen çiz
                const coordinates = [
                    [window.threeJsState.drawingPoints[0].lon, window.threeJsState.drawingPoints[0].lat],
                    [window.threeJsState.drawingPoints[1].lon, window.threeJsState.drawingPoints[1].lat],
                    [window.threeJsState.drawingPoints[2].lon, window.threeJsState.drawingPoints[2].lat],
                    [window.threeJsState.drawingPoints[0].lon, window.threeJsState.drawingPoints[0].lat] // Kapalı
                ];
                
                const geometry = {
                    type: 'Polygon',
                    coordinates: [coordinates]
                };
                
                const shapeId = 'shape-triangle-' + Date.now();
                map.addSource(shapeId, { type: 'geojson', data: geometry });
                map.addLayer({
                    id: shapeId + '-fill',
                    type: 'fill',
                    source: shapeId,
                    paint: { 'fill-color': '#10b981', 'fill-opacity': 0.5 }
                });
                map.addLayer({
                    id: shapeId + '-line',
                    type: 'line',
                    source: shapeId,
                    paint: { 'line-color': '#059669', 'line-width': 2 }
                });
                
                window.threeJsState.shapes.push({ id: shapeId, type: 'triangle', geometry: geometry });
                
                // Şekil listesini güncelle
                updateShapeList();
                
                // Reset
                window.threeJsState.drawingPoints = [];
                window.threeJsState.drawingMode = null;
                document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
                map.getCanvas().style.cursor = '';
            }
        }
        
        // Circle (Yuvarlak) çizim
        function handleCircleClick(point) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            if (!window.threeJsState.drawingStartPos) {
                // İlk tıklama - merkez
                window.threeJsState.drawingStartPos = point;
                window.threeJsState.drawingPoints = [point];
            } else {
                // İkinci tıklama - radius
                const center = window.threeJsState.drawingStartPos;
                const radius = calculateShapeDistance(center, point);
                
                // Circle polygon oluştur (64 adım)
                const positions = [];
                const steps = 64;
                for (let i = 0; i <= steps; i++) {
                    const angle = (i / steps) * Math.PI * 2;
                    const lon = center.lon + (radius / 111320) * Math.cos(angle) / Math.cos(center.lat * Math.PI / 180);
                    const lat = center.lat + (radius / 110540) * Math.sin(angle);
                    positions.push([lon, lat]);
                }
                positions.push(positions[0]); // Kapalı
                
                const geometry = {
                    type: 'Polygon',
                    coordinates: [positions]
                };
                
                const shapeId = 'shape-circle-' + Date.now();
                map.addSource(shapeId, { type: 'geojson', data: geometry });
                map.addLayer({
                    id: shapeId + '-fill',
                    type: 'fill',
                    source: shapeId,
                    paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.5 }
                });
                map.addLayer({
                    id: shapeId + '-line',
                    type: 'line',
                    source: shapeId,
                    paint: { 'line-color': '#dc2626', 'line-width': 2 }
                });
                
                window.threeJsState.shapes.push({ id: shapeId, type: 'circle', geometry: geometry });
                
                // Şekil listesini güncelle
                updateShapeList();
                
                // Reset
                window.threeJsState.drawingStartPos = null;
                window.threeJsState.drawingPoints = [];
                window.threeJsState.drawingMode = null;
                document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
                map.getCanvas().style.cursor = '';
            }
        }
        
        // Ellipse (Elips) çizim
        function handleEllipseClick(point) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            if (!window.threeJsState.drawingStartPos) {
                // İlk tıklama - merkez
                window.threeJsState.drawingStartPos = point;
                window.threeJsState.drawingPoints = [point];
                if (!window.threeJsState.ellipseAxes) {
                    window.threeJsState.ellipseAxes = [];
                }
            } else if (window.threeJsState.ellipseAxes.length === 0) {
                // İkinci tıklama - ilk eksen
                window.threeJsState.ellipseAxes.push(point);
                window.threeJsState.drawingPoints.push(point);
            } else if (window.threeJsState.ellipseAxes.length === 1) {
                // Üçüncü tıklama - ikinci eksen, ellipse çiz
                window.threeJsState.ellipseAxes.push(point);
                const center = window.threeJsState.drawingStartPos;
                const axis1 = window.threeJsState.ellipseAxes[0];
                const axis2 = window.threeJsState.ellipseAxes[1];
                
                const semiMajor = calculateShapeDistance(center, axis1);
                const semiMinor = calculateShapeDistance(center, axis2);
                
                // Rotation açısı
                const angle1 = Math.atan2(axis1.lat - center.lat, axis1.lon - center.lon);
                
                // Ellipse polygon oluştur
                const positions = [];
                const steps = 64;
                for (let i = 0; i <= steps; i++) {
                    const angle = (i / steps) * Math.PI * 2;
                    const x = semiMajor * Math.cos(angle) / 111320;
                    const y = semiMinor * Math.sin(angle) / 110540;
                    
                    // Rotation uygula
                    const rotatedX = x * Math.cos(angle1) - y * Math.sin(angle1);
                    const rotatedY = x * Math.sin(angle1) + y * Math.cos(angle1);
                    
                    const lon = center.lon + rotatedX / Math.cos(center.lat * Math.PI / 180);
                    const lat = center.lat + rotatedY;
                    positions.push([lon, lat]);
                }
                positions.push(positions[0]); // Kapalı
                
                const geometry = {
                    type: 'Polygon',
                    coordinates: [positions]
                };
                
                const shapeId = 'shape-ellipse-' + Date.now();
                map.addSource(shapeId, { type: 'geojson', data: geometry });
                map.addLayer({
                    id: shapeId + '-fill',
                    type: 'fill',
                    source: shapeId,
                    paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.5 }
                });
                map.addLayer({
                    id: shapeId + '-line',
                    type: 'line',
                    source: shapeId,
                    paint: { 'line-color': '#9333ea', 'line-width': 2 }
                });
                
                window.threeJsState.shapes.push({ id: shapeId, type: 'ellipse', geometry: geometry });
                
                // Reset
                window.threeJsState.drawingStartPos = null;
                window.threeJsState.drawingPoints = [];
                window.threeJsState.ellipseAxes = [];
                window.threeJsState.drawingMode = null;
                document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
                map.getCanvas().style.cursor = '';
            }
        }
        
        // Polygon (Çokgen) çizim
        function handlePolygonClick(point) {
            if (!window.threeJsState.drawingPoints) {
                window.threeJsState.drawingPoints = [];
            }
            window.threeJsState.drawingPoints.push(point);
        }
        
        // Polygon çizimini bitir
        function finishPolygon() {
            const map = window.threeJsState.map;
            if (!map || !window.threeJsState.drawingPoints || window.threeJsState.drawingPoints.length < 3) return;
            
            const coordinates = window.threeJsState.drawingPoints.map(p => [p.lon, p.lat]);
            coordinates.push(coordinates[0]); // Kapalı
            
            const geometry = {
                type: 'Polygon',
                coordinates: [coordinates]
            };
            
            const shapeId = 'shape-polygon-' + Date.now();
            map.addSource(shapeId, { type: 'geojson', data: geometry });
            map.addLayer({
                id: shapeId + '-fill',
                type: 'fill',
                source: shapeId,
                paint: { 'fill-color': '#10b981', 'fill-opacity': 0.5 }
            });
            map.addLayer({
                id: shapeId + '-line',
                type: 'line',
                source: shapeId,
                paint: { 'line-color': '#059669', 'line-width': 2 }
            });
            
            window.threeJsState.shapes.push({ id: shapeId, type: 'polygon', geometry: geometry });
            
            // Şekil listesini güncelle
            updateShapeList();
            
            // Reset
            window.threeJsState.drawingPoints = [];
            window.threeJsState.drawingMode = null;
            document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
            map.getCanvas().style.cursor = '';
        }
        
        // Line (Çizgi) çizim
        function handleLineClick(point) {
            if (!window.threeJsState.drawingPoints) {
                window.threeJsState.drawingPoints = [];
            }
            window.threeJsState.drawingPoints.push(point);
        }
        
        // Line çizimini bitir
        function finishLine() {
            const map = window.threeJsState.map;
            if (!map || !window.threeJsState.drawingPoints || window.threeJsState.drawingPoints.length < 2) return;
            
            const coordinates = window.threeJsState.drawingPoints.map(p => [p.lon, p.lat]);
            
            const geometry = {
                type: 'LineString',
                coordinates: coordinates
            };
            
            const shapeId = 'shape-line-' + Date.now();
            map.addSource(shapeId, { type: 'geojson', data: geometry });
            map.addLayer({
                id: shapeId,
                type: 'line',
                source: shapeId,
                paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-join': 'round', 'line-cap': 'round' }
            });
            
            window.threeJsState.shapes.push({ id: shapeId, type: 'line', geometry: geometry });
            
            // Şekil listesini güncelle
            updateShapeList();
            
            // Reset
            window.threeJsState.drawingPoints = [];
            window.threeJsState.drawingMode = null;
            document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
            map.getCanvas().style.cursor = '';
        }
        
        // Arrow (Ok) çizim
        function handleArrowClick(point) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            if (!window.threeJsState.drawingStartPos) {
                window.threeJsState.drawingStartPos = point;
                window.threeJsState.drawingPoints = [point];
            } else {
                // İkinci tıklama - ok çiz
                const start = window.threeJsState.drawingStartPos;
                const end = point;
                
                // Ok yönü
                const angle = Math.atan2(end.lat - start.lat, end.lon - start.lon);
                const arrowHeadSize = 0.0001; // Yaklaşık 11 metre
                const arrowHeadAngle = Math.PI / 6; // 30 derece
                
                // Ok başı köşeleri
                const headPoint1 = {
                    lon: end.lon - arrowHeadSize * Math.cos(angle - arrowHeadAngle) / Math.cos(end.lat * Math.PI / 180),
                    lat: end.lat - arrowHeadSize * Math.sin(angle - arrowHeadAngle)
                };
                const headPoint2 = {
                    lon: end.lon - arrowHeadSize * Math.cos(angle + arrowHeadAngle) / Math.cos(end.lat * Math.PI / 180),
                    lat: end.lat - arrowHeadSize * Math.sin(angle + arrowHeadAngle)
                };
                
                // Line geometry
                const lineGeometry = {
                    type: 'LineString',
                    coordinates: [[start.lon, start.lat], [end.lon, end.lat]]
                };
                
                // Arrow head geometry
                const headGeometry = {
                    type: 'Polygon',
                    coordinates: [[[end.lon, end.lat], [headPoint1.lon, headPoint1.lat], [headPoint2.lon, headPoint2.lat], [end.lon, end.lat]]]
                };
                
                const shapeId = 'shape-arrow-' + Date.now();
                
                // Line
                map.addSource(shapeId + '-line', { type: 'geojson', data: lineGeometry });
                map.addLayer({
                    id: shapeId + '-line',
                    type: 'line',
                    source: shapeId + '-line',
                    paint: { 'line-color': '#f97316', 'line-width': 3 }
                });
                
                // Head
                map.addSource(shapeId + '-head', { type: 'geojson', data: headGeometry });
                map.addLayer({
                    id: shapeId + '-head-fill',
                    type: 'fill',
                    source: shapeId + '-head',
                    paint: { 'fill-color': '#f97316' }
                });
                map.addLayer({
                    id: shapeId + '-head-line',
                    type: 'line',
                    source: shapeId + '-head',
                    paint: { 'line-color': '#ea580c', 'line-width': 2 }
                });
                
                window.threeJsState.shapes.push({ id: shapeId, type: 'arrow', geometry: { line: lineGeometry, head: headGeometry } });
                
                // Şekil listesini güncelle
                updateShapeList();
                
                // Reset
                window.threeJsState.drawingStartPos = null;
                window.threeJsState.drawingPoints = [];
                window.threeJsState.drawingMode = null;
                document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
                map.getCanvas().style.cursor = '';
            }
        }
        
        // Marker (Nokta) çizim
        function handleMarkerClick(point) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const geometry = {
                type: 'Point',
                coordinates: [point.lon, point.lat]
            };
            
            const shapeId = 'shape-marker-' + Date.now();
            map.addSource(shapeId, { type: 'geojson', data: geometry });
            map.addLayer({
                id: shapeId,
                type: 'circle',
                source: shapeId,
                paint: {
                    'circle-radius': 10,
                    'circle-color': '#06b6d4',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });
            
            window.threeJsState.shapes.push({ id: shapeId, type: 'marker', geometry: geometry });
            
            // Şekil listesini güncelle
            updateShapeList();
            
            // Reset (tek tıklamada tamamlanır, ama mode aktif kalabilir)
            window.threeJsState.drawingMode = null;
            document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
            map.getCanvas().style.cursor = '';
        }
        
        // TextBox (Metin Kutusu) çizim
        function handleTextBoxClick(point) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            // Modal aç
            const text = prompt('Metin girin:', 'Metin');
            if (!text || text.trim() === '') {
                window.threeJsState.drawingMode = null;
                document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
                map.getCanvas().style.cursor = '';
                return;
            }
            
            const textContent = text.trim();
            const shapeId = 'shape-textbox-' + Date.now();
            
            // Metin uzunluğuna göre kutu boyutunu hesapla (yaklaşık)
            // Her karakter için ~8px, padding 20px her iki tarafta
            const textLength = textContent.length;
            const boxWidth = Math.max(80, textLength * 8 + 40); // Min 80px, padding dahil
            const boxHeight = 40;
            const borderRadius = 8;
            const pinHeight = 12; // İğne yüksekliği
            
            // Pixel'den dereceye dönüşüm (yaklaşık, zoom seviyesine göre değişir)
            const zoom = map.getZoom();
            const metersPerPixel = 156543.03392 * Math.cos(point.lat * Math.PI / 180) / Math.pow(2, zoom);
            const widthDeg = (boxWidth * metersPerPixel) / 111320; // 111320 metre = 1 derece enlem
            const heightDeg = (boxHeight * metersPerPixel) / 111320;
            const pinHeightDeg = (pinHeight * metersPerPixel) / 111320;
            const radiusDeg = (borderRadius * metersPerPixel) / 111320;
            
            // İğne ucu point.lat'ta olmalı, kutu üstünde
            // Kutu merkezi = point.lat + (boxHeight/2 + pinHeight)
            const halfWidth = widthDeg / 2;
            const halfHeight = heightDeg / 2;
            const centerLon = point.lon;
            const centerLat = point.lat + (halfHeight + pinHeightDeg); // Kutu iğnenin üstünde
            
            // Rounded rectangle için köşe noktaları
            // Her köşe için yuvarlak noktalar oluştur
            const createRoundedCorner = (centerX, centerY, radius, startAngle, endAngle, segments) => {
                const coords = [];
                for (let i = 0; i <= segments; i++) {
                    const angle = startAngle + (endAngle - startAngle) * (i / segments);
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    coords.push([x, y]);
                }
                return coords;
            };
            
            const segments = 6; // Her köşe için 6 segment (daha yuvarlak)
            const boxCoords = [];
            
            // Üst kenar (sol -> sağ)
            boxCoords.push([centerLon - halfWidth + radiusDeg, centerLat + halfHeight]);
            boxCoords.push([centerLon + halfWidth - radiusDeg, centerLat + halfHeight]);
            
            // Sağ üst köşe (yuvarlak)
            const topRightCorner = createRoundedCorner(
                centerLon + halfWidth - radiusDeg,
                centerLat + halfHeight - radiusDeg,
                radiusDeg,
                Math.PI / 2, // 90 derece
                0, // 0 derece
                segments
            );
            boxCoords.push(...topRightCorner.slice(1)); // İlk noktayı atla (zaten var)
            
            // Sağ kenar (üst -> alt)
            boxCoords.push([centerLon + halfWidth, centerLat - halfHeight + radiusDeg]);
            
            // Alt sağ köşe (yuvarlak)
            const bottomRightCorner = createRoundedCorner(
                centerLon + halfWidth - radiusDeg,
                centerLat - halfHeight + radiusDeg,
                radiusDeg,
                0, // 0 derece
                -Math.PI / 2, // -90 derece
                segments
            );
            boxCoords.push(...bottomRightCorner.slice(1)); // İlk noktayı atla
            
            // Alt kenar (sağ -> sol) - düz kenar
            boxCoords.push([centerLon - halfWidth + radiusDeg, centerLat - halfHeight]);
            
            // Alt sol köşe (yuvarlak)
            const bottomLeftCorner = createRoundedCorner(
                centerLon - halfWidth + radiusDeg,
                centerLat - halfHeight + radiusDeg,
                radiusDeg,
                -Math.PI / 2, // -90 derece
                Math.PI, // 180 derece
                segments
            );
            boxCoords.push(...bottomLeftCorner.slice(1)); // İlk noktayı atla
            
            // Sol kenar (alt -> üst)
            boxCoords.push([centerLon - halfWidth, centerLat + halfHeight - radiusDeg]);
            
            // Üst sol köşe (yuvarlak)
            const topLeftCorner = createRoundedCorner(
                centerLon - halfWidth + radiusDeg,
                centerLat + halfHeight - radiusDeg,
                radiusDeg,
                Math.PI, // 180 derece
                Math.PI / 2, // 90 derece
                segments
            );
            boxCoords.push(...topLeftCorner.slice(1)); // İlk noktayı atla
            
            // Kapat
            boxCoords.push(boxCoords[0]);
            
            // İğne (üçgen) - kutunun alt ortasında, iğne ucu point.lat'ta
            const pinWidth = widthDeg * 0.2; // İğne genişliği (kutunun %20'si)
            const pinTopLat = centerLat - halfHeight; // Kutunun alt kenarı
            const pinBottomLat = point.lat; // İğne ucu (tıklanan nokta)
            const pinCoords = [
                [centerLon, pinBottomLat], // İğne ucu (aşağı) - işaret noktası (point.lat)
                [centerLon - pinWidth / 2, pinTopLat], // İğne sol köşe (kutunun alt kenarına bağlı)
                [centerLon + pinWidth / 2, pinTopLat], // İğne sağ köşe (kutunun alt kenarına bağlı)
                [centerLon, pinBottomLat] // Kapat
            ];
            
            // Kutu polygon
            const boxFeature = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [boxCoords]
                },
                properties: {}
            };
            
            // İğne polygon
            const pinFeature = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [pinCoords]
                },
                properties: {}
            };
            
            // Text point (kutunun merkezi)
            const textFeature = {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [centerLon, centerLat]
                },
                properties: {
                    text: textContent
                }
            };
            
            // Kutu background
            const boxSourceId = shapeId + '-box';
            map.addSource(boxSourceId, { type: 'geojson', data: boxFeature });
            map.addLayer({
                id: boxSourceId,
                type: 'fill',
                source: boxSourceId,
                paint: {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.9
                }
            });
            
            // Kutu border
            map.addLayer({
                id: boxSourceId + '-border',
                type: 'line',
                source: boxSourceId,
                paint: {
                    'line-color': '#2563eb',
                    'line-width': 2
                }
            });
            
            // İğne
            const pinSourceId = shapeId + '-pin';
            map.addSource(pinSourceId, { type: 'geojson', data: pinFeature });
            map.addLayer({
                id: pinSourceId,
                type: 'fill',
                source: pinSourceId,
                paint: {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.9
                }
            });
            
            // İğne border
            map.addLayer({
                id: pinSourceId + '-border',
                type: 'line',
                source: pinSourceId,
                paint: {
                    'line-color': '#2563eb',
                    'line-width': 2
                }
            });
            
            // Text label
            const textSourceId = shapeId + '-text';
            map.addSource(textSourceId, { type: 'geojson', data: textFeature });
            map.addLayer({
                id: textSourceId,
                type: 'symbol',
                source: textSourceId,
                layout: {
                    'text-field': ['get', 'text'],
                    'text-size': 14,
                    'text-anchor': 'center',
                    'text-allow-overlap': true,
                    'text-ignore-placement': true
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1
                }
            });
            
            window.threeJsState.shapes.push({ 
                id: shapeId, 
                type: 'textbox', 
                geometry: textFeature.geometry, 
                text: textContent,
                boxSource: boxSourceId,
                pinSource: pinSourceId,
                textSource: textSourceId
            });
            
            // Şekil listesini güncelle
            updateShapeList();
            
            // Reset
            window.threeJsState.drawingMode = null;
            document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
            map.getCanvas().style.cursor = '';
        }
        
        
        // Şekil güncelleme fonksiyonları
        function updateShapeOutlineColor(shapeId, color) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
                if ((layer.id.startsWith(shapeId + '-') || layer.id === shapeId) && layer.type === 'line') {
                    map.setPaintProperty(layer.id, 'line-color', color);
                }
            });
            
            // Shape metadata'yı güncelle
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.outlineColor = color;
            }
        }
        
        function updateShapeFillColor(shapeId, color) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
                if ((layer.id.startsWith(shapeId + '-') || layer.id === shapeId) && layer.type === 'fill') {
                    map.setPaintProperty(layer.id, 'fill-color', color);
                }
            });
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.fillColor = color;
            }
        }
        
        function updateShapeOutlineWidth(shapeId, width) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
                if ((layer.id.startsWith(shapeId + '-') || layer.id === shapeId) && layer.type === 'line') {
                    map.setPaintProperty(layer.id, 'line-width', width);
                }
            });
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.outlineWidth = width;
            }
        }
        
        function updateShapeOpacity(shapeId, opacity) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
                if (layer.id.startsWith(shapeId + '-') || layer.id === shapeId) {
                    if (layer.type === 'fill') {
                        map.setPaintProperty(layer.id, 'fill-opacity', opacity);
                    } else if (layer.type === 'line') {
                        map.setPaintProperty(layer.id, 'line-opacity', opacity);
                    } else if (layer.type === 'circle') {
                        map.setPaintProperty(layer.id, 'circle-opacity', opacity);
                    }
                }
            });
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.opacity = opacity;
            }
        }
        
        function updateShapeFillEnabled(shapeId, enabled) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
                if ((layer.id.startsWith(shapeId + '-') || layer.id === shapeId) && layer.type === 'fill') {
                    map.setPaintProperty(layer.id, 'fill-opacity', enabled ? 0.5 : 0);
                }
            });
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.fillEnabled = enabled;
            }
        }
        
        function updateShapeVisibility(shapeId, visible) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
                if (layer.id.startsWith(shapeId + '-') || layer.id === shapeId) {
                    map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
                }
            });
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.visible = visible;
            }
        }
        
        function updateShapeName(shapeId, name) {
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.name = name;
            }
        }
        
        function updateShapeRotation(shapeId, rotation) {
            // Rotation için GeoJSON source'unu döndür (centroid etrafında)
            const map = window.threeJsState.map;
            if (!map) return;
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (!shape) return;
            
            // Centroid hesapla
            const geometry = shape.geometry;
            let centroid = { lon: 0, lat: 0 };
            
            if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
                const coords = geometry.coordinates[0];
                let sumLon = 0, sumLat = 0;
                coords.forEach(coord => {
                    sumLon += coord[0];
                    sumLat += coord[1];
                });
                centroid = { lon: sumLon / coords.length, lat: sumLat / coords.length };
            } else if (geometry.type === 'LineString' && geometry.coordinates) {
                const coords = geometry.coordinates;
                let sumLon = 0, sumLat = 0;
                coords.forEach(coord => {
                    sumLon += coord[0];
                    sumLat += coord[1];
                });
                centroid = { lon: sumLon / coords.length, lat: sumLat / coords.length };
            } else if (geometry.type === 'Point' && geometry.coordinates) {
                centroid = { lon: geometry.coordinates[0], lat: geometry.coordinates[1] };
            }
            
            // Rotation uygula (basitleştirilmiş - sadece metadata'da sakla)
            shape.rotation = rotation;
            // TODO: Gerçek rotation için GeoJSON source'unu dönüştür
        }
        
        function updateShapeScale(shapeId, scale) {
            // Scale için GeoJSON source'unu ölçekle (centroid etrafında)
            const map = window.threeJsState.map;
            if (!map) return;
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (!shape) return;
            
            // Scale metadata'da sakla
            shape.scale = scale;
            // TODO: Gerçek scale için GeoJSON source'unu dönüştür
        }
        
        // TextBox güncelleme fonksiyonları
        function updateShapeText(shapeId, text) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            const textLayer = allLayers.find(layer => 
                layer.id.startsWith(shapeId + '-text') && layer.type === 'symbol'
            );
            
            if (textLayer) {
                const source = map.getSource(textLayer.source);
                if (source && source._data) {
                    source._data.properties.text = text;
                    map.getSource(textLayer.source).setData(source._data);
                }
            }
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.text = text;
            }
        }
        
        function updateShapeTextSize(shapeId, size) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            const textLayer = allLayers.find(layer => 
                layer.id.startsWith(shapeId + '-text') && layer.type === 'symbol'
            );
            
            if (textLayer) {
                map.setLayoutProperty(textLayer.id, 'text-size', size);
            }
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.fontSize = size;
            }
        }
        
        function updateShapeTextColor(shapeId, color) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            const textLayer = allLayers.find(layer => 
                layer.id.startsWith(shapeId + '-text') && layer.type === 'symbol'
            );
            
            if (textLayer) {
                map.setPaintProperty(textLayer.id, 'text-color', color);
            }
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.textColor = color;
            }
        }
        
        function updateShapeBackgroundColor(shapeId, color) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const allLayers = map.getStyle().layers;
            const boxLayer = allLayers.find(layer => 
                layer.id.startsWith(shapeId + '-box') && layer.type === 'fill'
            );
            
            if (boxLayer) {
                map.setPaintProperty(boxLayer.id, 'fill-color', color);
            }
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (shape) {
                shape.backgroundColor = color;
            }
        }
        
        // Şekil yönetim fonksiyonları
        function duplicateShape(shapeId) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (!shape) return;
            
            // Yeni shape ID
            const newShapeId = shapeId.replace(/shape-\\w+-\\d+/, (match) => {
                const parts = match.split('-');
                return parts.slice(0, -1).join('-') + '-' + Date.now();
            });
            
            // GeoJSON source'unu kopyala ve offset ekle
            const allLayers = map.getStyle().layers;
            const shapeLayers = allLayers.filter(layer => 
                layer.id.startsWith(shapeId + '-') || layer.id === shapeId
            );
            
            shapeLayers.forEach(layer => {
                const source = map.getSource(layer.source);
                if (source && source._data) {
                    const newData = JSON.parse(JSON.stringify(source._data));
                    
                    // Offset ekle (yaklaşık 10 metre)
                    const offset = 0.0001; // ~10 metre
                    if (newData.geometry.type === 'Point') {
                        newData.geometry.coordinates[0] += offset;
                        newData.geometry.coordinates[1] += offset;
                    } else if (newData.geometry.type === 'LineString' || newData.geometry.type === 'Polygon') {
                        const coords = newData.geometry.type === 'Polygon' 
                            ? newData.geometry.coordinates[0] 
                            : newData.geometry.coordinates;
                        coords.forEach(coord => {
                            coord[0] += offset;
                            coord[1] += offset;
                        });
                    }
                    
                    const newLayerId = layer.id.replace(shapeId, newShapeId);
                    const newSourceId = layer.source.replace(shapeId, newShapeId);
                    
                    map.addSource(newSourceId, { type: 'geojson', data: newData });
                    
                    if (layer.type === 'fill') {
                        map.addLayer({
                            id: newLayerId,
                            type: 'fill',
                            source: newSourceId,
                            paint: map.getPaintProperties(layer.id)
                        });
                    } else if (layer.type === 'line') {
                        map.addLayer({
                            id: newLayerId,
                            type: 'line',
                            source: newSourceId,
                            paint: map.getPaintProperties(layer.id)
                        });
                    } else if (layer.type === 'circle') {
                        map.addLayer({
                            id: newLayerId,
                            type: 'circle',
                            source: newSourceId,
                            paint: map.getPaintProperties(layer.id)
                        });
                    } else if (layer.type === 'symbol') {
                        map.addLayer({
                            id: newLayerId,
                            type: 'symbol',
                            source: newSourceId,
                            layout: map.getLayoutProperties(layer.id),
                            paint: map.getPaintProperties(layer.id)
                        });
                    }
                }
            });
            
            // Yeni shape'i shapes array'ine ekle
            const newShape = JSON.parse(JSON.stringify(shape));
            newShape.id = newShapeId;
            window.threeJsState.shapes.push(newShape);
        }
        
        function deleteShape(shapeId) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            // Tüm layer'ları ve source'ları kaldır
            const allLayers = map.getStyle().layers;
            const shapeLayers = allLayers.filter(layer => 
                layer.id.startsWith(shapeId + '-') || layer.id === shapeId
            );
            
            const sourcesToRemove = new Set();
            shapeLayers.forEach(layer => {
                try {
                    if (map.getLayer(layer.id)) {
                        map.removeLayer(layer.id);
                    }
                    if (layer.source) {
                        sourcesToRemove.add(layer.source);
                    }
                } catch (e) {
                    console.warn('[Shape Delete] Error removing layer:', e);
                }
            });
            
            sourcesToRemove.forEach(sourceId => {
                try {
                    if (map.getSource(sourceId)) {
                        map.removeSource(sourceId);
                    }
                } catch (e) {
                    console.warn('[Shape Delete] Error removing source:', e);
                }
            });
            
            // Shapes array'inden kaldır
            window.threeJsState.shapes = window.threeJsState.shapes.filter(s => s.id !== shapeId);
            
            // Seçiliyse seçimi kaldır
            if (window.threeJsState.selectedShape === shapeId) {
                deselectShape();
            }
        }
        
        function clearAllShapes() {
            const map = window.threeJsState.map;
            if (!map) return;
            
            // Tüm shape'leri sil
            window.threeJsState.shapes.forEach(shape => {
                deleteShape(shape.id);
            });
        }
        
        // Şekil düzenleme paneli event listener'ları
        function setupShapeEditingPanelEventListeners(shapeId) {
            // Outline color
            const outlineColorPicker = document.getElementById('shape-outline-color');
            const outlineColorHex = document.getElementById('shape-outline-color-hex');
            if (outlineColorPicker && outlineColorHex) {
                outlineColorPicker.addEventListener('input', function() {
                    outlineColorHex.value = this.value;
                    updateShapeOutlineColor(shapeId, this.value);
                });
                outlineColorHex.addEventListener('change', function() {
                    if (/^#[0-9A-F]{6}$/i.test(this.value)) {
                        outlineColorPicker.value = this.value;
                        updateShapeOutlineColor(shapeId, this.value);
                    }
                });
            }
            
            // Fill color
            const fillColorPicker = document.getElementById('shape-fill-color');
            const fillColorHex = document.getElementById('shape-fill-color-hex');
            if (fillColorPicker && fillColorHex) {
                fillColorPicker.addEventListener('input', function() {
                    fillColorHex.value = this.value;
                    updateShapeFillColor(shapeId, this.value);
                });
                fillColorHex.addEventListener('change', function() {
                    if (/^#[0-9A-F]{6}$/i.test(this.value)) {
                        fillColorPicker.value = this.value;
                        updateShapeFillColor(shapeId, this.value);
                    }
                });
            }
            
            // Outline width
            const outlineWidthSlider = document.getElementById('shape-outline-width');
            if (outlineWidthSlider) {
                outlineWidthSlider.addEventListener('input', function() {
                    const valueEl = document.getElementById('shape-outline-width-value');
                    if (valueEl) valueEl.textContent = this.value + 'px';
                    updateShapeOutlineWidth(shapeId, parseInt(this.value));
                });
            }
            
            // Fill enabled
            const fillEnabledCheckbox = document.getElementById('shape-fill-enabled');
            if (fillEnabledCheckbox) {
                fillEnabledCheckbox.addEventListener('change', function() {
                    updateShapeFillEnabled(shapeId, this.checked);
                });
            }
            
            // Opacity
            const opacitySlider = document.getElementById('shape-opacity');
            if (opacitySlider) {
                opacitySlider.addEventListener('input', function() {
                    const valueEl = document.getElementById('shape-opacity-value');
                    if (valueEl) valueEl.textContent = this.value + '%';
                    updateShapeOpacity(shapeId, parseFloat(this.value) / 100);
                });
            }
            
            // Rotation
            const rotationSlider = document.getElementById('shape-rotation');
            if (rotationSlider) {
                rotationSlider.addEventListener('input', function() {
                    const valueEl = document.getElementById('shape-rotation-value');
                    if (valueEl) valueEl.textContent = this.value + '°';
                    updateShapeRotation(shapeId, parseFloat(this.value));
                });
            }
            
            // Scale
            const scaleSlider = document.getElementById('shape-scale');
            if (scaleSlider) {
                scaleSlider.addEventListener('input', function() {
                    const valueEl = document.getElementById('shape-scale-value');
                    if (valueEl) valueEl.textContent = this.value + '%';
                    updateShapeScale(shapeId, parseFloat(this.value) / 100);
                });
            }
            
            // Visibility
            const visibleCheckbox = document.getElementById('shape-visible');
            if (visibleCheckbox) {
                visibleCheckbox.addEventListener('change', function() {
                    updateShapeVisibility(shapeId, this.checked);
                });
            }
            
            // Name
            const nameInput = document.getElementById('shape-name');
            if (nameInput) {
                nameInput.addEventListener('change', function() {
                    updateShapeName(shapeId, this.value);
                });
            }
            
            // Duplicate
            const duplicateBtn = document.getElementById('shape-duplicate-btn');
            if (duplicateBtn) {
                duplicateBtn.addEventListener('click', function() {
                    duplicateShape(shapeId);
                });
            }
            
            // Delete
            const deleteBtn = document.getElementById('shape-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function() {
                    if (confirm('Şekli silmek istediğinize emin misiniz?')) {
                        deleteShape(shapeId);
                        closeShapeEditingPanel();
                    }
                });
            }
        }
        
        // TextBox düzenleme paneli event listener'ları
        function setupTextBoxEditingPanelEventListeners(shapeId) {
            // Text content
            const textContentInput = document.getElementById('shape-text-content');
            if (textContentInput) {
                textContentInput.addEventListener('input', function() {
                    updateShapeText(shapeId, this.value);
                });
            }
            
            // Text size
            const textSizeSlider = document.getElementById('shape-text-size');
            if (textSizeSlider) {
                textSizeSlider.addEventListener('input', function() {
                    const valueEl = document.getElementById('shape-text-size-value');
                    if (valueEl) valueEl.textContent = this.value + 'px';
                    updateShapeTextSize(shapeId, parseInt(this.value));
                });
            }
            
            // Text color
            const textColorPicker = document.getElementById('shape-text-color');
            const textColorHex = document.getElementById('shape-text-color-hex');
            if (textColorPicker && textColorHex) {
                textColorPicker.addEventListener('input', function() {
                    textColorHex.value = this.value;
                    updateShapeTextColor(shapeId, this.value);
                });
                textColorHex.addEventListener('change', function() {
                    if (/^#[0-9A-F]{6}$/i.test(this.value)) {
                        textColorPicker.value = this.value;
                        updateShapeTextColor(shapeId, this.value);
                    }
                });
            }
            
            // Background color
            const backgroundColorPicker = document.getElementById('shape-background-color');
            const backgroundColorHex = document.getElementById('shape-background-color-hex');
            if (backgroundColorPicker && backgroundColorHex) {
                backgroundColorPicker.addEventListener('input', function() {
                    backgroundColorHex.value = this.value;
                    updateShapeBackgroundColor(shapeId, this.value);
                });
                backgroundColorHex.addEventListener('change', function() {
                    if (/^#[0-9A-F]{6}$/i.test(this.value)) {
                        backgroundColorPicker.value = this.value;
                        updateShapeBackgroundColor(shapeId, this.value);
                    }
                });
            }
            
            // Duplicate ve Delete butonları
            const duplicateBtn = document.getElementById('shape-duplicate-btn');
            if (duplicateBtn) {
                duplicateBtn.addEventListener('click', function() {
                    duplicateShape(shapeId);
                });
            }
            
            const deleteBtn = document.getElementById('shape-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function() {
                    if (confirm('Metin kutusunu silmek istediğinize emin misiniz?')) {
                        deleteShape(shapeId);
                        closeShapeEditingPanel();
                    }
                });
            }
        }
        
        // Şekil listesini güncelle
        function updateShapeList() {
            const shapeListEl = document.getElementById('shape-list');
            if (!shapeListEl) return;
            
            const shapes = window.threeJsState.shapes || [];
            const selectedShapeId = window.threeJsState.selectedShape;
            
            if (shapes.length === 0) {
                shapeListEl.innerHTML = '<p style="color: #64748b; font-size: 12px; text-align: center; padding: 20px;">Henüz şekil eklenmedi. Haritaya şekil çizmek için "Şekil" menüsünü kullanın.</p>';
                return;
            }
            
            let html = '';
            shapes.forEach((shape, index) => {
                const isSelected = shape.id === selectedShapeId;
                const shapeName = shape.name || ('Şekil ' + (index + 1));
                const shapeType = getShapeTypeLabel(shape.type);
                
                html += '<div class="shape-list-item ' + (isSelected ? 'selected' : '') + '" data-shape-id="' + shape.id + '">' +
                    '<div class="shape-list-item-name">' + shapeName + '</div>' +
                    '<div class="shape-list-item-type">' + shapeType + '</div>' +
                    '</div>';
            });
            
            shapeListEl.innerHTML = html;
            
            // Click handler'ları ekle
            shapeListEl.querySelectorAll('.shape-list-item').forEach(item => {
                item.addEventListener('click', function() {
                    const shapeId = this.getAttribute('data-shape-id');
                    if (shapeId) {
                        selectShape(shapeId);
                    }
                });
            });
        }
        
        // Şekil tipi etiketini al
        function getShapeTypeLabel(type) {
            const labels = {
                'rectangle': 'Dikdörtgen',
                'triangle': 'Üçgen',
                'circle': 'Daire',
                'ellipse': 'Elips',
                'polygon': 'Çokgen',
                'line': 'Çizgi',
                'arrow': 'Ok',
                'marker': 'İşaret',
                'textbox': 'Metin Kutusu',
                'point': 'Nokta'
            };
            return labels[type] || type;
        }
        
        // Seçili şekil özelliklerini göster
        function showSelectedShapeProperties(shape) {
            const propertiesEl = document.getElementById('selected-shape-properties');
            const contentEl = document.getElementById('shape-properties-content');
            if (!propertiesEl || !contentEl) return;
            
            const props = getShapeProperties(shape.id);
            if (!props) return;
            
            const opacityPercent = Math.round((props.opacity || 1) * 100);
            contentEl.innerHTML = 
                '<div class="control-group">' +
                    '<div class="control-header">' +
                        '<span class="control-label">Ad:</span>' +
                        '<span class="control-value">' + (props.name || 'İsimsiz') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="control-group">' +
                    '<div class="control-header">' +
                        '<span class="control-label">Tip:</span>' +
                        '<span class="control-value">' + getShapeTypeLabel(shape.type) + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="control-group">' +
                    '<div class="control-header">' +
                        '<span class="control-label">Çizgi Rengi:</span>' +
                        '<span class="control-value" style="color: ' + props.outlineColor + ';">●</span>' +
                    '</div>' +
                '</div>' +
                '<div class="control-group">' +
                    '<div class="control-header">' +
                        '<span class="control-label">Dolgu Rengi:</span>' +
                        '<span class="control-value" style="color: ' + props.fillColor + ';">●</span>' +
                    '</div>' +
                '</div>' +
                '<div class="control-group">' +
                    '<div class="control-header">' +
                        '<span class="control-label">Şeffaflık:</span>' +
                        '<span class="control-value">' + opacityPercent + '%</span>' +
                    '</div>' +
                '</div>';
            
            propertiesEl.style.display = 'block';
            
            // Hareket kontrollerini aktif et
            setupMovementControls(shape.id);
        }
        
        // Seçili şekil özelliklerini gizle
        function hideSelectedShapeProperties() {
            const propertiesEl = document.getElementById('selected-shape-properties');
            if (propertiesEl) {
                propertiesEl.style.display = 'none';
            }
        }
        
        // Hareket mesafesini hesapla (ana projeden uyarlanmış)
        function calculateMoveDistance() {
            const map = window.threeJsState.map;
            if (!map) return 0.5; // Default 0.5 metre
            
            // Kameranın yüksekliğini al (metre cinsinden)
            const cameraHeight = map.getCamera().position.altitude || 1000;
            
            // Hareket mesafesi (metre cinsinden) = kameranın yüksekliğinin %5'i
            // Minimum 0.5 metre (50cm), Maksimum 500m
            const targetMoveDistanceMeters = cameraHeight * 0.05;
            const clampedMoveDistanceMeters = Math.max(0.5, Math.min(targetMoveDistanceMeters, 500));
            
            return clampedMoveDistanceMeters;
        }
        
        // Şekli hareket ettir (ana projeden uyarlanmış)
        function moveShapeWithDirection(shapeId, direction) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const shape = window.threeJsState.shapes.find(s => s.id === shapeId);
            if (!shape) return;
            
            // Hareket mesafesini hesapla
            const moveDistanceMeters = calculateMoveDistance();
            
            // Metre cinsinden mesafeyi derece cinsine çevir
            const geometry = shape.geometry;
            let currentLat = 0;
            
            // Mevcut pozisyonu al
            if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
                const coords = geometry.coordinates[0];
                if (coords.length > 0) {
                    currentLat = coords[0][1];
                }
            } else if (geometry.type === 'LineString' && geometry.coordinates && geometry.coordinates.length > 0) {
                currentLat = geometry.coordinates[0][1];
            } else if (geometry.type === 'Point' && geometry.coordinates) {
                currentLat = geometry.coordinates[1];
            }
            
            const degreesPerMeterLat = 1 / 111320;
            const degreesPerMeterLon = 1 / (111320 * Math.cos(currentLat * Math.PI / 180));
            
            const moveStepDegreesLat = moveDistanceMeters * degreesPerMeterLat;
            const moveStepDegreesLon = moveDistanceMeters * degreesPerMeterLon;
            
            let deltaLon = 0;
            let deltaLat = 0;
            
            switch (direction) {
                case 'up':
                    deltaLat = moveStepDegreesLat; // Kuzey (yukarı)
                    break;
                case 'down':
                    deltaLat = -moveStepDegreesLat; // Güney (aşağı)
                    break;
                case 'left':
                    deltaLon = -moveStepDegreesLon; // Batı (sol)
                    break;
                case 'right':
                    deltaLon = moveStepDegreesLon; // Doğu (sağ)
                    break;
            }
            
            // Arrow için özel işlem
            if (shape.type === 'arrow' && shape.geometry.line && shape.geometry.head) {
                // Arrow için line ve head geometry'lerini güncelle
                const newLineGeometry = JSON.parse(JSON.stringify(shape.geometry.line));
                const newHeadGeometry = JSON.parse(JSON.stringify(shape.geometry.head));
                
                if (newLineGeometry.type === 'LineString' && newLineGeometry.coordinates) {
                    newLineGeometry.coordinates = newLineGeometry.coordinates.map(coord => [
                        coord[0] + deltaLon,
                        coord[1] + deltaLat
                    ]);
                }
                
                if (newHeadGeometry.type === 'Polygon' && newHeadGeometry.coordinates && newHeadGeometry.coordinates[0]) {
                    newHeadGeometry.coordinates[0] = newHeadGeometry.coordinates[0].map(coord => [
                        coord[0] + deltaLon,
                        coord[1] + deltaLat
                    ]);
                }
                
                shape.geometry.line = newLineGeometry;
                shape.geometry.head = newHeadGeometry;
                
                // Arrow source'larını güncelle
                const lineSource = map.getSource(shapeId);
                const headSource = map.getSource(shapeId + '-head');
                
                if (lineSource && lineSource.type === 'geojson') {
                    lineSource.setData({
                        type: 'FeatureCollection',
                        features: [{ type: 'Feature', geometry: newLineGeometry, properties: {} }]
                    });
                }
                
                if (headSource && headSource.type === 'geojson') {
                    headSource.setData({
                        type: 'FeatureCollection',
                        features: [{ type: 'Feature', geometry: newHeadGeometry, properties: {} }]
                    });
                }
            } else if (shape.type === 'textbox') {
                // Textbox için box, pin ve text source'larını güncelle
                const textGeometry = shape.geometry;
                const newTextGeometry = JSON.parse(JSON.stringify(textGeometry));
                
                if (newTextGeometry.type === 'Point' && newTextGeometry.coordinates) {
                    newTextGeometry.coordinates = [
                        newTextGeometry.coordinates[0] + deltaLon,
                        newTextGeometry.coordinates[1] + deltaLat
                    ];
                }
                
                shape.geometry = newTextGeometry;
                
                // Textbox source'larını güncelle (box, pin, text)
                if (shape.boxSource) {
                    const boxSource = map.getSource(shape.boxSource);
                    if (boxSource && boxSource.type === 'geojson') {
                        const boxData = boxSource._data;
                        if (boxData && boxData.features && boxData.features[0]) {
                            const boxGeometry = boxData.features[0].geometry;
                            if (boxGeometry.type === 'Polygon' && boxGeometry.coordinates && boxGeometry.coordinates[0]) {
                                boxGeometry.coordinates[0] = boxGeometry.coordinates[0].map(coord => [
                                    coord[0] + deltaLon,
                                    coord[1] + deltaLat
                                ]);
                                boxSource.setData(boxData);
                            }
                        }
                    }
                }
                
                if (shape.pinSource) {
                    const pinSource = map.getSource(shape.pinSource);
                    if (pinSource && pinSource.type === 'geojson') {
                        const pinData = pinSource._data;
                        if (pinData && pinData.features && pinData.features[0]) {
                            const pinGeometry = pinData.features[0].geometry;
                            if (pinGeometry.type === 'Polygon' && pinGeometry.coordinates && pinGeometry.coordinates[0]) {
                                pinGeometry.coordinates[0] = pinGeometry.coordinates[0].map(coord => [
                                    coord[0] + deltaLon,
                                    coord[1] + deltaLat
                                ]);
                                pinSource.setData(pinData);
                            }
                        }
                    }
                }
                
                if (shape.textSource) {
                    const textSource = map.getSource(shape.textSource);
                    if (textSource && textSource.type === 'geojson') {
                        textSource.setData({
                            type: 'FeatureCollection',
                            features: [{ type: 'Feature', geometry: newTextGeometry, properties: { text: shape.text || 'Metin' } }]
                        });
                    }
                }
            } else {
                // Normal şekiller için (polygon, line, point, circle, etc.)
                let newGeometry = JSON.parse(JSON.stringify(geometry));
                
                if (newGeometry.type === 'Polygon' && newGeometry.coordinates && newGeometry.coordinates[0]) {
                    newGeometry.coordinates[0] = newGeometry.coordinates[0].map(coord => [
                        coord[0] + deltaLon,
                        coord[1] + deltaLat
                    ]);
                } else if (newGeometry.type === 'LineString' && newGeometry.coordinates) {
                    newGeometry.coordinates = newGeometry.coordinates.map(coord => [
                        coord[0] + deltaLon,
                        coord[1] + deltaLat
                    ]);
                } else if (newGeometry.type === 'Point' && newGeometry.coordinates) {
                    newGeometry.coordinates = [
                        newGeometry.coordinates[0] + deltaLon,
                        newGeometry.coordinates[1] + deltaLat
                    ];
                }
                
                // Shape metadata'yı güncelle
                shape.geometry = newGeometry;
                
                // Mapbox source'u güncelle (source ID = shapeId)
                const source = map.getSource(shapeId);
                if (source && source.type === 'geojson') {
                    const feature = {
                        type: 'Feature',
                        geometry: newGeometry,
                        properties: {}
                    };
                    source.setData({
                        type: 'FeatureCollection',
                        features: [feature]
                    });
                }
            }
            
            // Şekil listesini güncelle
            updateShapeList();
        }
        
        // Hareket kontrollerini kur
        function setupMovementControls(shapeId) {
            const upBtn = document.getElementById('move-up-btn');
            const downBtn = document.getElementById('move-down-btn');
            const leftBtn = document.getElementById('move-left-btn');
            const rightBtn = document.getElementById('move-right-btn');
            
            // Eski event listener'ları kaldır
            const newUpBtn = upBtn?.cloneNode(true);
            const newDownBtn = downBtn?.cloneNode(true);
            const newLeftBtn = leftBtn?.cloneNode(true);
            const newRightBtn = rightBtn?.cloneNode(true);
            
            if (upBtn && newUpBtn) {
                upBtn.parentNode?.replaceChild(newUpBtn, upBtn);
                newUpBtn.addEventListener('click', function() {
                    moveShapeWithDirection(shapeId, 'up');
                });
            }
            
            if (downBtn && newDownBtn) {
                downBtn.parentNode?.replaceChild(newDownBtn, downBtn);
                newDownBtn.addEventListener('click', function() {
                    moveShapeWithDirection(shapeId, 'down');
                });
            }
            
            if (leftBtn && newLeftBtn) {
                leftBtn.parentNode?.replaceChild(newLeftBtn, leftBtn);
                newLeftBtn.addEventListener('click', function() {
                    moveShapeWithDirection(shapeId, 'left');
                });
            }
            
            if (rightBtn && newRightBtn) {
                rightBtn.parentNode?.replaceChild(newRightBtn, rightBtn);
                newRightBtn.addEventListener('click', function() {
                    moveShapeWithDirection(shapeId, 'right');
                });
            }
        }
        
        // Keyboard event listeners (yön tuşları, Delete, ESC)
        function setupKeyboardHandlers() {
            document.addEventListener('keydown', function(e) {
                // Input alanında değilsek işle
                const isInputActive = document.activeElement && 
                    (document.activeElement.tagName === 'INPUT' || 
                     document.activeElement.tagName === 'TEXTAREA');
                
                if (isInputActive) return;
                
                // Delete/Backspace - Seçili modeli sil
                if ((e.key === 'Delete' || e.key === 'Backspace') && window.threeJsState.selectedModelLayer) {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteSelectedModel();
                    return;
                }
                
                // ESC - Seçimi kaldır
                if (e.key === 'Escape' && window.threeJsState.selectedModelLayer) {
                    e.preventDefault();
                    e.stopPropagation();
                    deselectModel();
                    return;
                }
                
                // Yön tuşları - Seçili modeli hareket ettir
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && 
                    window.threeJsState.selectedModelLayer) {
                    e.preventDefault();
                    e.stopPropagation();
                    moveModelWithArrowKeys(e.key);
                    return;
                }
            });
        }
        
        // Seçili modeli sil
        function deleteSelectedModel() {
            const map = window.threeJsState.map;
            if (!map || !window.threeJsState.selectedModelLayer) return;
            
            const layerId = window.threeJsState.selectedModelLayer;
            const markerId = layerId + '-marker';
            
            try {
                // Model layer'ını kaldır
                if (map.getLayer(layerId)) {
                    map.removeLayer(layerId);
                }
                
                // Marker layer'ını kaldır
                if (map.getLayer(markerId)) {
                    map.removeLayer(markerId);
                }
                
                // Source'ları kaldır
                if (map.getSource(markerId)) {
                    map.removeSource(markerId);
                }
                
                // State'ten temizle
                window.threeJsState.modelLayers = window.threeJsState.modelLayers.filter(id => id !== layerId);
                delete window.threeJsState.modelEntities[layerId];
                
                // Seçimi kaldır
                deselectModel();
                
                // React Native'e bildir
                window.sendToReactNative('model-deleted', {
                    layerId: layerId
                });
                
                console.log('[Model] Model deleted:', layerId);
            } catch (e) {
                console.error('[Model] Error deleting model:', e);
            }
        }
        
        // Yön tuşlarıyla model hareket ettir
        function moveModelWithArrowKeys(direction) {
            const map = window.threeJsState.map;
            if (!map || !window.threeJsState.selectedModelLayer) return;
            
            const layerId = window.threeJsState.selectedModelLayer;
            const modelEntity = window.threeJsState.modelEntities[layerId];
            if (!modelEntity) return;
            
            // Zoom seviyesine göre hareket mesafesi hesapla
            const zoom = map.getZoom();
            const lat = modelEntity.position.lat;
            
            // Mapbox'ta zoom seviyesinden yükseklik hesaplama (metre cinsinden)
            // Formül: 156543.03392 * cos(lat) / 2^zoom (metre cinsinden pixel başına mesafe)
            const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
            const cameraHeight = metersPerPixel * 256; // Yaklaşık kamera yüksekliği
            
            // Hareket mesafesi = kameranın yüksekliğinin %5'i
            // Min: 0.5m (50cm), Max: 500m
            const targetMoveDistanceMeters = cameraHeight * 0.05;
            const moveDistanceMeters = Math.max(0.5, Math.min(targetMoveDistanceMeters, 500));
            
            // Metre cinsinden mesafeyi derece cinsine çevir
            const degreesPerMeterLat = 1 / 111320;
            const degreesPerMeterLon = 1 / (111320 * Math.cos(lat * Math.PI / 180));
            
            const moveStepDegreesLat = moveDistanceMeters * degreesPerMeterLat;
            const moveStepDegreesLon = moveDistanceMeters * degreesPerMeterLon;
            
            let deltaLon = 0;
            let deltaLat = 0;
            
            switch (direction) {
                case 'ArrowUp':
                    deltaLat = moveStepDegreesLat; // Kuzey (yukarı)
                    break;
                case 'ArrowDown':
                    deltaLat = -moveStepDegreesLat; // Güney (aşağı)
                    break;
                case 'ArrowLeft':
                    deltaLon = -moveStepDegreesLon; // Batı (sol)
                    break;
                case 'ArrowRight':
                    deltaLon = moveStepDegreesLon; // Doğu (sağ)
                    break;
            }
            
            // Yeni pozisyon
            const newLng = modelEntity.position.lng + deltaLon;
            const newLat = modelEntity.position.lat + deltaLat;
            
            // Model pozisyonunu güncelle
            updateModelPosition(layerId, newLng, newLat);
        }
        
        // Model pozisyonunu güncelle
        function updateModelPosition(layerId, lng, lat) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const modelEntity = window.threeJsState.modelEntities[layerId];
            if (!modelEntity) return;
            
            // Yeni Mercator koordinatı
            const newMercator = window.mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
            const metersInMercator = newMercator.meterInMercatorCoordinateUnits();
            
            // Three.js model pozisyonunu güncelle
            if (modelEntity.model) {
                const scale = modelEntity.scale || 1.0;
                modelEntity.model.position.set(
                    newMercator.x,
                    newMercator.y,
                    newMercator.z
                );
                modelEntity.model.scale.set(
                    metersInMercator * scale,
                    metersInMercator * scale,
                    metersInMercator * scale
                );
            }
            
            // State'i güncelle
            modelEntity.position = { lng: lng, lat: lat };
            modelEntity.mercator = newMercator;
            modelEntity.metersInMercator = metersInMercator;
            
            // Marker pozisyonunu güncelle
            const markerId = layerId + '-marker';
            const markerSource = map.getSource(markerId);
            if (markerSource) {
                markerSource.setData({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    properties: {
                        modelLayerId: layerId
                    }
                });
            }
            
            // Haritayı render et
            map.triggerRepaint();
        }
        
        // Model scale'ini güncelle
        function updateModelScale(layerId, scale) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const modelEntity = window.threeJsState.modelEntities[layerId];
            if (!modelEntity) return;
            
            // Three.js model scale'ini güncelle
            if (modelEntity.model) {
                const metersInMercator = modelEntity.metersInMercator || modelEntity.mercator.meterInMercatorCoordinateUnits();
                modelEntity.model.scale.set(
                    metersInMercator * scale,
                    metersInMercator * scale,
                    metersInMercator * scale
                );
            }
            
            // State'i güncelle
            modelEntity.scale = scale;
            
            // Haritayı render et
            map.triggerRepaint();
        }
        
        // Model rotation'ını güncelle
        function updateModelRotation(layerId, rotationDeg) {
            const map = window.threeJsState.map;
            if (!map) return;
            
            const modelEntity = window.threeJsState.modelEntities[layerId];
            if (!modelEntity) return;
            
            // Three.js model rotation'ını güncelle
            if (modelEntity.model) {
                // Model zaten rotateX: Math.PI/2 ile döndürülmüş, sadece Z eksenini güncelle
                const THREE = window._threeJsDepsLoaded?.THREE;
                if (THREE) {
                    modelEntity.model.rotation.z = THREE.MathUtils.degToRad(rotationDeg);
                }
            }
            
            // State'i güncelle
            modelEntity.rotation = rotationDeg;
            
            // Haritayı render et
            map.triggerRepaint();
        }
        
        // Model slider'ları kur (zaten yukarıda event listener'lar eklendi, bu fonksiyon sadece kontrol için)
        function setupModelSliders() {
            // Slider'lar zaten yukarıda event listener'larla kuruldu
            // Bu fonksiyon sadece kontrol amaçlı
            console.log('[Model] Sliders setup completed');
        }
        
        // Initialize Mapbox (Three.js'i içinde başlatır)
        initMapbox();
        
        // Keyboard handler'ları kur
        setupKeyboardHandlers();
        
        // Model slider'ları kur (DOM hazır olduğunda)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(setupModelSliders, 100);
            });
        } else {
            setTimeout(setupModelSliders, 100);
        }
    </script>
</body>
</html>`;
}
