/**
 * ProParcel Pro Mod ve Basit Mod Çıktı Tipleri
 * 
 * Bu dosya, iki farklı endpoint'in döndürdüğü veri yapılarını tanımlar:
 * 
 * ============================================================================
 * BASİT MOD (TKGM View) - /api/tkgm_view/
 * ============================================================================
 * - Endpoint: /api/tkgm_view/
 * - Backend: myapp/views/parcel.py -> tkgm_view()
 * - Açıklama: TKGM'den gelen ham GeoJSON verisi
 * - Response Yapısı:
 *   {
 *     "geometry": GeoJSONGeometry,
 *     "properties": TkgmProperties,
 *     "type": "Feature" (opsiyonel)
 *   }
 * - İçerik:
 *   - Sadece TKGM'den gelen temel parsel bilgileri (ada, parsel, mahalle, alan, vb.)
 *   - geometry: Parsel polygon geometrisi
 *   - properties: TKGM properties (adaNo, parselNo, mahalleAd, ilceAd, ilAd, alan, nitelik, durum, vb.)
 *   - Opsiyonel: NearCommercialRoadInfo (yol bilgisi)
 * - Fiyat bilgisi: YOK
 * 
 * ============================================================================
 * PRO MOD (Get Parcel Info) - /api/get_parcel_info/
 * ============================================================================
 * - Endpoint: /api/get_parcel_info/
 * - Backend: myapp/scripts/core/process_polygon_yeni.py -> process_polygon()
 * - Açıklama: Tam analiz sonuçları (fiyatlandırma, değerleme, yol analizi, vb.)
 * - Response Yapısı:
 *   {
 *     "parameters_graphics": GraphicsData,
 *     "parameters_polygons": PolygonsData,
 *     "parameters_data": ParametersData,
 *     "geometry": GeoJSONGeometry (opsiyonel),
 *     "properties": Record<string, any> (opsiyonel)
 *   }
 * - İçerik:
 *   - parameters_graphics: 3D grafik verileri (eğim, yükselti)
 *   - parameters_polygons: Tüm katman poligonları (yollar, su, elektrik, sınırlar, vb.)
 *   - parameters_data: Analiz verileri ve özet bilgiler
 *     - parcel_values: Parsel değerleri (FİYAT BİLGİLERİ BURADA)
 *     - road_values: Yol analizi
 *     - valuation_steps: Değerleme adımları
 *     - grid_values: Satış grid analizi
 *     - vb.
 * - Fiyat bilgisi: EVET (parameters_data.parcel_values içinde)
 * 
 * ============================================================================
 * KULLANIM NOTLARI
 * ============================================================================
 * 1. Basit Mod: Sadece geometry ve properties döner (fiyat yok)
 * 2. Pro Mod: Kompleks yapı döner (fiyat bilgileri var)
 * 3. Her iki modda da geometry ve properties alanları mevcut, ancak içerikleri farklı
 * 4. Pro Mod'da geometry genellikle parameters_polygons.parcel_polygon içinde
 * 5. Basit Mod'da geometry doğrudan response'un kökünde
 * 
 * Backend Kaynakları:
 * - Pro Mod: myapp/scripts/core/process_polygon_yeni.py
 * - Basit Mod: myapp/views/parcel.py -> tkgm_view()
 * 
 * Dökümantasyon: myapp/static/docs/backend/process_polygon.md
 */

// ============================================================================
// Basit Mod (TKGM View) Response Yapısı
// ============================================================================

/**
 * Basit Mod Response - /api/tkgm_view/ endpoint'i
 * TKGM'den gelen ham GeoJSON verisi
 */
export interface TkgmViewResponse {
  geometry: GeoJSONGeometry;
  properties: TkgmProperties;
  type?: 'Feature'; // GeoJSON Feature tipi
}

/**
 * TKGM Properties - Basit modda gelen properties alanları
 */
export interface TkgmProperties {
  // Parsel bilgileri
  adaNo?: string | null;
  parselNo?: string | null;
  ada?: string | null;
  parsel?: string | null;
  mahalleAd?: string | null;
  ilceAd?: string | null;
  ilAd?: string | null;
  alan?: string | number | null;
  nitelik?: string | null;
  durum?: string | null;
  ozet?: string | null;
  pafta?: string | null;
  mevkii?: string | null;
  
