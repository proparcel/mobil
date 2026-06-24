import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import type { SavedQueryItem } from "../../components/app/MyQueriesModal";
import { SAVED_QUERIES_CHANGED } from "../constants/savedQueriesEvents";
import {
  backfillLocalSavedQueryLocationHeaders,
  loadSavedQueries,
  makeSavedQueryKey,
  type SavedQuery,
} from "../utils/savedQueries";
import { getSavedQueryDisplayRow, getSavedQueryItemId, type SavedQueryDisplayRow } from "../utils/savedQueryDisplay";
import { listSavedQueriesApi, type ApiSavedQuery } from "../../services/savedQueriesApi";

export type SavedQueryListRow = {
  item: SavedQueryItem;
  row: SavedQueryDisplayRow;
};

function buildLocalByKey(localList: SavedQuery[]): Map<string, SavedQuery> {
  const map = new Map<string, SavedQuery>();
  for (const loc of localList) {
    const key = makeSavedQueryKey(loc);
    if (!map.has(key)) map.set(key, loc);
  }
  return map;
}

function getSavedQuerySortTime(item: SavedQueryItem): number {
  if ("_fromApi" in item && item._fromApi) {
    const apiTime = Date.parse(String(item.created_at || ""));
    if (Number.isFinite(apiTime) && apiTime > 0) return apiTime;
    const localTime = Date.parse(String(item.local?.createdAt || ""));
    if (Number.isFinite(localTime) && localTime > 0) return localTime;
    return 0;
  }
  const local = item as SavedQuery;
  const localTime = Date.parse(String(local.createdAt || ""));
  return Number.isFinite(localTime) && localTime > 0 ? localTime : 0;
}

function sortSavedQueryItemsNewestFirst(items: SavedQueryItem[]): SavedQueryItem[] {
  return [...items].sort((a, b) => getSavedQuerySortTime(b) - getSavedQuerySortTime(a));
}

function mergeAuthenticatedList(
  localByKey: Map<string, SavedQuery>,
  apiResults: ApiSavedQuery[],
): SavedQueryItem[] {
  const apiKeys = new Set<string>();
  const merged: SavedQueryItem[] = apiResults.map((apiItem) => {
    const key = makeSavedQueryKey(apiItem);
    apiKeys.add(key);
    return {
      ...apiItem,
      local: localByKey.get(key) ?? undefined,
      _fromApi: true as const,
    };
  });

  // API gecikmesi veya henüz senkron olmamış oturum kayıtları — yalnızca bu cihazdaki önbellek
  for (const loc of localByKey.values()) {
    const key = makeSavedQueryKey(loc);
    if (!apiKeys.has(key)) {
      merged.push(loc);
    }
  }

  return sortSavedQueryItemsNewestFirst(merged);
}

function buildDisplayRows(items: SavedQueryItem[]): SavedQueryListRow[] {
  return sortSavedQueryItemsNewestFirst(items).map((item) => ({
    item,
    row: getSavedQueryDisplayRow(item),
  }));
}

export function useSavedQueriesList(isAuthenticated: boolean | undefined, enabled: boolean) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SavedQueryListRow[]>([]);
  const refreshSeqRef = useRef(0);

  const pruneItems = useCallback((ids: Set<string>) => {
    if (ids.size === 0) return;
    setRows((prev) => prev.filter((entry) => !ids.has(getSavedQueryItemId(entry.item))));
  }, []);

  const refresh = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    setLoading(true);
    try {
      const localList = await backfillLocalSavedQueryLocationHeaders(await loadSavedQueries());
      if (seq !== refreshSeqRef.current) return;

      if (!isAuthenticated) {
        const guestItems = (Array.isArray(localList) ? localList : []) as SavedQueryItem[];
        setRows(buildDisplayRows(guestItems));
        return;
      }

      const apiRes = await listSavedQueriesApi();
      if (seq !== refreshSeqRef.current) return;

      if (!apiRes.ok || !Array.isArray(apiRes.results)) {
        const fallbackItems = (Array.isArray(localList) ? localList : []) as SavedQueryItem[];
        setRows(buildDisplayRows(fallbackItems));
        if (__DEV__ && !apiRes.ok) {
          console.warn("[useSavedQueriesList] API liste alınamadı, yerel gösteriliyor:", apiRes.error);
        }
        return;
      }

      const localByKey = buildLocalByKey(localList);
      const merged = mergeAuthenticatedList(localByKey, apiRes.results);

      setRows(buildDisplayRows(merged));
      if (__DEV__) {
        console.log(
          `[useSavedQueriesList] ${merged.length} kayıt (api: ${apiRes.results.length}, yerel önbellek: ${localList.length})`,
        );
      }
    } catch (e) {
      if (seq !== refreshSeqRef.current) return;
      console.warn("[useSavedQueriesList] refresh hatası:", e);
      try {
        const fallback = await loadSavedQueries();
        if (seq !== refreshSeqRef.current) return;
        setRows(buildDisplayRows((Array.isArray(fallback) ? fallback : []) as SavedQueryItem[]));
      } catch {
        if (seq !== refreshSeqRef.current) return;
        setRows([]);
      }
    } finally {
      if (seq === refreshSeqRef.current) {
        setLoading(false);
      }
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

  const items = rows.map((r) => r.item);

  return { loading, items, rows, refresh, pruneItems };
}
