import { createSavedQueryApi } from '../../services/savedQueriesApi';
import { getPortalRecentQueryDetail } from '../../services/portalService';
import { extractDfaSnapshotId } from './proQueryMapCapture';
import {
  extractProQueryCityId,
  resolveProQuerySnapshotId,
} from './proQueryApi';

type RouterLike = {
  push: (pathname: string, params?: Record<string, string>) => void;
};

export type NavigateAfterProQueryResult = {
  snapshotId: number | null;
  cityId: number | null;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForPortalDetailReady(snapshotId: number, maxMs = 20000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  let delayMs = 700;

  while (Date.now() < deadline) {
    const res = await getPortalRecentQueryDetail(snapshotId);
    if (res.ok) return true;
    if (res.status === 404 || res.status === 500 || res.status === 503) {
      await sleep(delayMs);
      delayMs = Math.min(delayMs + 350, 2500);
      continue;
    }
    return false;
  }

  return false;
}

export type ProSavedQueryApiPayload = {
  tkgm_value: number;
  ada: string;
  parsel: string;
  title: string;
  proparcel_value?: number | null;
};

/** Pro sorgu tamamlandıktan sonra backend Sorgularım kaydı (dfa_snapshot_id zorunlu). */
export async function saveProQueryToApi(
  data: any,
  payload: ProSavedQueryApiPayload,
  logTag = 'proQuery',
): Promise<void> {
  const snapshotId = await resolveProQuerySnapshotId(data);
  if (!snapshotId) {
    console.warn(`[${logTag}] dfa_snapshot_id yok, API kaydı atlandı`);
    return;
  }

  try {
    const apiRes = await createSavedQueryApi({
      ...payload,
      dfa_snapshot_id: snapshotId,
    });
    if (!apiRes.ok) {
      console.warn(`[${logTag}] API kayıt hatası:`, apiRes.error);
    } else {
      console.log(`[${logTag}] API kayıt başarılı, id:`, apiRes.data?.id);
    }
  } catch (apiErr) {
    console.warn(`[${logTag}] API kayıt exception:`, apiErr);
  }
}

/**
 * Snapshot hazır olana kadar bekler; sonra portal detay veya listeye gider.
 */
export async function navigateAfterProQuery(
  router: RouterLike,
  data: any,
): Promise<NavigateAfterProQueryResult> {
  let snapshotId = extractDfaSnapshotId(data);
  if (!snapshotId) {
    snapshotId = await resolveProQuerySnapshotId(data);
  }

  const cityId = extractProQueryCityId(data);

  if (snapshotId) {
    const ready = await waitForPortalDetailReady(snapshotId);
    if (!ready) {
      console.warn(
        '[proQueryNavigation] detay API henüz hazır değil, yine de açılıyor snapshotId=',
        snapshotId,
      );
    }
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