  // ID bilgileri
  mahalleId?: number | null;
  tkgm_value?: number | null;
  QuarterIdFinal?: number | null;
  Proparcel_value?: number | null;
  proparcel_value?: number | null;
  QuarterTypeName?: string | null;
  
  // Sınır ve yol bilgileri
  BoundaryBirincilYapi?: boolean | null;
  NearCommercial?: boolean | null;
  NearCommercialRoadInfo?: any | null; // Yol bilgileri objesi
  
  // Query bilgileri
  QueryId?: string | null;
  
  // Eksik katman bilgileri
  QuarterFeaturesMissing?: string[] | null;
  
  // Diğer alanlar
  [key: string]: any;
}

// ============================================================================
// Pro Mod Response Yapısı
// ============================================================================

/**
 * Pro Mod Response - /api/get_parcel_info/ endpoint'i
 * Tam analiz sonuçları (parameters_graphics, parameters_polygons, parameters_data)
 */
export interface ProParcelResponse {
  parameters_graphics?: GraphicsData;
  parameters_polygons?: PolygonsData;
  parameters_data?: ParametersData;
  geometry?: GeoJSONGeometry; // Opsiyonel (bazı durumlarda parameters_polygons.parcel_polygon içinde)
  properties?: Record<string, any>; // Opsiyonel (TKGM verisi ile birlikte gelebilir)
}

/**
 * Union Type: Hem Pro Mod hem Basit Mod response'ları destekler
 */
export type ParcelResponse = ProParcelResponse | TkgmViewResponse;

// ============================================================================
// Graphics Data
// ============================================================================

export interface GraphicsData {
  parcel_slope_graphics?: any;
  slope_surface?: any; // parcel_slope_graphics'in JSON-serileştirilebilir kopyası
  parcel_elevation_view?: any;
  quarter_elevation_view?: any;
}

// ============================================================================
// Polygons Data
// ============================================================================

export interface PolygonsData {
  quarter_polygon?: GeoJSONFeature;
  grid_multipolygon?: GeoJSONFeature;
  clipped_roads_multilinestring?: GeoJSONFeature;
  clipped_waterway_multilinestring?: GeoJSONFeature;
  clipped_electric_multilinestring?: GeoJSONFeature;
  clipped_railway_multilinestring?: GeoJSONFeature;
  clipped_sit_polygon?: GeoJSONFeature;
  clipped_sulakkoruma_polygon?: GeoJSONFeature;
  clipped_millpark_polygon?: GeoJSONFeature;
  clipped_see_polygon?: GeoJSONFeature;
  clipped_compass?: GeoJSONFeature;
  water_polygon?: GeoJSONFeature;
  centroid_point?: GeoJSONFeature;
  boundary_polygon?: GeoJSONFeature;
  parcel_polygon?: GeoJSONFeature;
  parcel_slope_poly_0_20?: GeoJSONFeature;
  parcel_slope_poly_20_30?: GeoJSONFeature;
  parcel_slope_poly_over_30?: GeoJSONFeature;
  quarter_elev_poly_1_4?: GeoJSONFeature;
  quarter_elev_poly_4_10?: GeoJSONFeature;
  quarter_elev_poly_over_10?: GeoJSONFeature;
  quarter_elev_poly_below_avg?: GeoJSONFeature;
  quarter_elev_poly_above_avg?: GeoJSONFeature;
  quarter_slope_poly_0_20?: GeoJSONFeature;
  quarter_slope_poly_20_30?: GeoJSONFeature;
  quarter_slope_poly_over_30?: GeoJSONFeature;
  nearest_road_field?: GeoJSONFeature;
  nearest_road_field_connector?: GeoJSONFeature;
  parcel_elevation_view_all?: GeoJSONFeature;
  parcel_elevation_view_categories?: GeoJSONFeature;
  quarter_elevation_view_all?: GeoJSONFeature;
  quarter_elevation_view_categories?: GeoJSONFeature;
  parcel_slope?: ParcelSlopeData;
  quarter_slope?: QuarterSlopeData;
}

export interface GeoJSONFeature {
  type: 'Feature' | 'FeatureCollection';
  geometry?: GeoJSONGeometry;
  properties?: Record<string, any>;
  features?: GeoJSONFeature[];
}

export interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  coordinates: any;
}

export interface ParcelSlopeData {
  polygon?: {
    '0_20'?: GeoJSONFeature;
    '20_30'?: GeoJSONFeature;
    'over_30'?: GeoJSONFeature;
  };
}

export interface QuarterSlopeData {
  polygon?: {
    '0_20'?: GeoJSONFeature;
    '20_30'?: GeoJSONFeature;
    'over_30'?: GeoJSONFeature;
  };
}

// ============================================================================
// Parameters Data - Ana Container
// ============================================================================

export interface ParametersData {
  // Parsel temel bilgileri
  parcel_values?: ParcelValues;
  
  // Yol analizi
  road_values?: RoadValue[];
  road_selected?: RoadSelected | null;
  road_frontage_values?: RoadFrontageValues | null;
  road_direction_values?: RoadDirectionValues;
  
  // Mesafe analizleri
  boundary_values?: BoundaryValues;
  center_values?: CenterValues;
  water_values?: WaterValues;
  waterway_values?: WaterwayValues;
  railway_values?: RailwayValues;
  ramsar_values?: RamsarValues;
  
  // Elektrik ve deniz
  electric_values?: ElectricValues;
  see_values?: SeeValues;
  
  // Grid analizi
  grid_values?: GridValues;
  
  // Eğim ve yükseklik
  parcel_slope_values?: SlopeValues;
  quarter_slope_values?: SlopeValues | null;
  quarter_elevation_values?: ElevationValues | null;
  
  // Değerleme
  valuation_steps?: ValuationStep[];
  price_steps_dfa?: any[]; // Ham DFA adımları
  
  // Mahalle bilgileri
  quarter_id?: number | null;
  quarter_name?: string | null;
  proparcel_value?: number;
  province_orientation_r1?: string | null;
  quarter_info?: QuarterInfo;
  quarter_features?: QuarterFeatures;
  
  // Fiyat analizi
  km_recommended_price?: string | number | null;
  km_analysis?: KmAnalysis | {};
  neighbor_recommendations?: NeighborRecommendation[];
  price_selection?: PriceSelection | null;
  
  // AI ve tahmin
  prediction_data?: PredictionData | null;
  elevation_morphology?: ElevationMorphology | null;
  
  // Skorlar
  serefiyescore?: SerefiyeScore | null;
  
  // Progress
  valuation_progress?: ValuationProgress[];
  
  // TKGM verisi
  tkgm_data?: TkgmData | null;
  
  // Ticari alan yakınlığı
  near_commercial?: boolean | null;
  near_commercial_road_info?: any[] | null;
  
  // Opsiyonel eksik katmanlar
  optional_missing_features?: string[];
  optional_missing_features_message?: string;
}

// ============================================================================
// Parcel Values - En Detaylı Interface
// ============================================================================

export interface ParcelValues {
  // 💰 Fiyatlandırma bilgileri (Türk formatı: "1.234,56")
  unite_price?: string | null;
  price_of_tarla?: string | null;
  quarter_uniteprice?: string | null;
  quarter_uniteprice_verified?: boolean | null;
  quarter_uniteprice_source?: string | null;
  quarter_uniteprice_source_label?: string | null;
  quarter_uniteprice_median?: string | null;
  quarter_uniteprice_km_estimated?: string | null;
  diffPercentOfPrice?: string | null;
  
  // 🎯 Görünüm analizi
  view_primary_overlap_ratio?: number;
  view_r1_overlap_ratio?: number;
  view_primary_overlap_percent?: number | null;
  view_r1_overlap_percent?: number | null;
  view_discount_multiplier?: number | null;
  view_reason?: string | null;
  
  // 🌊 Deniz analizi
  see_discount_multiplier?: number | null;
  see_reason?: string | null;
  
  // 📍 Konum ve hedef bilgileri
  test_Point_Target?: [number, number];
  
  // 🎯 Görüş analizi
  view_to_center_is?: boolean | null;
  view_to_center_str?: string | null;
  view_to_see_is?: boolean | null;
  view_to_see_str?: string | null;
  
  // 🏔️ Eğim ve yükseklik
  parcel_center_slope?: number | null;
  parcel_elevation?: number | null;
  
