import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalizeParcelPolygonDesignConfig,
  type ParcelPolygonDesignConfig,
} from '../constants/parcelPolygonDesign';

export const PARCEL_POLYGON_DESIGN_STORAGE_KEY = 'pp_parcel_polygon_design_v1';

export async function loadSavedParcelPolygonDesign(): Promise<ParcelPolygonDesignConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(PARCEL_POLYGON_DESIGN_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return normalizeParcelPolygonDesignConfig(parsed);
  } catch {
    return null;
  }
}

export async function saveParcelPolygonDesign(
  config: ParcelPolygonDesignConfig
): Promise<void> {
  const normalized = normalizeParcelPolygonDesignConfig(config);
  if (!normalized) return;
  try {
    await AsyncStorage.setItem(PARCEL_POLYGON_DESIGN_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}
