/**
 * ProParcel deep link / universal link ayrıştırma (https + proparcel://).
 */

export type SimpleQueryDeepLinkPayload =
  | { mahalleTkgmValue: number; mahalle: string; ada: string; parsel: string }
  | { lat: number; lon: number };

export type DeepLinkNavigationTarget =
  | { screen: 'index'; params: { deepLinkSimpleQuery: SimpleQueryDeepLinkPayload } }
  | {
      screen: 'son-30-gun-detay';
      params: { snapshotId?: string; listingId?: string; commentId?: string; ratingId?: string };
    }
  | { screen: 'listing-wizard'; params: { listingId: string; mode?: 'create' | 'edit'; forceEidsFirst?: string; returnSnapshotId?: string; eids?: string; eids_error?: string } }
  | { screen: 'nasil-yapilir'; params: { tab?: 'videos' | 'live' } | undefined };

const PROPARCEL_HOSTS = new Set(['proparcel.com', 'www.proparcel.com']);

function normalizeIncomingUrl(raw: string): URL | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith('proparcel://')) {
      const rest = trimmed.slice('proparcel://'.length);
      const qIdx = rest.indexOf('?');
      const pathPart = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
      const qs = qIdx >= 0 ? rest.slice(qIdx + 1) : '';
      const normalizedPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
      return new URL(`https://proparcel.com${normalizedPath}${qs ? `?${qs}` : ''}`);
    }
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function positiveQueryParam(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return String(Math.trunc(n));
}

function snapshotDetailParams(snapshotId: string, params: URLSearchParams) {
  const out: { snapshotId: string; commentId?: string; ratingId?: string } = { snapshotId };
  const commentId = positiveQueryParam(params, 'comment');
  const ratingId = positiveQueryParam(params, 'rating');
  if (commentId) out.commentId = commentId;
  if (ratingId) out.ratingId = ratingId;
  return out;
}

function parseSimpleQuerySearchParams(params: URLSearchParams): SimpleQueryDeepLinkPayload | null {
  const ada = params.get('ada');
  const parsel = params.get('parsel');
  const mtv = params.get('mahalleTkgmValue');
  const lat = params.get('lat');
  const lon = params.get('lon');

  if (ada && parsel && mtv) {
    const n = Number(mtv);
    if (!Number.isNaN(n)) {
      return { mahalleTkgmValue: n, mahalle: '', ada, parsel };
    }
  }
  if (lat && lon) {
    const nlat = Number(lat);
    const nlon = Number(lon);
    if (!Number.isNaN(nlat) && !Number.isNaN(nlon)) {
      return { lat: nlat, lon: nlon };
    }
  }
  return null;
}

/** https portal URL → proparcel:// ( /go/ dl parametresi için ). */
export function webUrlToAppDeepLink(webUrl: string): string | null {
  const parsed = normalizeIncomingUrl(webUrl);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  if (!PROPARCEL_HOSTS.has(host) && parsed.protocol !== 'proparcel:') return null;

  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  const qs = parsed.search ? parsed.search.slice(1) : '';

  if (path === '/query' || path.endsWith('/query')) {
    return qs ? `proparcel://query?${qs}` : 'proparcel://query';
  }

  const listingMatch = path.match(/^\/portal\/recent-queries\/listing\/([^/]+)$/i);
  if (listingMatch) {
    return `proparcel://portal/recent-queries/listing/${encodeURIComponent(listingMatch[1])}${qs ? `?${qs}` : ''}`;
  }

  const snapshotMatch = path.match(/^\/portal\/recent-queries\/(\d+)$/i);
  if (snapshotMatch) {
    return `proparcel://portal/recent-queries/${snapshotMatch[1]}${qs ? `?${qs}` : ''}`;
  }

  if (path === '/nasil-yapilir') {
    return qs ? `proparcel://nasil-yapilir?${qs}` : 'proparcel://nasil-yapilir';
  }

  return null;
}

export function parseProParcelDeepLink(rawUrl: string): DeepLinkNavigationTarget | null {
  const url = normalizeIncomingUrl(rawUrl);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  const isCustom = rawUrl.trim().startsWith('proparcel://');
  if (!isCustom && !PROPARCEL_HOSTS.has(host)) return null;

  const path = url.pathname.replace(/\/+$/, '') || '/';
  const params = url.searchParams;

  if (path === '/go') {
    const ul = params.get('ul');
    if (ul) return parseProParcelDeepLink(ul);
    const dl = params.get('dl');
    if (dl) return parseProParcelDeepLink(dl);
    return null;
  }

  if (path === '/query') {
    const payload = parseSimpleQuerySearchParams(params);
    if (payload) {
      return { screen: 'index', params: { deepLinkSimpleQuery: payload } };
    }
    return null;
  }

  const listingMatch = path.match(/^\/portal\/recent-queries\/listing\/([^/]+)$/i);
  if (listingMatch) {
    return {
      screen: 'son-30-gun-detay',
      params: { listingId: decodeURIComponent(listingMatch[1]) },
    };
  }

  const snapshotMatch = path.match(/^\/portal\/recent-queries\/(\d+)$/i);
  if (snapshotMatch) {
    return {
      screen: 'son-30-gun-detay',
      params: snapshotDetailParams(snapshotMatch[1], params),
    };
  }

  if (path === '/nasil-yapilir') {
    const tab = params.get('tab');
    if (tab === 'live' || tab === 'videos') {
      return { screen: 'nasil-yapilir', params: { tab } };
    }
    return { screen: 'nasil-yapilir', params: undefined };
  }

  if (path === '/listing-wizard' || path.endsWith('/listing-wizard')) {
    const listingId = params.get('listingId') || params.get('listing_id') || '';
    if (!listingId.trim()) return null;
    return {
      screen: 'listing-wizard',
      params: {
        listingId: listingId.trim(),
        mode: params.get('mode') === 'edit' ? 'edit' : 'create',
        forceEidsFirst: params.get('forceEidsFirst') || undefined,
        returnSnapshotId: params.get('returnSnapshotId') || undefined,
        eids: params.get('eids') || undefined,
        eids_error: params.get('eids_error') || undefined,
      },
    };
  }

  return null;
}
