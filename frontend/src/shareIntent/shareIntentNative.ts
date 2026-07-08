/**
 * expo-share-intent güvenli yükleme — native modül yoksa (eski APK / HMR) çökmez.
 */

import React from 'react';

type ShareIntentContextValue = {
  hasShareIntent: boolean;
  shareIntent: {
    files?: Array<{ path?: string; mimeType?: string; fileName?: string }>;
  } | null;
  resetShareIntent: (clearNative?: boolean) => void;
  error: string | null;
};

let didWarnMissingNative = false;

function isExpoLinkingNativeAvailable(): boolean {
  try {
    const { requireNativeModule } = require('expo-modules-core') as {
      requireNativeModule: (name: string) => unknown;
    };
    requireNativeModule('ExpoLinking');
    return true;
  } catch {
    return false;
  }
}

type ShareIntentModule = {
  ShareIntentProvider: React.ComponentType<{ children: React.ReactNode }>;
  useShareIntentContext: () => ShareIntentContextValue;
};

let cachedModule: ShareIntentModule | null | undefined;

function loadShareIntentModule(): ShareIntentModule | null {
  if (cachedModule !== undefined) return cachedModule;

  if (!isExpoLinkingNativeAvailable()) {
    if (__DEV__ && !didWarnMissingNative) {
      didWarnMissingNative = true;
      console.warn(
        '[ShareIntent] ExpoLinking native modülü yok. Paylaşım için Android/iOS native build yenileyin (prebuild + run-android / EAS).',
      );
    }
    cachedModule = null;
    return null;
  }

  try {
    cachedModule = require('expo-share-intent') as ShareIntentModule;
    return cachedModule;
  } catch (err) {
    if (__DEV__ && !didWarnMissingNative) {
      didWarnMissingNative = true;
      console.warn('[ShareIntent] expo-share-intent yüklenemedi:', err);
    }
    cachedModule = null;
    return null;
  }
}

export function isShareIntentNativeReady(): boolean {
  return loadShareIntentModule() != null;
}

export function ShareIntentProvider({ children }: { children: React.ReactNode }) {
  const mod = loadShareIntentModule();
  if (!mod) return React.createElement(React.Fragment, null, children);
  return React.createElement(mod.ShareIntentProvider, null, children);
}
