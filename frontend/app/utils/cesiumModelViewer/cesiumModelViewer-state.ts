/**
 * Cesium Model Viewer - State Management
 * Global state yönetimi fonksiyonları
 * 
 * threeJsModelViewer'daki window.threeJsState yapısından esinlenilmiştir.
 * Mapbox layer/source referansları kaldırılmış, Cesium Entity ID'leri kullanılmıştır.
 */

import type { CesiumState, DrawingMode, ModelType } from './cesiumModelViewer-types';

/**
 * State initialization seçenekleri
 */
export interface InitializeStateOptions {
  backendUrl: string; // Yeni API: https://nonpluralistic-timothy-resultingly.ngrok-free.dev/
  cesiumIonToken?: string;
  mapboxAccessToken?: string;
  googleMapsApiKey?: string;
}

/**
 * Global Cesium state'i başlat
 * threeJsModelViewer'daki initializeGlobalState() fonksiyonundan esinlenilmiştir
 */
export function initializeCesiumState(options: InitializeStateOptions): void {
  const { backendUrl, cesiumIonToken = '', mapboxAccessToken = '', googleMapsApiKey = '' } = options;

  // Global state object oluştur (CesiumState interface'ine uygun)
  (window as any).cesiumState = {
    // Cesium Viewer
    viewer: null, // Cesium.Viewer instance (sonra set edilecek)

    // Model Yönetimi
    selectedModel: null,
    selectedType: null,
    selectedFile: null,
    modelEntities: new Map<string, any>(), // Entity ID -> Cesium Entity mapping
    pendingPositions: [], // Model ekleme için bekleyen pozisyonlar
    previewEntities: [], // Preview için geçici Cesium Entity'ler

    // Çizim Modları
    drawingMode: null as DrawingMode,
    drawingStartPos: null,
    drawingPoints: [],
    ellipseAxes: [], // Elips çizimi için eksen noktaları

    // Şekiller
    shapes: [], // Çizilen şekiller
    selectedShape: null, // Seçili şekil ID
    selectedShapeEntityIds: [], // Seçili şeklin Cesium Entity ID'leri

    // Parsel
    parcelEntityIds: [], // Parsel için Cesium Polygon Entity ID'leri

    // Ölçüm
    measurementEntities: [], // Ölçüm için Cesium Entity ID'leri
    areaPreviewEntityId: null, // Alan ölçümü preview Entity ID
    rulerPoints: [], // Mesafe ölçümü noktaları [lon, lat]
    areaPoints: [], // Alan ölçümü noktaları [lon, lat]
  };

  // Backend URL ve token'ları global window'a kaydet
  (window as any).BACKEND_URL = backendUrl;
  (window as any).STATIC_URL = `${backendUrl}/static`;
  (window as any).CESIUM_ION_TOKEN = cesiumIonToken;
  (window as any).MAPBOX_ACCESS_TOKEN = mapboxAccessToken;
  (window as any).GOOGLE_MAPS_API_KEY = googleMapsApiKey;
}

/**
 * Cesium state'i döndür
 */
export function getCesiumState(): CesiumState | null {
  return (window as any).cesiumState || null;
}

/**
 * Cesium viewer instance'ını state'e kaydet
 */
export function setCesiumViewer(viewer: any): void {
  const state = getCesiumState();
  if (state) {
    state.viewer = viewer;
  }
}

/**
 * State'i sıfırla (tüm state'i temizle)
 */
export function resetCesiumState(): void {
  const state = getCesiumState();
  if (!state) return;

  state.viewer = null;
  state.selectedModel = null;
  state.selectedType = null;
  state.selectedFile = null;
  state.modelEntities.clear();
  state.pendingPositions = [];
  state.previewEntities = [];
  state.drawingMode = null;
  state.drawingStartPos = null;
  state.drawingPoints = [];
  state.ellipseAxes = [];
  state.shapes = [];
  state.selectedShape = null;
  state.selectedShapeEntityIds = [];
  state.parcelEntityIds = [];
  state.measurementEntities = [];
  state.areaPreviewEntityId = null;
  state.rulerPoints = [];
  state.areaPoints = [];
}

/**
 * Çizim state'ini temizle
 */
export function clearDrawingState(): void {
  const state = getCesiumState();
  if (!state) return;

  state.drawingMode = null;
  state.drawingStartPos = null;
  state.drawingPoints = [];
  state.ellipseAxes = [];
}

/**
 * Model state'ini temizle
 */
export function clearModelState(): void {
  const state = getCesiumState();
  if (!state) return;

  state.selectedModel = null;
  state.selectedType = null;
  state.selectedFile = null;
  state.modelEntities.clear();
  state.pendingPositions = [];
  state.previewEntities = [];
}

/**
 * Şekil state'ini temizle
 */
export function clearShapeState(): void {
  const state = getCesiumState();
  if (!state) return;

  state.shapes = [];
  state.selectedShape = null;
  state.selectedShapeEntityIds = [];
}

/**
 * Ölçüm state'ini temizle
 */
export function clearMeasurementState(): void {
  const state = getCesiumState();
  if (!state) return;

  state.measurementEntities = [];
  state.areaPreviewEntityId = null;
  state.rulerPoints = [];
  state.areaPoints = [];
}

/**
 * Parsel state'ini temizle
 */
export function clearParcelState(): void {
  const state = getCesiumState();
  if (!state) return;

  state.parcelEntityIds = [];
}

/**
 * State'i güncelle (partial update)
 */
export function updateCesiumState(updates: Partial<CesiumState>): void {
  const state = getCesiumState();
  if (!state) return;

  Object.assign(state, updates);
}

/**
 * Model entity ekle
 */
export function addModelEntity(entityId: string, entity: any): void {
  const state = getCesiumState();
  if (!state) return;

  state.modelEntities.set(entityId, entity);
}

/**
 * Model entity kaldır
 */
export function removeModelEntity(entityId: string): void {
  const state = getCesiumState();
  if (!state) return;

  state.modelEntities.delete(entityId);
}

/**
 * Şekil ekle
 */
export function addShape(shape: any): void {
  const state = getCesiumState();
  if (!state) return;

  state.shapes.push(shape);
}

/**
 * Şekil kaldır
 */
export function removeShape(shapeId: string): void {
  const state = getCesiumState();
  if (!state) return;

  state.shapes = state.shapes.filter((s: any) => s.id !== shapeId);
  if (state.selectedShape === shapeId) {
    state.selectedShape = null;
    state.selectedShapeEntityIds = [];
  }
}

/**
 * Ölçüm entity ekle
 */
export function addMeasurementEntity(entityId: string): void {
  const state = getCesiumState();
  if (!state) return;

  if (!state.measurementEntities.includes(entityId)) {
    state.measurementEntities.push(entityId);
  }
}

/**
 * Ölçüm entity kaldır
 */
export function removeMeasurementEntity(entityId: string): void {
  const state = getCesiumState();
  if (!state) return;

  state.measurementEntities = state.measurementEntities.filter((id: string) => id !== entityId);
}

/**
 * Parsel entity ekle
 */
export function addParcelEntity(entityId: string): void {
  const state = getCesiumState();
  if (!state) return;

  if (!state.parcelEntityIds.includes(entityId)) {
    state.parcelEntityIds.push(entityId);
  }
}

/**
 * Parsel entity kaldır
 */
export function removeParcelEntity(entityId: string): void {
  const state = getCesiumState();
  if (!state) return;

  state.parcelEntityIds = state.parcelEntityIds.filter((id: string) => id !== entityId);
}
