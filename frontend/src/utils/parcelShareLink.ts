/**
 * Parsel paylaşım linki — portal detay URL (mobile_view=1), yoksa /query yedek.
 */

import { portalDetailShareMessageUrl } from '../../config/portalSite';
import { extractDfaSnapshotId } from './proQueryMapCapture';
import { extractProQueryIdentifiers, resolveDfaSnapshotId } from './proQueryApi';

export type ParcelShareLinkOptions = {
  snapshotId?: number | null;
  listingId?: string | number | null;
  preferListing?: boolean;
};

export function buildParcelShareMessageUrlSync(
  parcelData?: any | null,
  options: ParcelShareLinkOptions = {},
): string | null {
  const snapshotId =
    options.snapshotId != null && Number.isFinite(Number(options.snapshotId)) && Number(options.snapshotId) > 0
      ? Number(options.snapshotId)
      : extractDfaSnapshotId(parcelData);

  const listingId = String(options.listingId ?? parcelData?.listing_id ?? '').trim() || undefined;

  if (snapshotId) {
    const portalUrl = portalDetailShareMessageUrl({
      snapshotId,
      listingId,
      preferListing: options.preferListing,
    });
    if (portalUrl) return portalUrl;
  }

  return null;
}

export async function resolveParcelShareMessageUrl(
  parcelData?: any | null,
  options: ParcelShareLinkOptions = {},
): Promise<string | null> {
  const immediate = buildParcelShareMessageUrlSync(parcelData, options);
  if (immediate) return immediate;

  if (parcelData) {
    try {
      const resolved = await resolveDfaSnapshotId(parcelData, extractProQueryIdentifiers(parcelData));
      if (resolved) {
        const portalUrl = portalDetailShareMessageUrl({
          snapshotId: resolved,
          listingId: options.listingId ?? parcelData?.listing_id,
          preferListing: options.preferListing,
        });
        if (portalUrl) return portalUrl;
      }
    } catch {
      /* yedek link */
    }
  }

  const { generateUniversalLink } = await import('./queryUrlGenerator');
  return parcelData ? generateUniversalLink(parcelData) : null;
}

export function formatParcelShareMessage(link: string | null): string | null {
  if (!link) return null;
  return `ProParcel'de bu parseli görüntüle:\n${link}`;
}

/**
 * Paylaşım sırasında link — uzun snapshot poll yok (kullanıcı beklemesin).
 * Snapshot yoksa hemen /query?mobile_view=1 yedek.
 */
export async function resolveParcelShareMessageUrlForShare(
  parcelData?: any | null,
  options: ParcelShareLinkOptions = {},
): Promise<string | null> {
  const sync = buildParcelShareMessageUrlSync(parcelData, options);
  if (sync) return sync;
  const { generateUniversalLink } = await import('./queryUrlGenerator');
  return parcelData ? generateUniversalLink(parcelData) : null;
}
