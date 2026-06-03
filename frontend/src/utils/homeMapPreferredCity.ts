/**
 * Girişli kullanıcı: profil iline göre ana harita hızlı odaklama (AsyncStorage + profil API).
 * Girişsiz veya il yoksa ana harita mevcut GPS bootstrap akışını kullanır.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../../services/authService";
import type { User } from "../types/auth";

export const HOME_MAP_PREFERRED_CITY_STORAGE_KEY = "pp.homeMap.preferredCityId";

export async function getStoredHomeMapCityId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_MAP_PREFERRED_CITY_STORAGE_KEY);
    const n = Number(String(raw || "").trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function setStoredHomeMapCityId(cityId: number): Promise<void> {
  const n = Number(cityId);
  if (!Number.isFinite(n) || n <= 0) return;
  try {
    await AsyncStorage.setItem(HOME_MAP_PREFERRED_CITY_STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export async function clearStoredHomeMapCityId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HOME_MAP_PREFERRED_CITY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function pickCityIdFromUser(user: User | null | undefined): number | null {
  const n = user?.city_id;
  if (n != null && Number.isFinite(Number(n)) && Number(n) > 0) return Number(n);
  return null;
}

export function pickCityIdFromProfilePayload(
  data: { profile?: { city_id?: number }; address?: { city_id?: number } } | null | undefined,
): number | null {
  if (!data) return null;
  const cid = data.address?.city_id ?? data.profile?.city_id;
  if (cid != null && Number.isFinite(Number(cid)) && Number(cid) > 0) return Number(cid);
  return null;
}

export async function fetchProfileCityIdAndStore(): Promise<number | null> {
  try {
    const response = await authService.getProfile();
    if (!response.success || !response.data) return null;
    const cityId = pickCityIdFromProfilePayload(
      response.data as { profile?: { city_id?: number }; address?: { city_id?: number } },
    );
    if (cityId) await setStoredHomeMapCityId(cityId);
    return cityId;
  } catch {
    return null;
  }
}

/** Sıra: user.city_id → AsyncStorage → GET /api/profile/ */
export async function resolveHomeMapCityId(user: User | null | undefined): Promise<number | null> {
  const fromUser = pickCityIdFromUser(user);
  if (fromUser) {
    await setStoredHomeMapCityId(fromUser);
    return fromUser;
  }
  const stored = await getStoredHomeMapCityId();
  if (stored) return stored;
  return fetchProfileCityIdAndStore();
}
