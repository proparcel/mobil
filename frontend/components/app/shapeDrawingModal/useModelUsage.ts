/**
 * useModelUsage Hook
 * 
 * Manages model usage count state and provides helper functions
 * for checking and updating usage counts.
 */

import { useState, useCallback, useMemo } from "react";
import { isModelUsable } from "@/src/services/modelUsageService";

/**
 * Model usage map: modelId (number) -> remaining uses (number | null)
 */
type ModelUsageMap = Record<number, number | null>;

type UseModelUsageReturn = {
  /**
   * Usage count map: modelId -> remaining uses
   */
  modelUsageMap: ModelUsageMap;
  
  /**
   * Update usage count for a specific model
   */
  updateModelUsage: (modelId: number, newCount: number | null) => void;
  
  /**
   * Get remaining uses for a model
   */
  getRemainingUses: (modelId: number) => number | null;
  
  /**
   * Check if a model is usable (has remaining uses)
   */
  isModelUsableById: (modelId: number) => boolean;
  
  /**
   * Initialize usage map from model catalog items
   */
  initializeUsageMap: (items: Array<{ id?: number; remainingUses?: number | null; isOwned?: boolean }>) => void;
  
  /**
   * Batch update usage counts
   */
  batchUpdateUsage: (updates: Array<{ modelId: number; remainingUses: number | null }>) => void;
};

/**
 * Hook for managing model usage counts
 */
export function useModelUsage(): UseModelUsageReturn {
  const [modelUsageMap, setModelUsageMap] = useState<ModelUsageMap>({});

  /**
   * Update usage count for a specific model
   */
  const updateModelUsage = useCallback((modelId: number, newCount: number | null) => {
    setModelUsageMap((prev) => ({
      ...prev,
      [modelId]: newCount,
    }));
  }, []);

  /**
   * Get remaining uses for a model
   */
  const getRemainingUses = useCallback(
    (modelId: number): number | null => {
      // If we don't have an explicit entry, treat as "no remaining uses" (0),
      // not "unlimited". Unlimited must be explicitly provided as null.
      if (Object.prototype.hasOwnProperty.call(modelUsageMap, modelId)) {
        return modelUsageMap[modelId] ?? null;
      }
      return 0;
    },
    [modelUsageMap]
  );

  /**
   * Check if a model is usable
   */
  const isModelUsableById = useCallback(
    (modelId: number): boolean => {
      const remainingUses = getRemainingUses(modelId);
      return isModelUsable(remainingUses);
    },
    [getRemainingUses]
  );

  /**
   * Initialize usage map from model catalog items
   */
  const initializeUsageMap = useCallback(
    (items: Array<{ id?: number; remainingUses?: number | null; isOwned?: boolean }>) => {
      setModelUsageMap((prev) => {
        let changed = false;
        const next: ModelUsageMap = { ...prev };
        for (const item of items) {
          if (typeof item.id !== "number") continue;
          // Only track usage for owned models (remainingUses is meaningful only then).
          if (item.isOwned !== true) continue;
          const value = item.remainingUses ?? null;
          if (next[item.id] !== value) {
            next[item.id] = value;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    []
  );

  /**
   * Batch update usage counts
   */
  const batchUpdateUsage = useCallback(
    (updates: Array<{ modelId: number; remainingUses: number | null }>) => {
      setModelUsageMap((prev) => {
        const next = { ...prev };
        for (const update of updates) {
          next[update.modelId] = update.remainingUses;
        }
        return next;
      });
    },
    []
  );

  return useMemo(
    () => ({
      modelUsageMap,
      updateModelUsage,
      getRemainingUses,
      isModelUsableById,
      initializeUsageMap,
      batchUpdateUsage,
    }),
    [modelUsageMap, updateModelUsage, getRemainingUses, isModelUsableById, initializeUsageMap, batchUpdateUsage]
  );
}
