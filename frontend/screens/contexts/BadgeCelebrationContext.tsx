import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { BadgeCelebrationPayload } from '../../src/types/badges';

type Ctx = {
  pending: BadgeCelebrationPayload | null;
  setPending: (p: BadgeCelebrationPayload | null) => void;
  clearPending: () => void;
};

const BadgeCelebrationContext = createContext<Ctx | null>(null);

export function BadgeCelebrationProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<BadgeCelebrationPayload | null>(null);
  const clearPending = useCallback(() => setPending(null), []);
  const value = useMemo(() => ({ pending, setPending, clearPending }), [pending, clearPending]);
  return <BadgeCelebrationContext.Provider value={value}>{children}</BadgeCelebrationContext.Provider>;
}

export function useBadgeCelebration() {
  const ctx = useContext(BadgeCelebrationContext);
  if (!ctx) {
    return {
      pending: null as BadgeCelebrationPayload | null,
      setPending: () => {},
      clearPending: () => {},
    };
  }
  return ctx;
}
