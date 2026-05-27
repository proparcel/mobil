/**
 * Profil ekranından açılan alt sayfalarda geri → profil (bireysel detayda index.replace engeli).
 */
import { useCallback } from 'react';
import { useRouter, useLocalSearchParams } from '../hooks/useNavigation';
import type {
  ProfileReturnRouteParams,
  ProfileSectionId,
} from '../../components/app/profileSectionTypes';

const PROFILE_SECTION_IDS = new Set<ProfileSectionId>([
  'genel',
  'puan_yorumlar',
  'rozetler',
  'ilanlar',
  'prosorgular',
  'kullanimlarim',
  'hesap',
  'uzmanlik',
  'firma',
  'ayarlar',
  'danisman',
]);

export type { ProfileReturnRouteParams };

export function parseProfileSectionParam(raw: unknown): ProfileSectionId | null {
  const s = String(raw || '').trim() as ProfileSectionId;
  return PROFILE_SECTION_IDS.has(s) ? s : null;
}

export function withProfileReturn<P extends Record<string, unknown>>(
  params: P,
  section?: ProfileSectionId,
): P & ProfileReturnRouteParams {
  return {
    ...params,
    returnScreen: 'profile',
    ...(section ? { profileSection: section } : {}),
  };
}

export function isProfileReturn(params: { returnScreen?: string } | undefined | null): boolean {
  return String(params?.returnScreen || '').toLowerCase() === 'profile';
}

export function navigateBackFromProfileChild(
  router: ReturnType<typeof useRouter>,
  params: ProfileReturnRouteParams | undefined | null,
  fallback?: () => void,
): void {
  if (isProfileReturn(params)) {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const section = parseProfileSectionParam(params?.profileSection);
    router.replace('profile', section ? { profileSection: section } : undefined);
    return;
  }
  if (fallback) {
    fallback();
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('index');
}

export function useProfileReturnParams(): ProfileReturnRouteParams {
  return useLocalSearchParams<ProfileReturnRouteParams>();
}

export function useProfileAwareBack(fallback?: () => void) {
  const router = useRouter();
  const params = useProfileReturnParams();
  return useCallback(() => {
    navigateBackFromProfileChild(router, params, fallback);
  }, [router, params.returnScreen, params.profileSection, fallback]);
}