  // ✅ Durum bilgisi
  parcel_isExist?: boolean;
  
  // 🧭 Tür tespiti özet
  property_type_detected?: string | null;
  property_type_requires_user?: boolean | null;
  koyici_detected?: boolean | null;
  property_type_override?: string | null;
  
  // 📏 Kenar uzunlukları ve çevre
  parcel_edge_lengths_m?: number[];
  perimeter_m?: number;
  
  // 📐 Kenar grup uzunlukları (aynı hatlar toplanmış)
  parcel_edge_group_lengths_m?: number[];
  parcel_edge_groups?: EdgeGroup[];
  
  // 📦 Kenar ölçüm bilgisi (BBox tabanlı, 3D bina çizimi için)
  edge_measure_data?: EdgeMeasureData | null;
  parcel_main_edges?: ParcelMainEdge[] | null;
  
  // 📍 Parsel koordinatları (lazy loading için gerekli)
  parcel_coords_lonlat?: [number, number][];
  
  // TKGM Props alanları
  ilceAd?: string | null;
  mevkii?: string | null;
  parselNo?: string | null;
  adaNo?: string | null;
  mahalleAd?: string | null;
  tkgm_value?: number | null;
  ilAd?: string | null;
  durum?: string | null;
  nitelik?: string | null;
  alan?: string | number | null;
  ozet?: string | null;
  pafta?: string | null;
  Proparcel_value?: number | null;
  proparcel_value?: number | null;
  QuarterTypeName?: string | null;
  
  // Eski/Alternatif alan adları (geriye dönük uyumluluk)
  Area?: string | number | null;
  area?: string | number | null;
  Ada?: string | null;
  ada?: string | null;
  Parsel?: string | null;
  parsel?: string | null;
  KYM_M2Price?: string | number | null;
  M2Price?: string | number | null;
  m2_price?: string | number | null;
  m2Price?: string | number | null;
  M2_Price?: string | number | null;
  estimated_price?: string | number | null;
  birim_fiyat?: string | number | null;
  BirimFiyat?: string | number | null;
  birimFiyat?: string | number | null;
  unitPrice?: string | number | null;
  unit_price?: string | number | null;
  pricePerSquareMeter?: string | number | null;
  price_per_square_meter?: string | number | null;
  TotalPrice?: string | number | null;
  total_price?: string | number | null;
  toplam_fiyat?: string | number | null;
  ToplamFiyat?: string | number | null;
  totalPrice?: string | number | null;
  estimatedTotalPrice?: string | number | null;
  estimated_total_price?: string | number | null;
}

// ============================================================================
// Yol Analizi
// ============================================================================

export interface RoadValue {
  id?: number;
  road_type?: string;
  road_type_index?: number;
  distance?: number;
  roadConnection?: boolean;
  road_parcel_is_frontage?: boolean;
  road_face?: boolean;
  road_access?: boolean;
  [key: string]: any;
}

export interface RoadSelected {
  id?: number;
  road_type?: string;
  road_type_index?: number;
  distance?: number;
  roadConnection?: boolean;
  road_parcel_is_frontage?: boolean;
  [key: string]: any;
}

export interface RoadFrontageValues {
  frontage_label?: string;
  frontage_count?: number;
  [key: string]: any;
}

export interface RoadDirectionValues {
  frontage_count?: number;
  directions?: string[];
  directions_total?: string[];
  by_road?: any[];
  directions_connected?: any[];
}

// ============================================================================
// Mesafe Analizleri
// ============================================================================

export interface BoundaryValues {
  boundary_dist?: number | null;
  boundary_target?: any;
  boundary_isExist?: boolean | null;
  boundary_elevation?: number | null;
  inside_non_primary_boundary?: boolean | null;
}

export interface CenterValues {
  view_to_center_is?: boolean | null;
  view_to_center_str?: string | null;
  centroid_dist?: number | null;
  centroid_isExist?: boolean | null;
  quarter_dist?: number | null;
}

export interface WaterValues {
  water_dist?: number | null;
  water_isExist?: boolean | null;
}

export interface WaterwayValues {
  waterway_dist?: number | null;
  waterway_isExist?: boolean | null;
}

