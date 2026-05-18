/**
 * Portal Son 30 Gün Sorgular – Tip Tanımları
 *
 * API endpoints:
 *   GET /api/portal/locations/
 *   GET /api/portal/recent-queries/
 *   GET /api/portal/recent-queries/<id>/
 *   GET /api/portal/recent-queries/<id>/report/
 */

// ── Locations ──

export interface PortalLocationItem {
  id: number;
  name: string;
  count: number;
}

export interface PortalLocationsResponse {
  cities?: PortalLocationItem[];
  towns?: PortalLocationItem[];
  quarters?: PortalLocationItem[];
}

// ── Query List ──

export interface PortalQueryListItem {
  snapshot_id: number;
  favorite_count_total?: number | null;
  city_id: number | null;
  town_id: number | null;
  quarter_id: number | null;
  proparcel_value: string | null;
  title: string | null;
  quarter_name: string | null;
  ada: string | null;
  parsel: string | null;
  query_type: string;
  area_m2: number | null;
  unit_price: number | null;
  total_price: number | null;
  created_at: string | null;
  updated_at: string | null;
  thumbnail_url: string | null;
  has_expert_request: boolean;
  expert_status: string | null;
  hisseli: boolean;
  rating_score_pct: number | null;
  rating_count: number | null;
  rating_success_count?: number | null;
  /** ProParcel meta yıldız sistemi (0–100); liste kartındaki yıldızlar bunu kullanır */
  combined_meta_stars_pct?: number | null;
  comment_count?: number | null;
  /** Şehir / ilçe merkezine rota (m) — UserSavedQuery veya Mongo QuarterRouteResult */
  nav_in_distance_m_city?: number | null;
  nav_in_distance_m_town?: number | null;
}

