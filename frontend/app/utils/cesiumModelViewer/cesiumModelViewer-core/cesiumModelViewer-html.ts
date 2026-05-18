/**
 * Cesium Model Viewer - HTML Structure and CSS Styles
 * HTML yapısı ve CSS stilleri
 *
 * threeJsModelViewer'daki HTML yapısı ve CSS stillerinden esinlenilmiştir.
 * Mapbox referansları kaldırılmış, Cesium container (#cesium-viewer-container) için uyarlanmıştır.
 */

/**
 * HTML yapısını oluştur
 * threeJsModelViewer'daki HTML yapısından esinlenilmiştir
 */
export function generateHTMLStructure(): string {
  return `
    <div class="model-viewer-container">
        <div class="viewer-header">
            <div class="viewer-title">3D Model Ekleme</div>
            <button class="close-btn" id="close-btn">Kapat</button>
        </div>
        
        <!-- Toolbar Menu -->
        <div class="toolbar-menu">
            <div class="toolbar-item">
                <button class="toolbar-btn" id="select-parcel-btn" title="Haritadan Parsel Seç">
                    📍 Parsel
                </button>
            </div>
            <div class="toolbar-item dropdown">
                <button class="toolbar-btn" id="measurement-menu-btn" title="Ölçüm Araçları">
                    📏 Ölçüm
                </button>
                <div class="dropdown-menu" id="measurement-dropdown">
                    <button id="measure-distance-btn" class="dropdown-item" title="Mesafe Ölç">
                        📏 Mesafe Ölç
                    </button>
                    <button id="measure-area-btn" class="dropdown-item" title="Alan Ölç">
                        📐 Alan Ölç
                    </button>
                    <button id="clear-measurements-btn" class="dropdown-item" title="Ölçümleri Temizle">
                        🗑️ Ölçümleri Temizle
                    </button>
                </div>
            </div>
            <div class="toolbar-item dropdown">
                <button class="toolbar-btn" id="shape-menu-btn" title="Şekil Çizim Araçları">
                    🔷 Şekil
                </button>
                <div class="dropdown-menu" id="shape-dropdown">
                    <div class="shape-toolbar">
                        <button id="shape-rectangle-btn" class="dropdown-item shape-btn" data-shape="rectangle" title="Kare/Dikdörtgen">
                            ⬜ Kare
                        </button>
                        <button id="shape-triangle-btn" class="dropdown-item shape-btn" data-shape="triangle" title="Üçgen">
                            🔺 Üçgen
                        </button>
                        <button id="shape-circle-btn" class="dropdown-item shape-btn" data-shape="circle" title="Yuvarlak">
                            ⭕ Yuvarlak
                        </button>
                        <button id="shape-ellipse-btn" class="dropdown-item shape-btn" data-shape="ellipse" title="Elips">
                            🔵 Elips
                        </button>
                        <button id="shape-polygon-btn" class="dropdown-item shape-btn" data-shape="polygon" title="Çokgen">
                            🔷 Çokgen
                        </button>
                        <button id="shape-line-btn" class="dropdown-item shape-btn" data-shape="line" title="Çizgi">
                            ➖ Çizgi
                        </button>
                        <button id="shape-arrow-btn" class="dropdown-item shape-btn" data-shape="arrow" title="Ok">
                            ➡️ Ok
                        </button>
                        <button id="shape-marker-btn" class="dropdown-item shape-btn" data-shape="marker" title="Nokta">
                            📍 Nokta
                        </button>
                        <button id="shape-textbox-btn" class="dropdown-item shape-btn" data-shape="textbox" title="Metin Kutusu">
                            📝 Metin
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="viewer-body">
            <!-- Cesium Container -->
            <div class="map-container">
                <div id="cesium-viewer-container"></div>
                
                <!-- Alan ölçümü tamamla butonu -->
                <button id="area-finish-btn" class="area-finish-button" style="display: none;" title="Alan Ölçümünü Tamamla">
                    ✓ Tamamla
                </button>
                
                <div class="loading-overlay" id="loading-overlay">
                    <div style="font-size: 16px; margin-bottom: 8px;">Cesium yükleniyor...</div>
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
  `;
}

/**
 * CSS stillerini oluştur
 * threeJsModelViewer'daki CSS stillerinden esinlenilmiştir
 * Mapbox referansları kaldırılmış, Cesium container için uyarlanmıştır
 */
export function generateCSSStyles(): string {
  return `
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
        
        .toolbar-menu {
            background: #1e293b;
            padding: 8px 16px;
            border-bottom: 1px solid #3b82f6;
            display: flex;
            gap: 8px;
            align-items: center;
            z-index: 10000;
            position: relative;
        }
        
        .toolbar-item {
            position: relative;
            z-index: 10000;
        }
        
        .toolbar-item.dropdown {
            z-index: 10001;
        }
        
        .toolbar-btn {
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(59, 130, 246, 0.5);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
            white-space: nowrap;
            pointer-events: auto;
            position: relative;
            z-index: 10002;
        }
        
        .toolbar-btn:hover {
            background: rgba(59, 130, 246, 0.3);
            border-color: #3b82f6;
        }
        
        .toolbar-btn.active {
            background: rgba(59, 130, 246, 1);
            border-color: #3b82f6;
            box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
        }
        
        .dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 8px;
            padding: 8px;
            min-width: 180px;
            max-width: 250px;
            max-height: calc(100vh - 200px);
            overflow-y: auto;
            display: none;
            flex-direction: column;
            gap: 4px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            margin-top: 4px;
            pointer-events: auto;
        }
        
        .dropdown-menu.active {
            display: flex;
        }
        
        .dropdown-menu::-webkit-scrollbar {
            width: 6px;
        }
        
        .dropdown-menu::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.5);
            border-radius: 3px;
        }
        
        .dropdown-menu::-webkit-scrollbar-thumb {
            background: rgba(59, 130, 246, 0.6);
            border-radius: 3px;
        }
        
        .dropdown-menu::-webkit-scrollbar-thumb:hover {
            background: rgba(59, 130, 246, 0.8);
        }
        
        .dropdown-item {
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: white;
            padding: 10px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            text-align: left;
            transition: all 0.2s ease;
            width: 100%;
        }
        
        .dropdown-item:hover {
            background: rgba(59, 130, 246, 0.3);
            border-color: #3b82f6;
        }
        
        .dropdown-item.active {
            background: rgba(59, 130, 246, 1);
            border-color: #3b82f6;
        }
        
        .dropdown-menu .shape-toolbar {
            display: flex;
            flex-direction: column;
            gap: 4px;
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
            
            .toolbar-menu {
                padding: 6px 8px;
                gap: 4px;
                overflow-x: auto;
            }
            
            .toolbar-btn {
                padding: 6px 12px;
                font-size: 12px;
            }
            
            .dropdown-menu {
                max-width: 200px;
                max-height: calc(100vh - 150px);
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
        
        #cesium-viewer-container {
            width: 100% !important;
            height: 100% !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 1 !important;
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
        
        .control-btn.active {
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
  `;
}
