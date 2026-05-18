/**
 * Shape Drawing Types
 * Şekil çizim tip tanımları
 */

/**
 * Şekil tipi
 */
export type ShapeType =
  | "rectangle"
  | "triangle"
  | "circle"
  | "ellipse"
  | "polygon"
  | "line"
  | "arrow"
  | "marker"
  | "textbox"
  | "pen"
  | "freehand";

/**
 * Çizim modu
 */
export type DrawingMode = ShapeType | null;

/**
 * Şekil özellikleri
 */
export interface ShapeProperties {
  id: string; // Unique shape ID
  type: ShapeType;
  geometry: GeoJSON.Geometry; // GeoJSON geometry
  outlineColor?: string; // Hex color (örn: "#3b82f6")
  fillColor?: string; // Hex color
  outlineWidth?: number;
  fillOpacity?: number;
  text?: string; // Textbox için metin içeriği
  arrowHead?: GeoJSON.Polygon; // Arrow için ok başı geometry
  rotation?: number; // Döndürme açısı (derece cinsinden, 0-360)
  /**
   * true: LineString koordinatları normalize edilmiş ekran konumu [0–1] (ekrana çiz).
   * Harita katmanında çizilmez; ScreenShapesOverlay ile gösterilir.
   */
  screenSpace?: boolean;
  [key: string]: any; // Ek özellikler için
}

/**
 * Şekil düzenleme handle tipleri
 */
export type ShapeHandleType =
  | "move"
  | "scale" // generic scale (uniform)
  | "rotate"
  | "vertex" // polygon/triangle vertex edit
  | "endpoint" // line/arrow endpoints
  | "radius" // circle radius
  | "axisX" // ellipse axis X
  | "axisY" // ellipse axis Y
  | "textboxScale"; // textbox corner scale (non-uniform may be supported)

/**
 * Harita üzerindeki bir handle tanımı
 * Not: handle pozisyonu lng/lat koordinatıdır.
 */
export interface ShapeHandle {
  id: string;
  type: ShapeHandleType;
  position: [number, number];
  /**
   * vertex/endpoint gibi handle'lar için indeks bilgisi
   */
  vertexIndex?: number;
  endpointIndex?: 0 | 1;
  /**
   * scale handle'ları için opsiyonel rol/metaveri
   */
  role?: "corner" | "edge" | "center";
}

/**
 * Şekil çizim seçenekleri
 */
export interface DrawShapeOptions {
  outlineColor?: string; // Hex color (default: "#3b82f6")
  fillColor?: string; // Hex color (default: "#3b82f6")
  outlineWidth?: number; // Default: 2
  fillOpacity?: number; // Default: 0.5
  text?: string; // Textbox için metin
}
