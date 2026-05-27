/**
 * Global deep link dinleyicisi — NavigationContainer hazır olunca yönlendirir.
 */

import { useCallback, useEffect } from 'react';
import { Linking } from 'react-native';
import { parseProParcelDeepLink } from '../utils/deepLinkRouter';
import { storageService } from '../../services/storageService';

type NavLike = {
  navigate: (screen: string, params?: object) => void;
} | null;

export function useDeepLinkNavigation(getNavigation: () => NavLike, isReady: boolean) {
  const navigateFromUrl = useCallback(
    (url: string) => {
      const target = parseProParcelDeepLink(url);
      const nav = getNavigation();
      if (!target || !nav) return false;
      try {
        nav.navigate(target.screen, target.params);
        return true;
      } catch (err) {
        if (__DEV__) console.warn('[useDeepLinkNavigation] navigate:', err);
        return false;
      }
    },
    [getNavigation],
  );

  const flushDeferred = useCallback(async () => {
    try {
      const deferred = await storageService.getDeferredOpenDeepLink();
      if (deferred) {
        await storageService.clearDeferredOpenDeepLink();
        navigateFromUrl(deferred);
      }
    } catch {
      /* ignore */
    }
  }, [navigateFromUrl]);

  useEffect(() => {
    if (!isReady) return;
    void flushDeferred();
  }, [isReady, flushDeferred]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      if (!url) return;
      if (isReady) {
        navigateFromUrl(url);
      } else {
        void storageService.setDeferredOpenDeepLink(url);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener('url', (e) => {
      handleUrl(e?.url ?? '');
    });

    return () => sub.remove();
  }, [isReady, navigateFromUrl]);
}
