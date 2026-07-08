import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PortalQueryListParams } from '../types/portal';

const STORAGE_KEY = 'pp.portal.recentQueries.listSession';

export type PortalRecentQueriesListSession = {
  appliedFilters: PortalQueryListParams;
  mineOnly: boolean;
};

let memorySession: PortalRecentQueriesListSession | null = null;

const IGNORED_FILTER_KEYS = new Set(['page', 'page_size', 'exclude_listing_source', 'nocache', 'mine']);

export function savePortalRecentQueriesListSession(session: PortalRecentQueriesListSession): void {
  memorySession = session;
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session)).catch(() => {});
}

export async function loadPortalRecentQueriesListSession(): Promise<PortalRecentQueriesListSession | null> {
  if (memorySession) return memorySession;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalRecentQueriesListSession;
    if (!parsed || typeof parsed !== 'object') return null;
    memorySession = {
      appliedFilters: parsed.appliedFilters && typeof parsed.appliedFilters === 'object' ? parsed.appliedFilters : {},
      mineOnly: Boolean(parsed.mineOnly),
    };
    return memorySession;
  } catch {
    return null;
  }
}

/** Son liste oturumunda geri yüklenecek anlamlı filtre var mı? */
export function portalRecentQueriesSessionHasListContext(
  session: PortalRecentQueriesListSession | null | undefined,
): boolean {
  if (!session?.appliedFilters) return false;
  return Object.entries(session.appliedFilters).some(([key, value]) => {
    if (IGNORED_FILTER_KEYS.has(key)) return false;
    if (value == null || value === '') return false;
    return true;
  });
}
