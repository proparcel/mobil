/**
 * Pro sorgu harita görüntüsü — QueryDfaSnapshot.map_image
 * POST /api/user/query-map-image/
 */

import { authJsonFetch } from './apiClient';

export type UploadQueryMapImagePayload = {
  snapshot_id?: number;
  proparcel_value?: number | null;
  ada?: string;
  parsel?: string;
  /** data:image/png;base64,... veya ham base64 */
  image: string;
};

export async function uploadQueryMapImage(
  payload: UploadQueryMapImagePayload
): Promise<{ ok: true; map_image_url?: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ ok?: boolean; map_image_url?: string; error?: string }>(
    '/api/user/query-map-image/',
    {
      method: 'POST',
      json: {
        image: payload.image,
        ...(payload.snapshot_id != null ? { snapshot_id: payload.snapshot_id } : {}),
        ...(payload.proparcel_value != null ? { proparcel_value: payload.proparcel_value } : {}),
        ...(payload.ada ? { ada: payload.ada } : {}),
        ...(payload.parsel ? { parsel: payload.parsel } : {}),
      },
    }
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, map_image_url: res.data?.map_image_url };
}
