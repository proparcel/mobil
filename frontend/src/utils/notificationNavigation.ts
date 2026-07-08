/**
 * Bildirim tıklama → portal detay (son-30-gun-detay) navigasyonu.
 */

import { StackActions } from '@react-navigation/native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { API_URL } from '../../config/api';
import { storageService } from '../../services/storageService';
import { extractSnapshotIdFromPayload } from './proQueryApi';
import type { NavigationProp } from '../hooks/useNavigation';
import type { ProQueryJobCompletePayload } from '../../services/proQueryJobTracker';

export type PortalDetailTarget = {
  snapshotId: string;
  commentId?: string;
  ratingId?: string;
};

export type PortalDetailNotificationData = {
  dfa_snapshot_id?: number | string | null;
  snapshotId?: number | string | null;
  commentId?: number | string | null;
  comment_id?: number | string | null;
  ratingId?: number | string | null;
  rating_id?: number | string | null;
  deep_link?: string | null;
  deepLink?: string | null;
  job_id?: string | null;
};

type NavLike =
  | NavigationProp
  | NavigationContainerRefWithCurrent<Record<string, object | undefined>>
  | {
      navigate?: (...args: unknown[]) => void;
      push?: (...args: unknown[]) => void;
      dispatch?: (...args: unknown[]) => void;
      current?: NavLike | null;
      isReady?: () => boolean;
    }
  | null
  | undefined;

type RouterPushLike = {
  push: (path: string, params?: Record<string, string>) => void;
};

const SOCIAL_COMMENT_TYPES = new Set([
  'comment_reply',
  'comment_like',
  'comment_on_your_query',
]);

const SOCIAL_RATING_TYPES = new Set(['query_rated']);

export const SOCIAL_NOTIFICATION_TYPES = new Set([
  ...SOCIAL_COMMENT_TYPES,
  ...SOCIAL_RATING_TYPES,
]);

function positiveIntString(raw: unknown): string | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.trunc(n));
}

/** API bazen data_json'u string döndürebilir. */
export function normalizeNotificationDataJson(
  raw: unknown,
): PortalDetailNotificationData {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as PortalDetailNotificationData) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as PortalDetailNotificationData;
  return {};
}

