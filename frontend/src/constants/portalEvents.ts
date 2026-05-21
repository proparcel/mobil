/** Portal son 30 gün listesi / detay senkronizasyonu */
export const PORTAL_RECENT_QUERIES_CHANGED = 'portalRecentQueriesChanged';

export type PortalRecentQueriesChangedPayload = {
  snapshotId?: number;
  cityId?: number;
};
