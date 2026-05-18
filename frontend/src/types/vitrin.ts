/**
 * GET /api/v1/public/search/listings — vitrin ilan listesi
 */

export interface VitrinListingItem {
  listing_id: string;
  favorite_count_total?: number | null;
  title?: string | null;
  category_leaf_label?: string | null;
  price_amount?: number | null;
  area_m2?: number | null;
  thumb_url?: string | null;
  /** API bazen string gönderir (Mongo); filtre için sayıya çevrilmeli */
  city_id?: number | string | null;
  district_id?: number | string | null;
  quarter_id?: number | string | null;
  location_labels?: Record<string, string>;
  portal_snapshot_id?: number | null;
  /** Mongo `portal_road_frontage_m` — yola toplam cephe (m) */
  road_frontage_m?: number | null;
  /** ProParcel meta yıldız (0–100); backend snapshot’tan */
  combined_meta_stars_pct?: number | null;
  rating_score_pct?: number | null;
  rating_count?: number | null;
  rating_success_count?: number | null;
  comment_count?: number | null;
  /** Yatırım / GM skoru (normalize) */
  investment_normalized_score?: number | null;
  updated_at?: string | null;
  /** Şehir / ilçe merkezine rota (m) — Mongo quarterrouteresult */
  nav_in_distance_m_city?: number | null;
  nav_in_distance_m_town?: number | null;
}

export interface VitrinSearchPagination {
  page: number;
  page_size: number;
  total_count: number;
}

export interface VitrinSearchResponse {
  items: VitrinListingItem[];
  meta?: unknown;
  pagination?: VitrinSearchPagination;
  applied_filters?: Record<string, string>;
}

export interface VitrinListingSearchParams {
  page?: number;
  page_size?: number;
  listing_type?: 'sale' | 'rent';
  city_id?: number;
  district_id?: number;
  quarter_id?: number;
  price_min_amount?: number;
  price_max_amount?: number;
  area_min_m2?: number;
  area_max_m2?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  investment_score_min?: number;
  investment_score_max?: number;
  rating_score_min?: number;
  rating_score_max?: number;
  road_frontage_min_m?: number;
  road_frontage_max_m?: number;
  min_nav_city_m?: number;
  max_nav_city_m?: number;
  min_nav_town_m?: number;
  max_nav_town_m?: number;
  listing_has_road?: string;
  listing_has_water?: string;
  listing_has_power_line?: string;
  category_main?: string;
  category_type?: string;
  category_leaf_id?: string;
  /** ₺/m² — `price_amount / area_m2` (Mongo $expr) */
  unit_price_min?: number;
  unit_price_max?: number;
  /** Genel puan (yıldız) 0–100 — snapshot denorm `portal_combined_meta_stars_pct` */
  meta_min?: number;
  meta_max?: number;
  /** Mahalle nihai skoru — public search allowlist */
  quarter_score_min?: number;
  quarter_score_max?: number;
  /** Pro sorgu `hisseli` ile uyum: `1` / `0` */
  hisseli?: string;
  /** Uzman yanıtı verilmiş ilanlar — `1` */
  expert_answered?: string;
  /** Fiyat avantajı olan ilanlar — `1` */
  price_advantage_only?: string;
  /** JSON: listing_attributes süzgeci (public search allowlist) */
  listing_attr?: string;
}