export interface PortalQueryListResponse {
  results: PortalQueryListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface PortalQueryListParams {
  city_id?: number;
  town_id?: number;
  quarter_id?: number;
  proparcel_value?: string;
  query_type?: string;
  has_expert?: string;
  expert_status?: string;
  price_advantage_only?: string;
  hisseli?: string;
  mine?: boolean;
  page?: number;
  page_size?: number;
  unit_price_min?: number;
  unit_price_max?: number;
  total_price_min?: number;
  total_price_max?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  area_m2_min?: number;
  area_m2_max?: number;
  gm_min?: number;
  gm_max?: number;
  meta_min?: number;
  meta_max?: number;
  puan_min?: number;
  puan_max?: number;
  road_frontage_min_m?: number;
  road_frontage_max_m?: number;
  /** Şehir merkezine gidiş rotası (m) — QuarterRouteResult */
  min_nav_city_m?: number;
  max_nav_city_m?: number;
  /** İlçe merkezine gidiş rotası (m) */
  min_nav_town_m?: number;
  max_nav_town_m?: number;
  listing_has_road?: string;
  listing_has_water?: string;
  listing_has_power_line?: string;
  category_main?: string;
  category_type?: string;
  category_leaf_id?: string;
  /** Önbellek anahtarı; PG liste süzgecinde v1 kullanılmaz */
  listing_attr?: string;
}

// ── Query Detail ──

export interface PortalExpertRequest {
  id: number;
  status: string;
  note: string;
  created_at: string | null;
  answered_at: string | null;
}

export interface PortalExpertResponse {
  id: number;
  expert_display_name: string;
  expert_avatar_url: string | null;
  expert_badge: string | null;
  expert_score: number | null;
  expert_company: string | null;
  expert_phone: string | null;
  response_text: string;
  attachments_json: string[];
  pdf_url: string;
  created_at: string | null;
  approved_at: string | null;
  survey_answers: Record<string, unknown>;
  emsal_parcels: Record<string, unknown>;
}

export interface PortalSurveyQuestion {
  id: number;
  code: string;
  label: string;
  type: string;
}

export interface PortalExpertData {
  request: PortalExpertRequest | null;
  responses: PortalExpertResponse[];
  location: {
    city: string | null;
    district: string | null;
    neighborhood: string | null;
    ada: string | null;
    parsel: string | null;
  };
  total_price: number | null;
  survey_questions: PortalSurveyQuestion[];
}

export interface PortalOwnerCard {
  /** Ziyaretçi profili (web `/accounts/profile/badges/?visit=1&user_id=`) */
  user_id?: number | null;
  avatar_url: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
}

export interface PortalRamsarJson {
  is_ramsar: boolean;
  ramsar_name?: string | null;
}

export interface PortalDfaStep {
  note?: string;
  title?: string;
  key?: string;
  applied_factor?: number;
  new_avg?: number;
  prev_avg?: number;
  /** Bazı motor çıktılarında son birim fiyat yedek anahtarı */
  final_avg?: number | null;
  new_total?: number;
  prev_total?: number;
}

/** İlan vitrininde dönen video kaydı (Mongo + portal özet) */
export interface PortalListingVideoItem {
  video_id?: string | null;
  processed_url: string;
  thumbnail_url?: string | null;
  /** upload: kullanıcı; ai / ai_studio: yapay zeka üretimi */
  source?: string | null;
  original_filename?: string | null;
  duration_seconds?: number | null;
}

export interface PortalQueryDetail {
  snapshot_id: number;
  id: number;
  city_id: number | null;
  town_id: number | null;
  quarter_id: number | null;
  proparcel_value: string | null;
  tkgm_value: string | null;
  title: string | null;
  quarter_name: string | null;
  city_name: string | null;
  town_name: string | null;
  ada: string | null;
  parsel: string | null;
  query_type: string;
  area_m2: number | null;
  arazi_m2: number | null;
  unit_price: number | null;
  total_price: number | null;
  created_at: string | null;
  thumbnail_url: string | null;
  dfa_json: PortalDfaStep[];
  building_params: Record<string, string | number | boolean> | null;
  arsa_fiyati: number | null;
  bina_maliyeti: number | null;
  ramsar_json: PortalRamsarJson | null;
  parcel_coords_lonlat: number[][] | null;
  summary: Record<string, unknown> | null;
  images: { thumbnail_url: string | null; attachments: string[] };
  expert: PortalExpertData;
  requester_public: { masked_name: string; role: string | null; masked_company: string | null } | null;
  owner_card: PortalOwnerCard | null;
  parcel_shape_type: string | null;
  parcel_shape_type_label: string | null;
  slope_elevation_json: Record<string, unknown> | null;
  slope_polygons_json: Record<string, unknown> | null;
  prediction_json: Record<string, unknown> | null;
  price_selection_json: Record<string, unknown> | null;
  edge_measure_data: unknown;
  road_frontage_values?: {
    total_road_frontage_edge_length_m?: number | null;
    [key: string]: unknown;
  } | null;
  electric_values: unknown;
  electric_line_feature: unknown;
  km_recommended_price: number | null;
  km_analysis: Record<string, unknown> | null;
  is_own_query: boolean;
  viewer_is_staff: boolean;
  viewer_is_expert_user: boolean;
  viewer_is_expert_for_this_query: boolean;
  expert_price_detail: Record<string, unknown> | null;
  rating_summary: PortalRatingSummary | null;
  comment_count?: number;
  /** Yapı DFA adımları (Mülk Skoru sekmesi ile uyumlu) */
  building_dfa_json?: PortalDfaStep[] | null;
  viewer_can_see_structure_cost_breakdown?: boolean;
  listing_category_leaf_id?: string | null;
  listing_category_main?: string | null;
  category_leaf_id?: string | null;
  /** İlan vitrin (Mongo) — Bilgiler sekmesi */
  listing_id?: string | null;
  listing_title?: string | null;
  listing_description?: string | null;
  listing_attributes?: Record<string, unknown> | null;
  listing_category_leaf_label?: string | null;
  listing_price_amount?: number | null;
  listing_currency?: string | null;
  listing_type?: string | null;
  listing_area_m2?: number | null;
  /** ISO tarih (yayın) — portal ilan özeti */
  listing_published_at?: string | null;
  /** Görünen ilan numarası; yoksa listing_id ile doldurulur */
  listing_no?: string | null;
  listing_media?: string[];
  /** Yayınlanmış ilan videoları (işlenmiş URL); mobil vitrin sırası: önce video, sonra görseller */
  listing_videos?: PortalListingVideoItem[] | null;
  favorite_count_total?: number | null;
  viewer_is_listing_owner?: boolean;
  /** Parsel bölünebilirlik özeti (geometry bundle) */
  parcel_split_note?: string | null;
  parcel_split_verdict?: string | null;
}

// ── Ratings ──

export interface PortalRatingSummary {
  rating_score_pct: number | null;
  rating_count: number;
  success_count: number;
  needs_review_count: number;
}

export interface PortalRatingFeedbackItem {
  id?: number;
  masked_name: string;
  avatar_url: string | null;
  action: 'SUCCESS' | 'NEEDS_REVIEW';
  rating_points: number;
  predicted_unit_price: number | null;
  predicted_total_price: number | null;
  user_expected_unit_price: number | null;
  diff_pct: number | null;
  diff_direction: 'LOW' | 'HIGH' | 'EQUAL' | null;
  comment: string | null;
  created_at: string | null;
}

export interface PortalQueryComment {
  id: number;
  snapshot_id?: number;
  parent_comment_id?: number | null;
  user_id?: number | null;
  author?: {
    user_id: number;
    display_name: string;
    avatar_url: string | null;
  } | null;
  display_name?: string;
  masked_name: string;
  avatar_url: string | null;
  comment: string;
  created_at: string | null;
  updated_at: string | null;
  edited_at?: string | null;
  is_owner: boolean;
  is_edited: boolean;
  is_deleted?: boolean;
  reply_count?: number;
  like_count?: number;
  liked_by_me?: boolean;
  replies?: PortalQueryComment[];
}

export interface PortalRatingsResponse {
  rating_summary: PortalRatingSummary;
  comment_count: number;
  feedbacks: PortalRatingFeedbackItem[];
  comments: PortalQueryComment[];
}

export interface QueryRatingStatusResponse {
  already_rated: boolean;
  rated_at: string | null;
  action: 'SUCCESS' | 'NEEDS_REVIEW' | null;
  coin_rewarded: boolean;
  credits: number;
}

export interface QueryRatingCreatePayload {
  snapshot_id: number;
  source_page: string;
  action: 'SUCCESS' | 'NEEDS_REVIEW';
  /** Birim fiyat (₺/m²); sunucu `user_expected_total_price` ile birlikte veya ayrı kabul eder. */
  user_expected_unit_price?: number;
  /** Toplam TL; mobil «Değerlendirilmeli» akışında öncelikli. */
  user_expected_total_price?: number;
}

export interface QueryRatingCreateResponse {
  ok?: boolean;
  coin_awarded?: number;
  already_rated?: boolean;
}

export interface QueryRatingCommentPayload {
  snapshot_id?: number;
  comment: string;
}

export interface QueryRatingCommentMutationResponse {
  ok?: boolean;
  comment_id?: number;
  comment_item?: PortalQueryComment;
}

export interface QueryRatingActor {
  user_id: number;
  display_name: string;
  avatar_url: string | null;
}

export interface QueryRatingLikeListResponse {
  count: number;
  results: Array<QueryRatingActor & { liked_at: string | null }>;
}

export interface QueryRatingRaterListItem extends QueryRatingActor {
  action: 'SUCCESS' | 'NEEDS_REVIEW';
  rated_at: string | null;
}

export interface QueryRatingRaterListResponse {
  count: number;
  results: QueryRatingRaterListItem[];
}

/** GET /api/portal/recent-queries/<id>/fruit-investment/ */
export interface PortalFruitRecommendationRow {
  name?: string | null;
  score?: number | null;
}

export interface PortalFruitAnalysis {
  bestFruit?: { name?: string | null; score?: number | null } | null;
  recommendations?: PortalFruitRecommendationRow[];
  zone?: string | null;
  city?: string | null;
  ada?: string | null;
  parsel?: string | null;
  analysisVersion?: string | null;
}

export interface PortalFruitInvestmentResponse {
  analysis: PortalFruitAnalysis | null;
  empty_reason?: string | null;
}

/** GET /api/portal/recent-queries/<id>/solar-energy-score/ */
export interface PortalSolarEnergyScoreResponse {
  solar: Record<string, unknown> | null;
  empty_reason?: string | null;
  /** Skor hesabına giren sayısal girdiler (uzman paneli türetimi için). */
  derived_inputs?: {
    latitude?: number;
    longitude?: number;
    property_type?: string;
    slope_deg?: number;
    aspect_deg?: number;
    parcel_area_m2?: number;
    distance_to_grid_m?: number;
  } | null;
}

/** Rüzgar V2 gövdesi (`POST /api/energy/wind-score/` ile aynı şema). */
export interface PortalWindEnergyV2Body {
  overall_wind_score?: number;
  technical_wind_score?: number;
  economic_wind_score?: number;
  micro_wind_score?: number;
  commercial_wind_score?: number;
  confidence_score?: number;
  wind_level?: string;
  classification?: string;
  property_type?: string;
  components?: Record<string, number | null | undefined>;
  risks?: string[];
  sources?: {
    providers_attempted?: string[];
    providers_used?: string[];
    data_quality?: string;
    /** `wind_terrain_grid` (birleşik Mongo) | `terrain_roughness_grid` (eski) | `parcel`. */
    roughness_source?: string;
  };
  external_data?: Record<string, unknown>;
  /** Skor tablosu için ölçüler (API `input_metrics`). */
  input_metrics?: Record<string, unknown>;
  notes?: string[];
  debug?: {
    degraded_mode?: boolean;
    used_defaults?: string[];
    provider_debug?: Record<string, unknown>;
    terrain_roughness?: Record<string, unknown>;
  };
}

/** GET /api/portal/recent-queries/<id>/wind-energy-score/ */
export interface PortalWindEnergyScoreResponse {
  wind: PortalWindEnergyV2Body | null;
  empty_reason?: string | null;
  derived_inputs?: {
    latitude?: number;
    longitude?: number;
    property_type?: string;
    elevation_m?: number;
    slope_deg?: number;
    parcel_area_m2?: number;
    distance_to_grid_m?: number;
    distance_to_settlement_m?: number;
    roughness_class?: string;
    roughness_source?: string | null;
  } | null;
}

/** GET /api/portal/recent-queries/<id>/investment-score/ */
export interface PortalStructureScorePayload {
  structure_score?: number | string | null;
  empty_reason?: string | null;
  structure_score_components?: Array<{
    key?: string;
    label?: string;
    score?: number | string | null;
    included?: boolean;
  }>;
  structure_score_age_band_note?: string | null;
}

export interface PortalInvestmentScorePayload {
  analysis: Record<string, unknown> | null;
  empty_reason?: string | null;
  meta_stars_denorm?: {
    combined_meta_stars_pct?: number | string | null;
    portal_star_blend?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  structure_score?: PortalStructureScorePayload | null;
}
