/**
 * Ana sayfa parsel paylaşım linki — ada/parsel (veya koordinat).
 * Pro sorgu detay paylaşımı için `portalDetailShareMessageUrl` (snapshot id) kullanın.
 */

import { generateUniversalLink, type ParselData } from './queryUrlGenerator';

export function buildParcelShareMessageUrlSync(parcelData?: ParselData | null): string | null {
  if (!parcelData) return null;
  return generateUniversalLink(parcelData);
}

export async function resolveParcelShareMessageUrlForShare(
  parcelData?: ParselData | null,
): Promise<string | null> {
  return buildParcelShareMessageUrlSync(parcelData);
}

export function formatParcelShareMessage(link: string | null): string | null {
  if (!link) return null;
  return link;
}
