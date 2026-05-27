/**
 * Tasarımlı parsel paylaşımı — state + capture; JSX ayrı host bileşeninde.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { runDesignedParcelShare } from '../utils/designedParcelShare';

export type DesignedParcelShareJob = {
  parcelData: any;
  shareLink: string;
  staticMapGeometry?: { type: string; coordinates: unknown } | null;
  isProMode?: boolean;
  priceOverride?: { unitPrice?: number | null; totalPrice?: number | null } | null;
};

type ActiveCapture = DesignedParcelShareJob & { requestId: number };

export function useDesignedParcelShare() {
  const combinedContainerRef = useRef<{ capture?: () => Promise<string> } | null>(null);
  const [capturedMapUri, setCapturedMapUri] = useState<string | null>(null);
  const [activeCapture, setActiveCapture] = useState<ActiveCapture | null>(null);
  const pendingRef = useRef<{ resolve: (ok: boolean) => void; requestId: number } | null>(null);
  const isSharingRef = useRef(false);
  const requestSeqRef = useRef(0);

  const shareDesignedParcel = useCallback(async (input: DesignedParcelShareJob): Promise<boolean> => {
    const requestId = ++requestSeqRef.current;
    return new Promise<boolean>((resolve) => {
      pendingRef.current = { resolve, requestId };
      setCapturedMapUri(null);
      setActiveCapture({ ...input, requestId });
    });
  }, []);

  useEffect(() => {
    if (!activeCapture) return;

    const { requestId } = activeCapture;
    let cancelled = false;

    (async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled) return;

      const ok = await runDesignedParcelShare({
        parcelData: activeCapture.parcelData,
        shareLink: activeCapture.shareLink,
        combinedContainerRef,
        setCapturedMapUri,
        isSharingRef,
        staticMapGeometry: activeCapture.staticMapGeometry,
        isProMode: activeCapture.isProMode ?? true,
        priceOverride: activeCapture.priceOverride,
      });

      if (cancelled || pendingRef.current?.requestId !== requestId) return;

      pendingRef.current?.resolve(ok);
      pendingRef.current = null;
      setActiveCapture(null);
      setCapturedMapUri(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCapture?.requestId]);

  return {
    shareDesignedParcel,
    combinedContainerRef,
    capturedMapUri,
    activeCapture,
    isShareCapturing: activeCapture != null,
  };
}
