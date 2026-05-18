/**
 * Vitrin — yayınlanmış ilan araması (public search API)
 */

import { DJANGO_API_URL } from '../config/api';
import { type ApiResult } from './apiClient';
import { storageService } from './storageService';
import { authService } from './authService';
import type { VitrinSearchResponse, VitrinListingSearchParams } from '../src/types/vitrin';

function buildQuery(params: VitrinListingSearchParams): string {
  const sp = new URLSearchParams();
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;
  sp.set('page', String(page));
  sp.set('page_size', String(pageSize));
  if (params.listing_type) sp.set('listing_type', params.listing_type);
  if (params.city_id != null) sp.set('city_id', String(params.city_id));
  if (params.district_id != null) sp.set('district_id', String(params.district_id));
  if (params.quarter_id != null) sp.set('quarter_id', String(params.quarter_id));
  if (params.price_min_amount != null) sp.set('price_min_amount', String(params.price_min_amount));
  if (params.price_max_amount != null) sp.set('price_max_amount', String(params.price_max_amount));
  if (params.area_min_m2 != null) sp.set('area_min_m2', String(params.area_min_m2));
  if (params.area_max_m2 != null) sp.set('area_max_m2', String(params.area_max_m2));
  if (params.investment_score_min != null) sp.set('investment_score_min', String(params.investment_score_min));
  if (params.investment_score_max != null) sp.set('investment_score_max', String(params.investment_score_max));
  if (params.rating_score_min != null) sp.set('rating_score_min', String(params.rating_score_min));
  if (params.rating_score_max != null) sp.set('rating_score_max', String(params.rating_score_max));
  if (params.road_frontage_min_m != null) sp.set('road_frontage_min_m', String(params.road_frontage_min_m));
  if (params.road_frontage_max_m != null) sp.set('road_frontage_max_m', String(params.road_frontage_max_m));
  if (params.min_nav_city_m != null) sp.set('min_nav_city_m', String(params.min_nav_city_m));
  if (params.max_nav_city_m != null) sp.set('max_nav_city_m', String(params.max_nav_city_m));
  if (params.min_nav_town_m != null) sp.set('min_nav_town_m', String(params.min_nav_town_m));
  if (params.max_nav_town_m != null) sp.set('max_nav_town_m', String(params.max_nav_town_m));
  if (params.listing_has_road) sp.set('listing_has_road', params.listing_has_road);
  if (params.listing_has_water) sp.set('listing_has_water', params.listing_has_water);
  if (params.listing_has_power_line) sp.set('listing_has_power_line', params.listing_has_power_line);
  if (params.category_main) sp.set('category_main', params.category_main);
  if (params.category_type) sp.set('category_type', params.category_type);
  if (params.category_leaf_id) sp.set('category_leaf_id', params.category_leaf_id);
  if (params.unit_price_min != null) sp.set('unit_price_min', String(params.unit_price_min));
  if (params.unit_price_max != null) sp.set('unit_price_max', String(params.unit_price_max));
  if (params.meta_min != null) sp.set('meta_min', String(params.meta_min));
  if (params.meta_max != null) sp.set('meta_max', String(params.meta_max));
  if (params.hisseli) sp.set('hisseli', params.hisseli);
  if (params.expert_answered) sp.set('expert_answered', params.expert_answered);
  if (params.price_advantage_only) sp.set('price_advantage_only', params.price_advantage_only);
  if (params.sort_by) sp.set('sort_by', params.sort_by);
  if (params.sort_dir) sp.set('sort_dir', params.sort_dir);
  if (params.listing_attr && String(params.listing_attr).trim()) {
    sp.set('listing_attr', String(params.listing_attr).trim());
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/**
 * GET /api/v1/public/search/listings
 * ILAN_PORTAL_EXPOSE_SEARCH_API açık olmalı; aksi halde 404.
 */
export async function getPublicVitrinListings(
  params: VitrinListingSearchParams = {},
): Promise<ApiResult<VitrinSearchResponse>> {
  const qs = buildQuery(params);
  const url = `${DJANGO_API_URL}/api/v1/public/search/listings${qs}`;
  let accessToken = await storageService.getAccessToken();
  if (!accessToken) {
    const refreshed = await authService.refreshToken();
    accessToken = refreshed ? await storageService.getAccessToken() : null;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(url, { method: 'GET', headers });
  if (res.status === 401) {
    const refreshed = await authService.refreshToken();
    const token = refreshed ? await storageService.getAccessToken() : null;
    if (token) {
      res = await fetch(url, {
        method: 'GET',
        headers: { ...headers, Authorization: `Bearer ${token}` },
      });
    }
  }

  const status = res.status;
  const text = await res.text();
  try {
    const parsed = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return { ok: false, status, error: parsed?.error || parsed?.detail || parsed?.message || `HTTP ${status}` };
    }
    return { ok: true, data: parsed as VitrinSearchResponse };
  } catch {
    if (!res.ok) return { ok: false, status, error: `HTTP ${status}` };
    return { ok: true, data: text as any as VitrinSearchResponse };
  }
}
