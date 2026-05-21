import { extractDfaSnapshotId } from './proQueryMapCapture';
import { extractProQueryCityId, resolveDfaSnapshotId, extractProQueryIdentifiers } from './proQueryApi';

type RouterLike = {
  push: (pathname: string, params?: Record<string, string>) => void;
};

export type NavigateAfterProQueryResult = {
  snapshotId: number | null;
  cityId: number | null;
};

/**
 * Snapshot hazır olana kadar bekler; sonra portal detay veya listeye gider.
 */
export async function navigateAfterProQuery(
  router: RouterLike,
  data: any,
): Promise<NavigateAfterProQueryResult> {
  let snapshotId = extractDfaSnapshotId(data);
  if (!snapshotId) {
    snapshotId = await resolveDfaSnapshotId(data, extractProQueryIdentifiers(data));
  }

  const cityId = extractProQueryCityId(data);

  if (snapshotId) {
    router.push('son-30-gun-detay', {
      snapshotId: String(snapshotId),
      fromProQuery: '1',
    });
    return { snapshotId, cityId };
  }

  console.warn('[proQueryNavigation] snapshot_id yok — son 30 gün listesine yönlendiriliyor');
  router.push('son-30-gun');
  return { snapshotId: null, cityId };
}
