/**
 * OwnedModelsSection Component
 * 
 * Displays owned models in a card layout with usage counts.
 * Filters out models with 0 usage.
 */

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { fetchOwnedModels, isModelUsable } from "@/src/services/modelUsageService";
import { UsageBadge } from "./UsageBadge";
import type { OwnedModel } from "@/src/types/models";
import { formatModelDisplayName } from "@/src/maps/models/modelCatalog";

type OwnedModelsSectionProps = {
  visible: boolean;
  onSelectModel?: (model: OwnedModel) => void;
  getRemainingUses?: (modelId: number) => number | null;
  onUsageUpdated?: (modelId: number, newCount: number | null) => void;
  onDeleteOwnedModel?: (model: OwnedModel) => void;
};

export const OwnedModelsSection: React.FC<OwnedModelsSectionProps> = ({
  visible,
  onSelectModel,
  getRemainingUses,
  onUsageUpdated,
  onDeleteOwnedModel,
}) => {
  const [ownedModels, setOwnedModels] = useState<OwnedModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch owned models when section becomes visible
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const models = await fetchOwnedModels();
        if (cancelled) return;

        // Filter out models with 0 usage (unless they have unlimited)
        const filteredModels = models.filter((model) => {
          const remainingUses = getRemainingUses
            ? getRemainingUses(model.model_id)
            : model.usegCount ?? null;
          return isModelUsable(remainingUses);
        });

        setOwnedModels(filteredModels);
      } catch (err: any) {
        if (cancelled) return;
        
        // Handle network errors gracefully - don't show error for network issues
        // as this is a "nice to have" feature
        const errorMessage = String(err?.message || err || "");
        const isNetworkError = 
          errorMessage.includes("Network request failed") ||
          errorMessage.includes("Failed to fetch") ||
          errorMessage.includes("bağlanılamadı") ||
          errorMessage.includes("zaman aşımı");
        
        if (isNetworkError) {
          // Silently fail for network errors - don't show error to user
          // This is a non-critical feature
          console.warn("[OwnedModelsSection] Network error (silently ignored):", errorMessage);
          setOwnedModels([]);
          setError(null); // Don't show error for network issues
        } else {
          // Show error for other issues (auth, server errors, etc.)
          setError(errorMessage || "Satın alınan modeller alınamadı");
          setOwnedModels([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, getRemainingUses]);

  // Update models when usage is updated externally
  useEffect(() => {
    if (!onUsageUpdated) return;

    // Re-filter models when usage updates
    setOwnedModels((prev) => {
      return prev.filter((model) => {
        const remainingUses = getRemainingUses
          ? getRemainingUses(model.model_id)
          : model.usegCount ?? null;
        return isModelUsable(remainingUses);
      });
    });
  }, [getRemainingUses, onUsageUpdated]);

  if (!visible) return null;

  // Don't render if there's no data and no error (network issues are silently ignored)
  if (!isLoading && !error && ownedModels.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Satın Alınan Modellerim</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.loadingText}>Modeller yükleniyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : ownedModels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={32} color="#64748b" />
          <Text style={styles.emptyText}>Kullanılabilir model bulunmuyor</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {ownedModels.map((model) => {
            const remainingUses = getRemainingUses
              ? getRemainingUses(model.model_id)
              : model.usegCount ?? null;
            const displayName = formatModelDisplayName(model.file);

            return (
              <TouchableOpacity
                key={model.model_id}
                style={styles.modelCard}
                onPress={() => onSelectModel?.(model)}
                onLongPress={() => onDeleteOwnedModel?.(model)}
                activeOpacity={0.7}
              >
                {/* Model Thumbnail */}
                {model.thumbnail_path || model.picture_path ? (
                  <Image
                    source={{
                      uri: model.thumbnail_path || model.picture_path || "",
                    }}
                    style={styles.modelImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.modelImagePlaceholder}>
                    <Ionicons name="cube-outline" size={32} color="#64748b" />
                  </View>
                )}

                {/* Model Info */}
                <View style={styles.modelInfo}>
                  <Text style={styles.modelName} numberOfLines={2}>
                    {model.model_name || displayName}
                  </Text>
                  <View style={styles.badgeContainer}>
                    <UsageBadge remainingUses={remainingUses} size="small" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingVertical: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  modelCard: {
    width: 120,
    backgroundColor: "#334155",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#475569",
  },
  modelImage: {
    width: "100%",
    height: 80,
    backgroundColor: "#1e293b",
  },
  modelImagePlaceholder: {
    width: "100%",
    height: 80,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  modelInfo: {
    padding: 8,
    gap: 6,
  },
  modelName: {
    fontSize: 11,
    fontWeight: "500",
    color: "#e2e8f0",
    minHeight: 28,
  },
  badgeContainer: {
    alignItems: "flex-start",
  },
});
