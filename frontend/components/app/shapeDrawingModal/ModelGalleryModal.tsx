import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AppBottomSheetModal from "../AppBottomSheetModal";
import Ionicons from "react-native-vector-icons/Ionicons";
import { type ModelCatalogFlatItem, resolveModelStaticImageUri } from "@/src/maps/models/modelCatalog";
import { UsageBadge } from "./UsageBadge";
import { isModelUsable } from "@/src/services/modelUsageService";
import { isFreeRole } from "@/src/maps/models/modelAvailability";
import { PurchaseModelModal } from "./PurchaseModelModal";

type ModelGalleryModalProps = {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  modelCatalogFlat: ModelCatalogFlatItem[];
  isModelCatalogLoading: boolean;
  onSelectModel: (m: ModelCatalogFlatItem) => void | Promise<void>;
  formatModelDisplayName: (modelId: string) => string;
  getRemainingUses?: (modelId: number) => number | null;
  onPurchaseSuccess?: () => void;
};

/** Galeri içeriği (tab veya modal içinde kullanılır). onSelectModel çağrılır; kapatma parent’a bırakılır. */
export type ModelGalleryContentProps = {
  insetsBottom: number;
  modelCatalogFlat: ModelCatalogFlatItem[];
  isModelCatalogLoading: boolean;
  onSelectModel: (m: ModelCatalogFlatItem) => void | Promise<void>;
  formatModelDisplayName: (modelId: string) => string;
  getRemainingUses?: (modelId: number) => number | null;
  onPurchaseSuccess?: () => void;
};

const categoryLabels: Record<string, { icon: string; label: string }> = {
  house: { icon: "🏠", label: "Ev Modelleri" },
  car: { icon: "🚗", label: "Araç Modelleri" },
  tree: { icon: "🌳", label: "Ağaç Modelleri" },
  grass: { icon: "🌿", label: "Çim Modelleri" },
};

