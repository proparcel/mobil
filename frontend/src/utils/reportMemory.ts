// Simple in-memory cache for navigation between screens without serializing large payloads.
// NOTE: This is not persisted; it only survives while the app process is alive.

type CacheEntry = {
  createdAt: number;
  data: unknown;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function cleanup() {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (!v || (now - v.createdAt) > CACHE_TTL_MS) {
      cache.delete(k);
    }
  }
}

export function putReportMemory(cacheId: string, data: unknown) {
  cleanup();
  cache.set(String(cacheId), { createdAt: Date.now(), data });
}

export function getReportMemory<T = unknown>(cacheId: string): T | null {
  cleanup();
  const hit = cache.get(String(cacheId));
  return (hit?.data as T) ?? null;
}