function normalizeDeepLinkPath(deepLink: string): URL | null {
  const trimmed = String(deepLink ?? '').trim();
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
    if (trimmed.startsWith('/')) {
      return new URL(`https://proparcel.com${trimmed}`);
    }
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/** `/portal/recent-queries/123?comment=456` veya tam URL → hedef paramlar. */
export function parsePortalSnapshotDeepLink(deepLink: string): PortalDetailTarget | null {
  const url = normalizeDeepLinkPath(deepLink);
  if (!url) return null;

  const path = url.pathname.replace(/\/+$/, '') || '/';
  const snapshotMatch = path.match(/^\/portal\/recent-queries\/(\d+)$/i);
  if (!snapshotMatch) return null;

  const target: PortalDetailTarget = { snapshotId: snapshotMatch[1] };
  const commentId = positiveIntString(url.searchParams.get('comment'));
  const ratingId = positiveIntString(url.searchParams.get('rating'));
  if (commentId) target.commentId = commentId;
  if (ratingId) target.ratingId = ratingId;
  return target;
}

export function resolvePortalDetailTarget(
  data: PortalDetailNotificationData | null | undefined,
): PortalDetailTarget | null {
  const normalized = normalizeNotificationDataJson(data);
  if (!normalized || typeof normalized !== 'object') return null;

  const snapshotRaw = normalized.dfa_snapshot_id ?? normalized.snapshotId;
  const snapshotId = positiveIntString(snapshotRaw);

  const commentId = positiveIntString(normalized.commentId ?? normalized.comment_id);
  const ratingId = positiveIntString(normalized.ratingId ?? normalized.rating_id);

  if (snapshotId) {
    const target: PortalDetailTarget = { snapshotId };
    if (commentId) target.commentId = commentId;
    if (ratingId) target.ratingId = ratingId;
    return target;
  }

  const deepLink = String(normalized.deep_link ?? normalized.deepLink ?? '').trim();
  if (deepLink) {
    const fromLink = parsePortalSnapshotDeepLink(deepLink);
    if (fromLink) return fromLink;
  }

  return null;
}

export function buildPortalDetailParams(
  target: PortalDetailTarget,
  opts?: { fromProQuery?: boolean },
): Record<string, string> {
  const params: Record<string, string> = { snapshotId: target.snapshotId };
  if (target.commentId) params.commentId = target.commentId;
  if (target.ratingId) params.ratingId = target.ratingId;
  if (opts?.fromProQuery) params.fromProQuery = '1';
  return params;
}

export function getRootNavigator(nav: NavLike): NavLike {
  if (!nav) return null;
  const root = nav as {
    navigate?: (...args: unknown[]) => void;
    dispatch?: (...args: unknown[]) => void;
    current?: NavLike | null;
    isReady?: () => boolean;
  };
  if (typeof root.isReady === 'function' && !root.isReady()) return null;
  if (typeof root.navigate === 'function' || typeof root.dispatch === 'function') return nav;
  if (root.current) return getRootNavigator(root.current);
  return null;
}

export function navigateToPortalDetail(
  nav: NavLike,
  target: PortalDetailTarget,
  opts?: { fromProQuery?: boolean },
): boolean {
  const root = getRootNavigator(nav);
  if (!root || !target.snapshotId) return false;

  const params = buildPortalDetailParams(target, opts);
  const rootNav = root as {
    push?: (...args: unknown[]) => void;
    navigate?: (...args: unknown[]) => void;
    dispatch?: (...args: unknown[]) => void;
  };

  if (typeof rootNav.push === 'function') {
    rootNav.push('son-30-gun-detay' as never, params as never);
    return true;
  }
  if (typeof rootNav.dispatch === 'function') {
    rootNav.dispatch(StackActions.push('son-30-gun-detay', params));
    return true;
  }
  if (typeof rootNav.navigate === 'function') {
    rootNav.navigate('son-30-gun-detay' as never, params as never);
    return true;
  }
  return false;
}

export function pushPortalDetailViaRouter(
  router: RouterPushLike,
  target: PortalDetailTarget,
  opts?: { fromProQuery?: boolean },
): boolean {
  if (!target.snapshotId) return false;
  router.push('son-30-gun-detay', buildPortalDetailParams(target, opts));
  return true;
}

export function handleSocialNotificationTap(
  router: RouterPushLike,
  type: string,
  dataJson: PortalDetailNotificationData | null | undefined,
): boolean {
  const notifType = String(type || '').trim();
  if (!SOCIAL_NOTIFICATION_TYPES.has(notifType)) return false;

  const target = resolvePortalDetailTarget(dataJson);
  if (!target) return false;

  return pushPortalDetailViaRouter(router, target);
}

export function buildProQueryCompletePayload(
  data: PortalDetailNotificationData & { job_id?: string | null },
) {
  const normalized = normalizeNotificationDataJson(data);
  const target = resolvePortalDetailTarget(normalized);
  return {
    jobId: String(normalized.job_id ?? ''),
    snapshotId: target ? Number(target.snapshotId) : null,
    deepLink: String(normalized.deep_link ?? normalized.deepLink ?? '').trim() || undefined,
    result: null as Record<string, unknown> | null,
  };
}

async function authFetchJobResult(jobId: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-PP-Client': 'mobile',
  };
  try {
    const tokens = await storageService.getTokens();
    if (tokens?.access) headers.Authorization = `Bearer ${tokens.access}`;
  } catch {
    // anonim
  }
  const base = (API_URL || '').replace(/\/$/, '');
  return fetch(`${base}/api/get_parcel_result/${encodeURIComponent(jobId)}/`, {
    method: 'GET',
    headers,
  });
}

/** Web `ppResolveProQuerySnapshotId` — job_id ile snapshot çöz. */
export async function resolveSnapshotIdFromJobId(jobId: string): Promise<number | null> {
  const id = String(jobId || '').trim();
  if (!id) return null;

  const backoffMs = [300, 500, 800];
  for (let i = 0; i < backoffMs.length; i += 1) {
    try {
      const resp = await authFetchJobResult(id);
      if (resp.ok) {
        const body = await resp.json().catch(() => null);
        const resolved = extractSnapshotIdFromPayload(body);
        if (resolved) return resolved;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, backoffMs[i]));
  }
  return null;
}

export async function resolveProQueryDetailTarget(
  payload: Pick<ProQueryJobCompletePayload, 'snapshotId' | 'deepLink' | 'jobId' | 'result'>,
): Promise<PortalDetailTarget | null> {
  const direct = resolvePortalDetailTarget({
    dfa_snapshot_id: payload.snapshotId,
    snapshotId: payload.snapshotId,
    deep_link: payload.deepLink,
    job_id: payload.jobId,
  });
  if (direct) return direct;

  const fromResult = extractSnapshotIdFromPayload(payload.result);
  if (fromResult) return { snapshotId: String(fromResult) };

  const fromJob = await resolveSnapshotIdFromJobId(payload.jobId);
  if (fromJob) return { snapshotId: String(fromJob) };

  return null;
}

export async function openPortalDetailFromProQueryNotification(
  nav: NavLike,
  payload: ProQueryJobCompletePayload,
): Promise<boolean> {
  const target = await resolveProQueryDetailTarget(payload);
  if (!target) return false;
  return navigateToPortalDetail(nav, target, { fromProQuery: true });
}

export async function openPortalDetailFromProQueryData(
  router: RouterPushLike,
  data: PortalDetailNotificationData,
): Promise<boolean> {
  const normalized = normalizeNotificationDataJson(data);
  const built = buildProQueryCompletePayload(normalized);
  const target = await resolveProQueryDetailTarget(built);
  if (!target) return false;
  return pushPortalDetailViaRouter(router, target, { fromProQuery: true });
}