export const ModelGalleryContent: React.FC<ModelGalleryContentProps> = ({
  insetsBottom,
  modelCatalogFlat,
  isModelCatalogLoading,
  onSelectModel,
  formatModelDisplayName,
  getRemainingUses,
  onPurchaseSuccess,
}) => {
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [selectedModelForPurchase, setSelectedModelForPurchase] = useState<ModelCatalogFlatItem | null>(null);

  const modelsByCategory = useMemo(() => {
    const grouped: Record<string, ModelCatalogFlatItem[]> = {};
    modelCatalogFlat.forEach((model) => {
      if (!grouped[model.groupId]) {
        grouped[model.groupId] = [];
      }
      grouped[model.groupId].push(model);
    });
    return grouped;
  }, [modelCatalogFlat]);

  const handleModelPress = async (model: ModelCatalogFlatItem) => {
    if (!model.isAvailable) {
      if (model.id && model.tepeCredits) {
        setSelectedModelForPurchase(model);
        setPurchaseModalVisible(true);
      }
      return;
    }

    const rawRemainingUses = model.id !== undefined && getRemainingUses
      ? getRemainingUses(model.id)
      : model.remainingUses ?? null;
    const isFree = isFreeRole(model.role);
    const remainingUses = isFree ? null : rawRemainingUses;
    const isUsable = isModelUsable(remainingUses);

    if (!isUsable) return;

    try {
      await onSelectModel(model);
    } catch (error) {
      console.error("[ModelGalleryContent] Model selection error:", error);
    }
  };

  const handlePurchaseSuccess = () => {
    setPurchaseModalVisible(false);
    setSelectedModelForPurchase(null);
    onPurchaseSuccess?.();
  };

  const handlePurchaseClose = () => {
    setPurchaseModalVisible(false);
    setSelectedModelForPurchase(null);
  };

  return (
    <>
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insetsBottom, 0) + 24, flexGrow: 1 }]}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        {isModelCatalogLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Modeller yükleniyor...</Text>
          </View>
        ) : Object.keys(modelsByCategory).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color="#64748b" />
            <Text style={styles.emptyText}>Model bulunamadı</Text>
          </View>
        ) : (
          Object.entries(modelsByCategory).map(([categoryId, models]) => {
            const categoryInfo = categoryLabels[categoryId] || { icon: "📦", label: categoryId };
            return (
              <View key={categoryId} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>
                    {categoryInfo.icon} {categoryInfo.label}
                  </Text>
                  <View style={styles.categoryCount}>
                    <Text style={styles.categoryCountText}>{models.length} model</Text>
                  </View>
                </View>
                <View style={styles.modelsGrid}>
                  {models.map((model) => {
                    const rawRemainingUses = model.id !== undefined && getRemainingUses
                      ? getRemainingUses(model.id)
                      : model.remainingUses ?? null;
                    const isFree = isFreeRole(model.role);
                    const remainingUses = isFree ? null : rawRemainingUses;
                    const isUsable = isModelUsable(remainingUses);
                    const label = (model.name && model.name.trim()) ? model.name : formatModelDisplayName(model.filename);
                    const imgUri = resolveModelStaticImageUri(model.thumbnailPath || model.picturePath);

                    return (
                      <TouchableOpacity
                        key={`${model.groupId}-${model.modelId}`}
                        style={[
                          styles.modelCard,
                          !model.isAvailable && styles.modelCardLocked,
                          model.isAvailable && styles.modelCardAvailable,
                          model.isOwned && styles.modelCardOwned,
                        ]}
                        onPress={() => handleModelPress(model)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.modelCardImageContainer}>
                          {imgUri ? (
                            <Image source={{ uri: imgUri }} style={styles.modelCardImage} resizeMode="cover" />
                          ) : (
                            <View style={styles.modelCardPlaceholder}>
                              <Ionicons name="cube-outline" size={32} color="#64748b" />
                            </View>
                          )}
                          {!model.isAvailable ? (
                            <View style={styles.lockOverlay}>
                              <Ionicons name="lock-closed" size={20} color="#fff" />
                            </View>
                          ) : (
                            <View style={styles.availableIndicator}>
                              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                            </View>
                          )}
                          {model.isOwned && (
                            <View style={styles.ownedBadge}>
                              <Ionicons name="checkmark" size={12} color="#fff" />
                              <Text style={styles.ownedBadgeText}>Sahip</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.modelCardInfo}>
                          <Text style={styles.modelCardName} numberOfLines={2}>
                            {label}
                          </Text>
                          <View style={styles.modelCardFooter}>
                            {(isFree || (model.isOwned === true && model.id != null)) && (remainingUses === null || typeof remainingUses === "number") && (
                              <UsageBadge
                                remainingUses={remainingUses}
                                size="small"
                                labelOverride={isFree ? "FREE" : undefined}
                              />
                            )}
                            {!model.isAvailable && model.tepeCredits && (
                              <Text style={styles.creditsText}>{model.tepeCredits} Kredi</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </BottomSheetScrollView>

      {selectedModelForPurchase && selectedModelForPurchase.id && selectedModelForPurchase.tepeCredits && (
        <PurchaseModelModal
          visible={purchaseModalVisible}
          onClose={handlePurchaseClose}
          modelId={selectedModelForPurchase.id}
          modelName={(selectedModelForPurchase.name && selectedModelForPurchase.name.trim()) ? selectedModelForPurchase.name : formatModelDisplayName(selectedModelForPurchase.filename)}
          modelCategory={selectedModelForPurchase.groupId}
          credits={selectedModelForPurchase.tepeCredits}
          onPurchaseSuccess={handlePurchaseSuccess}
        />
      )}
    </>
  );
};

export const ModelGalleryModal: React.FC<ModelGalleryModalProps> = ({
  visible,
  onClose,
  insetsBottom,
  modelCatalogFlat,
  isModelCatalogLoading,
  onSelectModel,
  formatModelDisplayName,
  getRemainingUses,
  onPurchaseSuccess,
}) => {
  const handleSelectAndClose = async (m: ModelCatalogFlatItem) => {
    try {
      await onSelectModel(m);
      onClose();
    } catch (error) {
      console.error("[ModelGalleryModal] Model selection error:", error);
    }
  };

  return (
    <>
      <AppBottomSheetModal
        visible={visible}
        onClose={onClose}
        snapPoints={["90%", "95%"]}
        initialIndex={0}
        backdropPressBehavior="close"
        backgroundStyle={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>3D Model Galerisi</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          <ModelGalleryContent
            insetsBottom={insetsBottom}
            modelCatalogFlat={modelCatalogFlat}
            isModelCatalogLoading={isModelCatalogLoading}
            onSelectModel={handleSelectAndClose}
            formatModelDisplayName={formatModelDisplayName}
            getRemainingUses={getRemainingUses}
            onPurchaseSuccess={onPurchaseSuccess}
          />
        </View>
      </AppBottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    backgroundColor: "#3b82f6",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#94a3b8",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  categorySection: {
    marginBottom: 32,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#334155",
    borderRadius: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  categoryCount: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  modelsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  modelCard: {
    width: "48%",
    backgroundColor: "#334155",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#475569",
  },
  modelCardLocked: {
    opacity: 0.7,
    borderColor: "#475569",
  },
  modelCardAvailable: {
    borderColor: "#10b981",
    backgroundColor: "#1e3a2e",
  },
  modelCardOwned: {
    borderColor: "#10b981",
  },
  modelCardImageContainer: {
    position: "relative",
    width: "100%",
    height: 140,
    backgroundColor: "#1e293b",
  },
  modelCardImage: {
    width: "100%",
    height: "100%",
  },
  modelCardPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  lockOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 20,
    padding: 6,
  },
  availableIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(16, 185, 129, 0.9)",
    borderRadius: 20,
    padding: 6,
  },
  ownedBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10b981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ownedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },
  modelCardInfo: {
    padding: 10,
    gap: 8,
  },
  modelCardName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e2e8f0",
    minHeight: 32,
  },
  modelCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  creditsText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#f59e0b",
  },
});