export interface RailwayValues {
  nearest_distance_m?: number | null;
}

export interface RamsarValues {
  is_ramsar?: boolean | null;
  ramsar_name?: string | null;
}

// ============================================================================
// Elektrik ve Deniz
// ============================================================================

export interface ElectricValues {
  electric_area?: string | number | null;
  electric_line?: any;
  electric_isExist?: boolean | null;
  KW?: number | null;
}

export interface SeeValues {
  see_dist?: number | null;
  see_isExist?: boolean | null;
  see_flag?: number | null;
  see_polygon_overlap_ratio?: number | null;
  [key: string]: any;
}

// ============================================================================
// Grid Analizi
// ============================================================================

export interface GridValues {
  test_point_score?: number | null;
  test_point_oldScore?: number | null;
  score_isExist?: boolean | null;
  sales_count_by_year?: Record<string, number> | null;
}

// ============================================================================
// Eğim ve Yükseklik
// ============================================================================

export interface SlopeValues {
  slope_0_20_percent?: number | null;
  slope_20_30_percent?: number | null;
  slope_over_30_percent?: number | null;
  average_slope?: number | null;
  [key: string]: any;
}

export interface ElevationValues {
  elevation_min?: number | null;
  elevation_max?: number | null;
  elevation_avg?: number | null;
  [key: string]: any;
}

// ============================================================================
// Değerleme Adımları
// ============================================================================

export interface ValuationStep {
  step_key?: string;
  step_title?: string;
  pct?: number;
  trend?: string;
  factor?: number;
  raw_factor?: number;
  prev_avg?: number;
  new_avg?: number;
  prev_total?: number;
  new_total?: number;
  details?: string;
  [key: string]: any;
}

// ============================================================================
// Mahalle Bilgileri
// ============================================================================

export interface QuarterInfo {
  [key: string]: any;
}

export interface QuarterFeatures {
  see?: number;
  [key: string]: any;
}

// ============================================================================
// Fiyat Analizi
// ============================================================================

export interface KmAnalysis {
  [key: string]: any;
}

export interface NeighborRecommendation {
  proparcel?: number;
  mahalle?: string;
  ilce?: string;
  il?: string;
  combined_score?: number;
  m2_price?: number;
  m2_price_text?: string;
  [key: string]: any;
}

export interface PriceSelection {
  reason?: string | null;
  model?: string | null;
  details?: any;
}

// ============================================================================
// AI ve Tahmin
// ============================================================================

export interface PredictionData {
  [key: string]: any;
}

export interface ElevationMorphology {
  morphology_type?: string;
  morphology_type_index?: number;
  direction_advantage?: string;
  direction_advantage_deg?: number;
  [key: string]: any;
}

// ============================================================================
// Skorlar
// ============================================================================

export interface SerefiyeScore {
  total_points?: number;
  max_points?: number;
  percent?: number;
  breakdown?: Record<string, any>;
}

// ============================================================================
// Progress
// ============================================================================

export interface ValuationProgress {
  step_id?: string;
  phase?: string;
  message?: string;
  timestamp?: string;
  meta?: any;
}

// ============================================================================
// TKGM Verisi
// ============================================================================

export interface TkgmData {
  geometry?: GeoJSONGeometry;
  properties?: Record<string, any>;
  Nitelik?: string | null;
}

// ============================================================================
// Kenar Ölçümleri
// ============================================================================

export interface EdgeGroup {
  start_index?: number;
  end_index?: number;
  sum_m?: number;
  mean_bearing_deg?: number;
  segments?: any[];
}

export interface EdgeMeasureData {
  bbox?: {
    center?: [number, number];
    rotation_deg?: number;
    width_m?: number;
    height_m?: number;
  };
  main_edges?: any[];
  [key: string]: any;
}

export interface ParcelMainEdge {
  bbox_edge?: string;
  lengthMeters?: number;
  mid?: {
    lon?: number;
    lat?: number;
  };
}

// ============================================================================
// Component Data Types
// ============================================================================

/**
 * Parsel Data - Component state'inde kullanılan parsel verisi
 */
export interface ParcelData {
  geometry?: GeoJSONGeometry | null;
  properties?: Record<string, any>;
  analysisData?: ProParcelResponse | null; // Sadece Pro Mod için
}

