import type {
  AdaparselParcelDetailResult,
  AdaparselParcelLookupParams,
} from '../../services/adaparselAlertService';
import { fetchAdaparselParcelDetail } from '../../services/adaparselAlertService';
import { logSimpleQuery } from './simpleQueryLogger';

type CacheEntry = {
  promise: Promise<AdaparselParcelDetailResult>;
  result?: AdaparselParcelDetailResult;
};

const detailCache = new Map<string, CacheEntry>();

export function buildAdaparselLookupCacheKey(params: AdaparselParcelLookupParams): string {
  return `${params.proparcelValue}:${params.ada.trim()}:${params.parsel.trim()}:${(params.mahalle ?? '').trim()}:${(params.il ?? '').trim()}:${params.townId ?? ''}`;
}

export function prefetchAdaparselParcelDetail(
  params: AdaparselParcelLookupParams,
): Promise<AdaparselParcelDetailResult> {
  const key = buildAdaparselLookupCacheKey(params);
  const existing = detailCache.get(key);
  if (existing) {
    return existing.promise;
  }

  logSimpleQuery('adaparsel_detail_prefetch_start', { key, params });
  const fetchStart = performance.now();
  const promise = fetchAdaparselParcelDetail(params)
    .then((result) => {
      const detailFetchMs = Math.round(performance.now() - fetchStart);
      logSimpleQuery('adaparsel_detail_prefetch_done', {
        key,
        found: result.found,
        detailFetchMs,
      });
      if (!result.found) {
        detailCache.delete(key);
      } else {
        const entry = detailCache.get(key);
        if (entry) entry.result = result;
      }
      return result;
    })
    .catch((error) => {
      detailCache.delete(key);
      throw error;
    });

  detailCache.set(key, { promise });
  return promise;
}

export function getCachedAdaparselParcelDetail(
  params: AdaparselParcelLookupParams,
): AdaparselParcelDetailResult | null {
  return detailCache.get(buildAdaparselLookupCacheKey(params))?.result ?? null;
}

export function getOrFetchAdaparselParcelDetail(
  params: AdaparselParcelLookupParams,
): Promise<AdaparselParcelDetailResult> {
  const cached = getCachedAdaparselParcelDetail(params);
  if (cached) {
    logSimpleQuery('adaparsel_detail_cache_hit', { params });
    return Promise.resolve(cached);
  }
  return prefetchAdaparselParcelDetail(params);
}

export function clearAdaparselDetailCache(): void {
  detailCache.clear();
}
