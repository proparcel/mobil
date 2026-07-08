/**
 * Paylaşılan görsel intent işleme — JSX yok (Metro/HMR güvenli).
 */

import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../screens/contexts/AuthContext';
import { storageService } from '../../services/storageService';
import {
  canUseSmartQuery,
  promptSmartQueryLogin,
  promptSmartQueryUpgrade,
} from '../utils/customerFeatureGates';
import {
  cleanupIncomingShareImageFile,
  readIncomingShareImageFile,
  type IncomingShareImageFile,
} from '../utils/incomingShareImage';
import { dispatchIncomingShareImage } from '../utils/incomingShareImageBridge';

export type NavLike = {
  navigate: (screen: string, params?: object) => void;
} | null;

export type IncomingShareImageListenerProps = {
  navReady: boolean;
  getNavigation: () => NavLike;
  onNavigatePricing?: () => void;
};

export type ShareIntentContextValue = {
  hasShareIntent: boolean;
  shareIntent: {
    files?: Array<{ path?: string; mimeType?: string; fileName?: string }>;
  } | null;
  resetShareIntent: (clearNative?: boolean) => void;
  error: string | null;
};

function pickShareImageFile(
  files: Array<{ path?: string; mimeType?: string; fileName?: string }> | null | undefined,
): IncomingShareImageFile | null {
  if (!files?.length) return null;
  const image =
    files.find((file) => {
      const mime = String(file.mimeType || '').toLowerCase();
      return mime.startsWith('image/');
    }) ?? files[0];
  if (!image?.path) return null;
  return {
    path: image.path,
    mimeType: image.mimeType || 'image/jpeg',
    fileName: image.fileName,
  };
}

function buildShareKey(file: IncomingShareImageFile): string {
  return `${file.path}|${file.mimeType}|${file.fileName || ''}`;
}

export function useIncomingShareImageListenerCore(
  props: IncomingShareImageListenerProps & {
    shareIntentCtx?: ShareIntentContextValue | null;
  },
) {
  const { navReady, getNavigation, onNavigatePricing, shareIntentCtx } = props;
  const hasShareIntent = shareIntentCtx?.hasShareIntent ?? false;
  const shareIntent = shareIntentCtx?.shareIntent ?? null;
  const resetShareIntent = shareIntentCtx?.resetShareIntent ?? (() => {});
  const error = shareIntentCtx?.error ?? null;

  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const processedShareKeyRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  const navigateToIndex = useCallback(() => {
    const nav = getNavigation();
    if (!nav) return;
    try {
      nav.navigate('index');
    } catch (err) {
      if (__DEV__) console.warn('[IncomingShareImage] navigate index:', err);
    }
  }, [getNavigation]);

  const processShareImageFile = useCallback(
    async (file: IncomingShareImageFile, options?: { skipAccessGate?: boolean }) => {
      if (processingRef.current) return 'busy' as const;
      processingRef.current = true;
      let shouldCleanupFile = true;

      try {
        if (!options?.skipAccessGate) {
          if (isAuthLoading) return 'auth_loading' as const;
          if (!isAuthenticated) {
            shouldCleanupFile = false;
            await storageService.setDeferredShareImage({
              path: file.path,
              mimeType: file.mimeType,
              receivedAt: Date.now(),
            });
            promptSmartQueryLogin(() => {
              const nav = getNavigation();
              nav?.navigate('login');
            });
            return 'deferred_login' as const;
          }
          if (!canUseSmartQuery(user)) {
            processedShareKeyRef.current = buildShareKey(file);
            promptSmartQueryUpgrade(onNavigatePricing);
            return 'blocked_package' as const;
          }
        } else if (!canUseSmartQuery(user)) {
          await storageService.clearDeferredShareImage();
          processedShareKeyRef.current = buildShareKey(file);
          promptSmartQueryUpgrade(onNavigatePricing);
          return 'blocked_package' as const;
        }

        navigateToIndex();

        const payload = await readIncomingShareImageFile(file);
        if (!payload) {
          Alert.alert('Akıllı Sorgu', 'Paylaşılan görsel okunamadı.');
          return 'read_failed' as const;
        }

        dispatchIncomingShareImage(payload);
        await storageService.clearDeferredShareImage();
        processedShareKeyRef.current = buildShareKey(file);
        return 'success' as const;
      } finally {
        processingRef.current = false;
        if (shouldCleanupFile) {
          await cleanupIncomingShareImageFile(file.path);
        }
      }
    },
    [getNavigation, isAuthLoading, isAuthenticated, navigateToIndex, onNavigatePricing, user],
  );

  const flushDeferredShareImage = useCallback(async () => {
    if (!navReady || isAuthLoading || !isAuthenticated) return;
    const deferred = await storageService.getDeferredShareImage();
    if (!deferred) return;
    await processShareImageFile(deferred, { skipAccessGate: true });
  }, [isAuthLoading, isAuthenticated, navReady, processShareImageFile]);

  useEffect(() => {
    if (!shareIntentCtx || !navReady || !hasShareIntent || isAuthLoading) return;

    const file = pickShareImageFile(shareIntent?.files);
    if (!file) {
      if (error) {
        Alert.alert('Akıllı Sorgu', 'Paylaşılan görsel alınamadı.');
      }
      resetShareIntent(true);
      return;
    }

    const shareKey = buildShareKey(file);
    if (processedShareKeyRef.current === shareKey) {
      resetShareIntent(true);
      return;
    }

    void processShareImageFile(file).then((result) => {
      if (result !== 'auth_loading' && result !== 'deferred_login') {
        resetShareIntent(true);
      }
    });
  }, [
    error,
    hasShareIntent,
    isAuthLoading,
    navReady,
    processShareImageFile,
    resetShareIntent,
    shareIntent,
    shareIntentCtx,
  ]);

  useEffect(() => {
    void flushDeferredShareImage();
  }, [flushDeferredShareImage]);
}
