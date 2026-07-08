/**
 * WhatsApp / sistem paylaşımından gelen görsel → otomatik Akıllı Sorgu (UI köprüsü).
 */

import React from 'react';
import { isShareIntentNativeReady } from '../shareIntent/shareIntentNative';
import {
  useIncomingShareImageListenerCore,
  type IncomingShareImageListenerProps,
  type ShareIntentContextValue,
} from './incomingShareImageListenerCore';

export type { IncomingShareImageListenerProps } from './incomingShareImageListenerCore';

function IncomingShareImageListenerDeferredOnly(props: IncomingShareImageListenerProps) {
  useIncomingShareImageListenerCore({ ...props, shareIntentCtx: null });
  return null;
}

function IncomingShareImageListenerNative(props: IncomingShareImageListenerProps) {
  const { useShareIntentContext } = require('expo-share-intent') as {
    useShareIntentContext: () => ShareIntentContextValue;
  };
  const shareIntentCtx = useShareIntentContext();
  useIncomingShareImageListenerCore({ ...props, shareIntentCtx });
  return null;
}

/** Native modül yoksa yalnızca deferred flush; varsa canlı paylaşım intent'i de dinler. */
export function IncomingShareImageListener(props: IncomingShareImageListenerProps) {
  if (isShareIntentNativeReady()) {
    return <IncomingShareImageListenerNative {...props} />;
  }
  return <IncomingShareImageListenerDeferredOnly {...props} />;
}
