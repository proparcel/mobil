/**
 * İl / ilçe / mahalle sınır API'leri (web city_town_quarter_box_manager ile aynı uçlar).
 */

import { API_URL } from '../config/api';

export type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

export type CityBoundaryResponse = {
  city_geometry?: GeoJsonGeometry;
  inactive_quarters?: unknown[];
  error?: string;
};

export type TownBoundaryResponse = {
  geometry?: GeoJsonGeometry;
  error?: string;
};

export type QuarterBoundaryResponse = {
  geometry?: GeoJsonGeometry;
  error?: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    const json = (await res.json()) as T & { error?: string };
    if (!res.ok || json?.error) return null;
    return json;
  } catch {
    return null;
  }
}

export function fetchCityBoundary(cityId: number): Promise<CityBoundaryResponse | null> {
  return fetchJson<CityBoundaryResponse>(
    `${API_URL}/api/get_city_coordinates/?cityId=${encodeURIComponent(String(cityId))}`,
  );
}

export function fetchTownBoundary(townId: number): Promise<TownBoundaryResponse | null> {
  return fetchJson<TownBoundaryResponse>(
    `${API_URL}/api/get_town_coordinates/?townId=${encodeURIComponent(String(townId))}`,
  );
}

export function fetchQuarterBoundary(proparcelValue: number): Promise<QuarterBoundaryResponse | null> {
  return fetchJson<QuarterBoundaryResponse>(
    `${API_URL}/api/get_quarters_coordinates/?proparcel_value=${encodeURIComponent(String(proparcelValue))}`,
  );
}
