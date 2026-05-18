/**
 * Hisseli parsel satın alma durumu – parsel bazında kalıcı.
 * mahalle_ada_parsel ile aynı yeri tekrar açınca satın alma modalı çıkmaz.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "pp_parcel_split_purchased_v1";

function parcelKey(mahalle?: string, ada?: string, parsel?: string): string {
  const m = String(mahalle ?? "").trim() || "_";
  const a = String(ada ?? "").trim() || "_";
  const p = String(parsel ?? "").trim() || "_";
  return `${m}|${a}|${p}`;
}

export async function isParcelSplitPurchased(
  mahalle?: string,
  ada?: string,
  parsel?: string
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    if (!Array.isArray(list)) return false;
    const key = parcelKey(mahalle, ada, parsel);
    return list.includes(key);
  } catch {
    return false;
  }
}

export async function setParcelSplitPurchased(
  mahalle?: string,
  ada?: string,
  parsel?: string
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    const key = parcelKey(mahalle, ada, parsel);
    if (list.includes(key)) return;
    list.push(key);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
