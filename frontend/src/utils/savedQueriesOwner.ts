import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearSavedQueries } from "./savedQueries";
import { clearSidebarSavedQueries } from "./sidebarSavedQueries";

const OWNER_STORAGE_KEY = "pp_saved_queries_owner_user_id_v1";

function normalizeOwnerId(userId: string | number | null | undefined): string | null {
  if (userId == null || userId === "") return null;
  const s = String(userId).trim();
  return s || null;
}

/**
 * Oturum değişince cihazdaki Sorgularım önbelleğini sıfırla (başka kullanıcının kayıtları görünmesin).
 */
export async function ensureDeviceSavedQueriesOwner(
  userId: string | number | null | undefined,
): Promise<void> {
  const next = normalizeOwnerId(userId);
  if (!next) {
    await AsyncStorage.removeItem(OWNER_STORAGE_KEY);
    return;
  }

  const prev = await AsyncStorage.getItem(OWNER_STORAGE_KEY);
  if (prev && prev !== next) {
    await clearSavedQueries();
    await clearSidebarSavedQueries();
  }
  await AsyncStorage.setItem(OWNER_STORAGE_KEY, next);
}

export async function clearDeviceSavedQueriesOnLogout(): Promise<void> {
  await AsyncStorage.removeItem(OWNER_STORAGE_KEY);
  await clearSavedQueries();
  await clearSidebarSavedQueries();
}
