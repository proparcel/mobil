/**
 * Portal Son 30 Gun Sorgular – Django API Servisi
 */

import { DJANGO_API_URL } from '../config/api';
import { type ApiResult } from './apiClient';
import { storageService } from './storageService';
import { authService } from './authService';
import type {
  PortalFruitInvestmentResponse,
  PortalInvestmentScorePayload,
  PortalLocationsResponse,
  PortalQueryListParams,
  PortalQueryListResponse,
  PortalQueryDetail,
  PortalSolarEnergyScoreResponse,
  PortalWindEnergyScoreResponse,
  PortalRatingsResponse,
  QueryRatingLikeListResponse,
  QueryRatingCommentMutationResponse,
  QueryRatingCommentPayload,
  QueryRatingCreatePayload,
  QueryRatingCreateResponse,
  QueryRatingRaterListResponse,
  QueryRatingStatusResponse,
} from '../src/types/portal';

async function authDjangoJsonFetch<T>(
  endpoint: string,
  options: RequestInit & { json?: any } = {}
): Promise<ApiResult<T>> {
  const url = `${DJANGO_API_URL}${endpoint}`;
  let accessToken = await storageService.getAccessToken();
  if (!accessToken) {
    const refreshed = await authService.refreshToken();
    accessToken = refreshed ? await storageService.getAccessToken() : null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers as any),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const body = options.json !== undefined ? JSON.stringify(options.json) : options.body;
  let res = await fetch(url, { ...options, headers, body });
  if (res.status === 401 && endpoint !== '/api/auth/token/refresh/') {
    const refreshed = await authService.refreshToken();
    const token = refreshed ? await storageService.getAccessToken() : null;
    if (token) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${token}` };
      res = await fetch(url, { ...options, headers: retryHeaders, body });
    }
  }

  const status = res.status;
  const text = await res.text();
  try {
    const parsed = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return { ok: false, status, error: parsed?.error || parsed?.detail || parsed?.message || `HTTP ${status}` };
    }
    return { ok: true, data: parsed as T };
  } catch {
    if (!res.ok) return { ok: false, status, error: `HTTP ${status}` };
    return { ok: true, data: text as any as T };
  }
}

export type PortalLocationsCountsFor = 'queries' | 'listings';
export type PortalLocationsFilterOptions = {
  countsFor?: PortalLocationsCountsFor;
  categoryMain?: string;
  categoryLeafId?: string;
  listingType?: 'sale' | 'rent';
};

/**
 * GET /api/portal/locations/?city_id=&town_id=&counts_for=
 * Son 30 günde veri olan il / ilçe / mahalle listesi (sayılar)
 * - queries (varsayılan): Pro sorgu listesi ile uyumlu
 * - listings: vitrin ilan listesi ile uyumlu
 */
/** Tam coğrafya (Sahibinden City/Town/Quarter) — Aranacaklar konum seçimi için; portal/locations değil */
export type GeoCityRow = { Id: number; Proparcel_text?: string };
export type GeoTownRow = { Id: number; Proparcel_text?: string };

/** GET /api/cities/ — tüm iller */
export async function fetchGeoCities(): Promise<ApiResult<GeoCityRow[]>> {
  return authDjangoJsonFetch<GeoCityRow[]>(`/api/cities/`);
}

/** GET /api/towns/?CityId= — seçilen ile ait tüm ilçeler */
export async function fetchGeoTownsByCity(cityId: number): Promise<ApiResult<GeoTownRow[]>> {
  const res = await authDjangoJsonFetch<{ error?: boolean; ilceler?: GeoTownRow[] }>(
    `/api/towns/?CityId=${encodeURIComponent(String(cityId))}`,
  );
  if (!res.ok) return res as ApiResult<GeoTownRow[]>;
  const body = res.data as { error?: boolean; ilceler?: GeoTownRow[] } | GeoTownRow[] | null | undefined;
  if (!body) return { ok: true, data: [] };
  const ilceler = Array.isArray((body as { ilceler?: GeoTownRow[] }).ilceler)
    ? (body as { ilceler: GeoTownRow[] }).ilceler
    : Array.isArray(body)
      ? (body as GeoTownRow[])
      : [];
  return { ok: true, data: ilceler };
}

/** GET /api/quarters/?TownId= — seçilen ilçeye ait tüm mahalleler (Tkgm_text) */
export type GeoQuarterRow = {
  Id?: number;
  id?: number;
  Tkgm_text?: string;
  Proparcel_text?: string;
};

export async function fetchGeoQuartersByTown(townId: number): Promise<ApiResult<GeoQuarterRow[]>> {
  return authDjangoJsonFetch<GeoQuarterRow[]>(
    `/api/quarters/?TownId=${encodeURIComponent(String(townId))}`,
  );
}

export async function getPortalLocations(
  cityId?: number,
  townId?: number,
  options?: PortalLocationsFilterOptions,
): Promise<ApiResult<PortalLocationsResponse>> {
  const params = new URLSearchParams();
  if (cityId != null) params.set('city_id', String(cityId));
  if (townId != null) params.set('town_id', String(townId));
  if (options?.countsFor === 'listings') {
    params.set('counts_for', 'listings');
  } else if (options?.countsFor === 'queries') {
    params.set('counts_for', 'queries');
  }
  if (options?.categoryMain) params.set('category_main', options.categoryMain);
  if (options?.categoryLeafId) params.set('category_leaf_id', options.categoryLeafId);
  if (options?.listingType) params.set('listing_type', options.listingType);
  const qs = params.toString();
  const endpoint = `/api/portal/locations/${qs ? '?' + qs : ''}`;
  return authDjangoJsonFetch<PortalLocationsResponse>(endpoint);
}

export interface PublicListingCategoryNode {
  id: string;
  label: string;
  sort_order: number;
  has_children: boolean;
  is_leaf: boolean;
  count?: number;
}

export interface PublicListingCategoryResponse {
  nodes: PublicListingCategoryNode[];
}

export interface PublicListingAttributeChoice {
  value: string;
  label: string;
}

export interface PublicListingAttributeVisibleWhen {
  field?: string;
  equals?: string | number | boolean | null;
  not_in?: Array<string | number | boolean | null>;
}

export interface PublicListingAttributeField {
  key: string;
  label: string;
  binding?: string;
  value_type?: string;
  presentation?: string;
  required?: boolean;
  min?: number | string | null;
  max?: number | string | null;
  choices?: PublicListingAttributeChoice[];
  visible_when?: PublicListingAttributeVisibleWhen | null;
}

export interface PublicListingAttributeSchema {
  leaf_id?: string;
  specific_field_keys?: string[];
  fields?: PublicListingAttributeField[];
}

export async function getPublicListingCategories(options?: {
  parentId?: string | null;
  includeCounts?: boolean;
  listingType?: 'sale' | 'rent';
}): Promise<ApiResult<PublicListingCategoryResponse>> {
  const params = new URLSearchParams();
  if (options?.parentId) params.set('parent', options.parentId);
  if (options?.includeCounts) params.set('include_counts', '1');
  if (options?.listingType) params.set('listing_type', options.listingType);
  const qs = params.toString();
  const res = await authDjangoJsonFetch<{ data?: PublicListingCategoryResponse }>(`/api/v1/public/listing-categories${qs ? `?${qs}` : ''}`);
  if (!res.ok) return res;
  return { ok: true, data: res.data?.data || { nodes: [] } };
}

export async function getPublicListingAttributeSchema(
  leafId: string,
): Promise<ApiResult<PublicListingAttributeSchema>> {
  const params = new URLSearchParams();
  params.set('leaf_id', String(leafId || '').trim());
  const qs = params.toString();
  const res = await authDjangoJsonFetch<{ data?: PublicListingAttributeSchema }>(
    `/api/v1/public/listing-categories/attribute-schema${qs ? `?${qs}` : ''}`,
  );
  if (!res.ok) return res;
  return { ok: true, data: res.data?.data || { fields: [], specific_field_keys: [] } };
}

/**
 * GET /api/portal/recent-queries/
 * Sorgu listesi (filtreli, sayfalı)
 */
export async function getPortalRecentQueries(
  filters: PortalQueryListParams = {},
): Promise<ApiResult<PortalQueryListResponse>> {
  const params = new URLSearchParams();
  if (filters.city_id != null) params.set('city_id', String(filters.city_id));
  if (filters.town_id != null) params.set('town_id', String(filters.town_id));
  if (filters.quarter_id != null) params.set('quarter_id', String(filters.quarter_id));
  if (filters.proparcel_value) params.set('proparcel_value', filters.proparcel_value);
  if (filters.query_type) params.set('query_type', filters.query_type);
  if (filters.has_expert) params.set('has_expert', filters.has_expert);
  if (filters.expert_status) params.set('expert_status', filters.expert_status);
  if (filters.price_advantage_only) params.set('price_advantage_only', filters.price_advantage_only);
  if (filters.hisseli) params.set('hisseli', filters.hisseli);
  if (filters.mine) params.set('mine', '1');
  if (filters.page != null) params.set('page', String(filters.page));
  if (filters.page_size != null) params.set('page_size', String(filters.page_size));
  if (filters.unit_price_min != null) params.set('unit_price_min', String(filters.unit_price_min));
  if (filters.unit_price_max != null) params.set('unit_price_max', String(filters.unit_price_max));
  if (filters.total_price_min != null) params.set('total_price_min', String(filters.total_price_min));
  if (filters.total_price_max != null) params.set('total_price_max', String(filters.total_price_max));
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir);
  if (filters.area_m2_min != null) params.set('area_m2_min', String(filters.area_m2_min));
  if (filters.area_m2_max != null) params.set('area_m2_max', String(filters.area_m2_max));
  if (filters.gm_min != null) params.set('gm_min', String(filters.gm_min));
  if (filters.gm_max != null) params.set('gm_max', String(filters.gm_max));
  if (filters.meta_min != null) params.set('meta_min', String(filters.meta_min));
  if (filters.meta_max != null) params.set('meta_max', String(filters.meta_max));
  if (filters.puan_min != null) params.set('puan_min', String(filters.puan_min));
  if (filters.puan_max != null) params.set('puan_max', String(filters.puan_max));
  if (filters.road_frontage_min_m != null) params.set('road_frontage_min_m', String(filters.road_frontage_min_m));
  if (filters.road_frontage_max_m != null) params.set('road_frontage_max_m', String(filters.road_frontage_max_m));
  if (filters.min_nav_city_m != null) params.set('min_nav_city_m', String(filters.min_nav_city_m));
  if (filters.max_nav_city_m != null) params.set('max_nav_city_m', String(filters.max_nav_city_m));
  if (filters.min_nav_town_m != null) params.set('min_nav_town_m', String(filters.min_nav_town_m));
  if (filters.max_nav_town_m != null) params.set('max_nav_town_m', String(filters.max_nav_town_m));
  if (filters.listing_has_road) params.set('listing_has_road', filters.listing_has_road);
  if (filters.listing_has_water) params.set('listing_has_water', filters.listing_has_water);
  if (filters.listing_has_power_line) params.set('listing_has_power_line', filters.listing_has_power_line);
  if (filters.category_main) params.set('category_main', filters.category_main);
  if (filters.category_type) params.set('category_type', filters.category_type);
  if (filters.category_leaf_id) params.set('category_leaf_id', filters.category_leaf_id);
  if (filters.listing_attr && String(filters.listing_attr).trim()) {
    params.set('listing_attr', String(filters.listing_attr).trim());
  }
  const qs = params.toString();
  const endpoint = `/api/portal/recent-queries/${qs ? '?' + qs : ''}`;
  return authDjangoJsonFetch<PortalQueryListResponse>(endpoint);
}

/**
 * GET /api/portal/recent-queries/<id>/
 * Sorgu detayı (özet, uzman, sahip, DFA vb.)
 */
export async function getPortalRecentQueryDetail(
  snapshotId: number,
): Promise<ApiResult<PortalQueryDetail>> {
  return authDjangoJsonFetch<PortalQueryDetail>(`/api/portal/recent-queries/${snapshotId}/`);
}

/** GET /api/portal/recent-queries/<id>/summary/ — sosyal şablon / özet alanları */
export async function getPortalRecentQuerySummary(
  snapshotId: number,
): Promise<ApiResult<Record<string, unknown>>> {
  return authDjangoJsonFetch<Record<string, unknown>>(`/api/portal/recent-queries/${snapshotId}/summary/`);
}

export type UserRoadOverrideEdge = {
  edge_id: number;
  road_type_id: 9 | 13;
};

export type UserElectricOverrideLine = {
  start: [number, number];
  end: [number, number];
  voltage_kv: 64 | 154 | 380;
};

export async function rerunPortalQueryWithRoadOverride(
  snapshotId: number,
  edges: UserRoadOverrideEdge[],
  electricLines: UserElectricOverrideLine[] = [],
  source: 'road' | 'electric' = 'road',
): Promise<ApiResult<{ success: boolean; snapshot_id: number; updated_at?: string }>> {
  return authDjangoJsonFetch<{ success: boolean; snapshot_id: number; updated_at?: string }>(
    `/api/portal/recent-queries/${snapshotId}/rerun-with-road-override/`,
    {
      method: 'POST',
      json: { source, edges, electric_lines: electricLines },
    },
  );
}

/**
 * Arazi / Mülk skoru özeti (Mongo parcel_investment_analysis) + meta_stars_denorm + structure_score
 */
export async function getPortalInvestmentScore(
  snapshotId: number,
): Promise<ApiResult<PortalInvestmentScorePayload>> {
  return authDjangoJsonFetch<PortalInvestmentScorePayload>(
    `/api/portal/recent-queries/${snapshotId}/investment-score/`,
  );
}

/** Meyve bahçesi uygunluk skoru (Mongo parcel_fruit_analysis) — yapılı sorgularda API not_applicable döner */
export async function getPortalFruitInvestment(
  snapshotId: number,
): Promise<ApiResult<PortalFruitInvestmentResponse>> {
  return authDjangoJsonFetch<PortalFruitInvestmentResponse>(
    `/api/portal/recent-queries/${snapshotId}/fruit-investment/`,
  );
}

/** Güneş enerjisi skoru — Pro sorgu snapshot verisinden (sunucu önbellekli). */
export async function getPortalSolarEnergyScore(
  snapshotId: number,
): Promise<ApiResult<PortalSolarEnergyScoreResponse>> {
  return authDjangoJsonFetch<PortalSolarEnergyScoreResponse>(
    `/api/portal/recent-queries/${snapshotId}/solar-energy-score/`,
  );
}

/** Rüzgar enerjisi uygunluk skoru — Pro sorgu snapshot (sunucu önbellekli). */
export async function getPortalWindEnergyScore(
  snapshotId: number,
): Promise<ApiResult<PortalWindEnergyScoreResponse>> {
  return authDjangoJsonFetch<PortalWindEnergyScoreResponse>(
    `/api/portal/recent-queries/${snapshotId}/wind-energy-score/`,
  );
}

/** Parsel eğimi vb. bölüm verisi (web `getPortalDetailSection` ile aynı) */
export async function getPortalDetailSection(
  snapshotId: number,
  section: string,
): Promise<ApiResult<Record<string, unknown>>> {
  return authDjangoJsonFetch<Record<string, unknown>>(
    `/api/portal/recent-queries/${snapshotId}/sections/${encodeURIComponent(section)}/`,
  );
}

/**
 * GET /api/portal/recent-queries/<id>/report/
 * Tam rapor verisi (ReportPayload – report_mobil_viewver ile uyumlu)
 */
export async function getPortalSnapshotReport(
  snapshotId: number,
): Promise<ApiResult<Record<string, unknown>>> {
  return authDjangoJsonFetch<Record<string, unknown>>(`/api/portal/recent-queries/${snapshotId}/report/`);
}

/**
 * GET /api/portal/recent-queries/<id>/ratings/
 * Puanlama detayları (özet + geri bildirim listesi)
 */
export async function getPortalQueryRatings(
  snapshotId: number,
): Promise<ApiResult<PortalRatingsResponse>> {
  return authDjangoJsonFetch<PortalRatingsResponse>(`/api/portal/recent-queries/${snapshotId}/ratings/`);
}

export async function getQueryRatingStatus(
  snapshotId: number,
): Promise<ApiResult<QueryRatingStatusResponse>> {
  return authDjangoJsonFetch<QueryRatingStatusResponse>(`/api/feedback/query-rating/status/?snapshot_id=${snapshotId}`);
}

export async function createPortalQueryRating(
  payload: QueryRatingCreatePayload,
): Promise<ApiResult<QueryRatingCreateResponse>> {
  return authDjangoJsonFetch<QueryRatingCreateResponse>('/api/feedback/query-rating/', {
    method: 'POST',
    json: payload,
  });
}

export async function createPortalQueryComment(
  payload: QueryRatingCommentPayload,
): Promise<ApiResult<QueryRatingCommentMutationResponse>> {
  return authDjangoJsonFetch<QueryRatingCommentMutationResponse>('/api/feedback/query-rating-comments/', {
    method: 'POST',
    json: payload,
  });
}

export async function createPortalQueryReply(
  commentId: number,
  payload: QueryRatingCommentPayload,
): Promise<ApiResult<QueryRatingCommentMutationResponse>> {
  return authDjangoJsonFetch<QueryRatingCommentMutationResponse>(`/api/feedback/query-rating-comments/${commentId}/reply/`, {
    method: 'POST',
    json: payload,
  });
}

export async function updatePortalQueryComment(
  commentId: number,
  payload: QueryRatingCommentPayload,
): Promise<ApiResult<QueryRatingCommentMutationResponse>> {
  return authDjangoJsonFetch<QueryRatingCommentMutationResponse>(`/api/feedback/query-rating-comments/${commentId}/`, {
    method: 'PATCH',
    json: payload,
  });
}

export async function deletePortalQueryComment(
  commentId: number,
): Promise<ApiResult<QueryRatingCommentMutationResponse>> {
  return authDjangoJsonFetch<QueryRatingCommentMutationResponse>(`/api/feedback/query-rating-comments/${commentId}/delete/`, {
    method: 'DELETE',
  });
}

export async function likePortalQueryComment(
  commentId: number,
): Promise<ApiResult<QueryRatingCommentMutationResponse>> {
  return authDjangoJsonFetch<QueryRatingCommentMutationResponse>(`/api/feedback/query-rating-comments/${commentId}/like/`, {
    method: 'POST',
  });
}

export async function unlikePortalQueryComment(
  commentId: number,
): Promise<ApiResult<QueryRatingCommentMutationResponse>> {
  return authDjangoJsonFetch<QueryRatingCommentMutationResponse>(`/api/feedback/query-rating-comments/${commentId}/unlike/`, {
    method: 'DELETE',
  });
}

export async function getPortalQueryCommentLikes(
  commentId: number,
): Promise<ApiResult<QueryRatingLikeListResponse>> {
  return authDjangoJsonFetch<QueryRatingLikeListResponse>(`/api/feedback/query-rating-comments/${commentId}/likes/`);
}

export async function getPortalQueryRaters(
  snapshotId: number,
): Promise<ApiResult<QueryRatingRaterListResponse>> {
  return authDjangoJsonFetch<QueryRatingRaterListResponse>(`/api/portal/recent-queries/${snapshotId}/raters/`);
}

export type PortalQueryFavoriteStatusResponse = {
  snapshot_id: number | null;
  is_favorite: boolean;
  created?: boolean;
  deleted?: boolean;
  favorited_at?: string | null;
};

export async function getPortalQueryFavoriteStatus(
  snapshotId: number,
): Promise<ApiResult<PortalQueryFavoriteStatusResponse>> {
  return authDjangoJsonFetch<PortalQueryFavoriteStatusResponse>(`/api/portal/recent-queries/${snapshotId}/favorite/`);
}

export async function addPortalQueryFavorite(
  snapshotId: number,
): Promise<ApiResult<PortalQueryFavoriteStatusResponse>> {
  return authDjangoJsonFetch<PortalQueryFavoriteStatusResponse>(`/api/portal/recent-queries/${snapshotId}/favorite/`, {
    method: 'POST',
    json: {},
  });
}

export async function removePortalQueryFavorite(
  snapshotId: number,
): Promise<ApiResult<PortalQueryFavoriteStatusResponse>> {
  return authDjangoJsonFetch<PortalQueryFavoriteStatusResponse>(`/api/portal/recent-queries/${snapshotId}/favorite/`, {
    method: 'DELETE',
  });
}

/** GET /api/portal/recent-queries/favorites/ — kullanıcının Pro sorgu favori listesi */
export type PortalQueryFavoriteListItem = {
  snapshot_id: number;
  favorite_created_at?: string | null;
  title?: string | null;
  query_type?: string | null;
  city_name?: string | null;
  town_name?: string | null;
  quarter_name?: string | null;
  ada?: string | null;
  parsel?: string | null;
  area_m2?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  thumbnail_url?: string | null;
};

export type PortalQueryFavoritesListResponse = {
  items: PortalQueryFavoriteListItem[];
  pagination?: { page: number; page_size: number; total: number; total_pages?: number };
};

export async function getPortalQueryFavoritesList(
  page = 1,
  pageSize = 40,
): Promise<ApiResult<PortalQueryFavoritesListResponse>> {
  const qs = `page=${page}&page_size=${pageSize}`;
  return authDjangoJsonFetch<PortalQueryFavoritesListResponse>(`/api/portal/recent-queries/favorites/?${qs}`, {
    method: 'GET',
  });
}

/** Web `getPortalUserProfile` — ziyaret / özet: GET /api/portal/users/{id}/?badges=1 */
export async function getPortalUserProfile(
  userId: number,
  options?: { badges?: boolean },
): Promise<ApiResult<Record<string, unknown>>> {
  const id = encodeURIComponent(String(userId));
  const qs = options?.badges ? "?badges=1" : "";
  return authDjangoJsonFetch<Record<string, unknown>>(
    `/api/portal/users/${id}/${qs}`,
    { method: "GET" },
  );
}

/** Web `getPortalAgentRatings` — profil Genel Bakış “Kullanıcı Puanı” özeti */
export async function getPortalUserAgentRatings(userId: number): Promise<
  ApiResult<{
    aggregate?: { count?: number; avg_overall?: number | null };
    items?: unknown[];
  }>
> {
  return authDjangoJsonFetch(`/api/portal/users/${encodeURIComponent(String(userId))}/agent-ratings/`);
}
