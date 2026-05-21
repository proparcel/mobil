import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import type { SavedQueryItem } from "../../components/app/MyQueriesModal";
import { SAVED_QUERIES_CHANGED } from "../constants/savedQueriesEvents";
import { findSavedQueryByKey, loadSavedQueries, makeSavedQueryKey } from "../utils/savedQueries";
import { listSavedQueriesApi } from "../../services/savedQueriesApi";

export function useSavedQueriesList(isAuthenticated: boolean | undefined, enabled: boolean) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SavedQueryItem[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const localList = await loadSavedQueries();

      if (!isAuthenticated) {
        setItems(Array.isArray(localList) ? localList : []);
        return;
      }

      const apiRes = await listSavedQueriesApi();
      if (!apiRes.ok || !Array.isArray(apiRes.results)) {
        setItems(Array.isArray(localList) ? localList : []);
        if (__DEV__ && !apiRes.ok) {
          console.warn("[useSavedQueriesList] API liste alınamadı, yerel gösteriliyor:", apiRes.error);
        }
        return;
      }

      const seen = new Set<string>();
      const merged: SavedQueryItem[] = [];

      for (const loc of localList) {
        const key = makeSavedQueryKey(loc);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(loc);
        }
      }

      for (const apiItem of apiRes.results) {
        const key = makeSavedQueryKey(apiItem);
        if (seen.has(key)) {
          const idx = merged.findIndex((m) => makeSavedQueryKey(m) === key);
          if (idx >= 0) {
            const local = await findSavedQueryByKey(apiItem.tkgm_value, apiItem.ada, apiItem.parsel);
            merged[idx] = { ...apiItem, local: local ?? undefined, _fromApi: true };
          }
          continue;
        }
        seen.add(key);
        const local = await findSavedQueryByKey(apiItem.tkgm_value, apiItem.ada, apiItem.parsel);
        merged.push({ ...apiItem, local: local ?? undefined, _fromApi: true });
      }

      setItems(merged);
      if (__DEV__) {
        console.log(
          `[useSavedQueriesList] ${merged.length} kayıt (yerel: ${localList.length}, api: ${apiRes.results.length})`
        );
      }
    } catch (e) {
      console.warn("[useSavedQueriesList] refresh hatası:", e);
      try {
        const fallback = await loadSavedQueries();
        setItems(Array.isArray(fallback) ? fallback : []);
      } catch {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const sub = DeviceEventEmitter.addListener(SAVED_QUERIES_CHANGED, () => {
      void refresh();
    });
    return () => sub.remove();
  }, [enabled, refresh]);

  return { loading, items, refresh };
}
