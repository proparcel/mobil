import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View, Image, StyleSheet } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { ShapeType } from "@/src/maps/drawing/types";
import type { ModelCatalogFlatItem } from "@/src/maps/models/modelCatalog";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { sheetEditorScrollBottomPadding } from "@/src/utils/sheetSafeArea";
import { styles } from "./styles";
import { UsageBadge } from "./UsageBadge";
import { fetchOwnedModels, isModelUsable } from "@/src/services/modelUsageService";
import type { OwnedModel } from "@/src/types/models";
import { API_URL } from "../../../config/api";
import { isFreeRole } from "@/src/maps/models/modelAvailability";
import { ModelGalleryContent } from "./ModelGalleryModal";
import type { MapPinVariant } from "@/src/maps/drawing/mapPinStyles";
import type { MapArrowVariant } from "@/src/maps/drawing/mapArrowStyles";
import { MapToolsSheet } from "../mapTools/MapToolsSheet";
import type { MeasurementMode } from "@/src/utils/measurementManager";

type Props = {
  insetsBottom: number;

  mapToolsOpen: boolean;
  onCloseMapTools: () => void;
  modelsOpen: boolean;
  onCloseModels: () => void;

  shapeDrawingMode: ShapeType | null;
  measurementMode: MeasurementMode;

  onSelectShape: (next: ShapeType | null) => void;
  drawPinVariant?: MapPinVariant;
  onSelectPinVariant?: (variant: MapPinVariant) => void;
  drawArrowVariant?: MapArrowVariant;
  onSelectArrowVariant?: (variant: MapArrowVariant) => void;
  onSelectMeasurement: (next: MeasurementMode) => void;
  onClearMeasurements: () => void;
  /** Parsel hariç çizimleri temizle (web «Tümünü Temizle» benzeri, yalnız şekiller) */
  onClearAllShapes?: () => void;
  onEdgeMeasures?: () => void;

  hasSingleParcelSelected: boolean;
  onHisseliParsellereBolPress: () => void;

  // Models
  isModelCatalogLoading: boolean;
  modelCatalogFlat: ModelCatalogFlatItem[];
  modelCatalogError: string | null;
  placingModelId: string | null;
  onSelectModel: (m: ModelCatalogFlatItem) => void | Promise<void>;
  onClearModels: () => void;
  formatModelDisplayName: (modelId: string) => string;
  getRemainingUses?: (modelId: number) => number | null;
  onSelectOwnedModel?: (m: OwnedModel) => void;
  onDeleteOwnedModel?: (m: OwnedModel) => void;
  onModelCatalogRefresh?: () => void;
  onRequestPurchase?: (m: ModelCatalogFlatItem) => void;
};

const modelSheetStyles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: -1,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94a3b8",
  },
  tabTextActive: {
    color: "#3b82f6",
  },
  ownedGrid: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 24,
  },
  ownedScrollContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 4,
    paddingBottom: 24,
  },
  ownedCard: {
    flex: 1,
    minWidth: 150,
    maxWidth: "48%",
    backgroundColor: "#334155",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#475569",
  },
  ownedCardImage: {
    width: "100%",
    height: 96,
    backgroundColor: "#1e293b",
  },
  ownedCardPlaceholder: {
    width: "100%",
    height: 96,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  ownedCardInfo: {
    padding: 8,
    gap: 6,
  },
  ownedCardName: {
    fontSize: 11,
    fontWeight: "500",
    color: "#e2e8f0",
    minHeight: 28,
  },
});

type BenimModellerimTabProps = {
  insetsBottom: number;
  getRemainingUses?: (modelId: number) => number | null;
  formatModelDisplayName: (id: string) => string;
  onSelectOwnedModel?: (m: OwnedModel) => void;
  onDeleteOwnedModel?: (m: OwnedModel) => void;
};

function BenimModellerimTab({
  insetsBottom,
  getRemainingUses,
  formatModelDisplayName,
  onSelectOwnedModel,
  onDeleteOwnedModel,
}: BenimModellerimTabProps) {
  const [owned, setOwned] = useState<OwnedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    console.log("[BenimModellerimTab] fetch başlatılıyor");
    (async () => {
      try {
        const list = await fetchOwnedModels();
        if (cancelled) return;
        console.log("[BenimModellerimTab] fetch bitti, owned sayısı:", list.length);
        setOwned(list);
      } catch (e: any) {
        if (cancelled) return;
        const msg = String(e?.message || e || "");
        console.warn("[BenimModellerimTab] fetch hata:", msg);
        const isNetwork =
          msg.includes("Network") || msg.includes("fetch") || msg.includes("bağlanılamadı") || msg.includes("zaman aşımı");
        if (isNetwork) {
          setOwned([]);
          setError(null);
        } else {
          setError(msg || "Satın alınan modeller alınamadı");
          setOwned([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = owned.filter((m) => {
    const u = getRemainingUses ? getRemainingUses(m.model_id) : m.usegCount ?? null;
    return isModelUsable(u);
  });

  if (!loading && owned.length > 0 && filtered.length === 0) {
    console.log("[BenimModellerimTab] owned var ama filtered boş (tüm usegCount 0?)");
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 }}>
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>Modeller yükleniyor...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40, paddingHorizontal: 16 }}>
        <Ionicons name="alert-circle" size={24} color="#ef4444" />
        <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 8, textAlign: "center" }}>{error}</Text>
      </View>
    );
  }
  if (filtered.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 }}>
        <Ionicons name="cube-outline" size={40} color="#64748b" />
        <Text style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>Kullanılabilir model bulunmuyor</Text>
      </View>
    );
  }

  return (
    <BottomSheetScrollView
      style={modelSheetStyles.ownedGrid}
      contentContainerStyle={[modelSheetStyles.ownedScrollContent, { paddingBottom: sheetEditorScrollBottomPadding(insetsBottom, 12), flexGrow: 1 }]}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
    >
      {filtered.map((m) => {
        const remainingUses = getRemainingUses ? getRemainingUses(m.model_id) : m.usegCount ?? null;
        const displayName = (m.model_name && m.model_name.trim()) ? m.model_name : formatModelDisplayName(m.file);
        const rawPath = m.thumbnail_path || m.picture_path || "";
        const base = API_URL.replace(/\/$/, "");
        const imgUri = rawPath && !rawPath.startsWith("http")
          ? rawPath.startsWith("/static/")
            ? `${base}${rawPath}`
            : `${base}/static/${rawPath.replace(/^\//, "")}`
          : rawPath;
        return (
          <TouchableOpacity
            key={m.model_id}
            style={modelSheetStyles.ownedCard}
            onPress={() => onSelectOwnedModel?.(m)}
            onLongPress={() => onDeleteOwnedModel?.(m)}
            activeOpacity={0.7}
          >
            {imgUri ? (
              <Image source={{ uri: imgUri }} style={modelSheetStyles.ownedCardImage} resizeMode="cover" />
            ) : (
              <View style={modelSheetStyles.ownedCardPlaceholder}>
                <Ionicons name="cube-outline" size={32} color="#64748b" />
              </View>
            )}
            <View style={modelSheetStyles.ownedCardInfo}>
              <Text style={modelSheetStyles.ownedCardName} numberOfLines={2}>
                {displayName}
              </Text>
              <UsageBadge remainingUses={remainingUses} size="small" />
            </View>
          </TouchableOpacity>
        );
      })}
    </BottomSheetScrollView>
  );
}

export const ShapeDrawingDropdownSheets: React.FC<Props> = ({
  insetsBottom,
  mapToolsOpen,
  onCloseMapTools,
  modelsOpen,
  onCloseModels,
  shapeDrawingMode,
  measurementMode,
  onSelectShape,
  drawPinVariant,
  onSelectPinVariant,
  drawArrowVariant,
  onSelectArrowVariant,
  onSelectMeasurement,
  onClearMeasurements,
  onClearAllShapes,
  onEdgeMeasures,
  hasSingleParcelSelected,
  onHisseliParsellereBolPress,
  isModelCatalogLoading,
  modelCatalogFlat,
  modelCatalogError,
  placingModelId,
  onSelectModel,
  onClearModels,
  formatModelDisplayName,
  getRemainingUses,
  onSelectOwnedModel,
  onDeleteOwnedModel,
  onModelCatalogRefresh,
  onRequestPurchase,
}) => {
  const [modelTab, setModelTab] = useState<"modeller" | "benim" | "galeri">("modeller");

  const openPurchase = (m: ModelCatalogFlatItem) => {
    if (m.id == null || isFreeRole(m.role)) return;
    onRequestPurchase?.(m);
  };

  useEffect(() => {
    if (modelCatalogFlat.length > 0) {
      const sample = modelCatalogFlat.slice(0, 5).map((m) => ({
        modelId: m.modelId,
        isAvailable: m.isAvailable,
        isOwned: m.isOwned,
        remainingUses: m.remainingUses,
      }));
      console.log("[ShapeDrawingDropdownSheets] Modeller list örnek (isAvailable/isOwned/remainingUses):", JSON.stringify(sample));
    }
  }, [modelCatalogFlat]);

  return (
    <>
      <MapToolsSheet
        visible={mapToolsOpen}
        onClose={onCloseMapTools}
        surface="editor"
        insetsBottom={insetsBottom}
        shapeDrawingMode={shapeDrawingMode}
        measurementMode={measurementMode}
        onSelectShape={onSelectShape}
        drawPinVariant={drawPinVariant}
        onSelectPinVariant={onSelectPinVariant}
        drawArrowVariant={drawArrowVariant}
        onSelectArrowVariant={onSelectArrowVariant}
        onSelectMeasurement={onSelectMeasurement}
        onClearShapes={onClearAllShapes}
        onClearMeasurements={onClearMeasurements}
        onHisseliParsellereBol={onHisseliParsellereBolPress}
        hasSingleParcelSelected={hasSingleParcelSelected}
        onEdgeMeasures={onEdgeMeasures}
      />

      {/* Models */}
      <AppBottomSheetModal
        visible={modelsOpen}
        onClose={onCloseModels}
        flushToScreenBottom
        snapPoints={["70%", "90%"]}
        initialIndex={0}
        backdropPressBehavior="close"
        backgroundStyle={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
      >
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#334155",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Modeller</Text>
            <TouchableOpacity onPress={onCloseModels} accessibilityLabel="Kapat">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Tab bar: Modeller | Benim Modellerim | Galeri */}
          <View style={modelSheetStyles.tabBar}>
            <TouchableOpacity
              style={[modelSheetStyles.tab, modelTab === "modeller" && modelSheetStyles.tabActive]}
              onPress={() => setModelTab("modeller")}
            >
              <Text style={[modelSheetStyles.tabText, modelTab === "modeller" && modelSheetStyles.tabTextActive]}>
                Modeller
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modelSheetStyles.tab, modelTab === "benim" && modelSheetStyles.tabActive]}
              onPress={() => setModelTab("benim")}
            >
              <Text style={[modelSheetStyles.tabText, modelTab === "benim" && modelSheetStyles.tabTextActive]}>
                Benim Modellerim
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modelSheetStyles.tab, modelTab === "galeri" && modelSheetStyles.tabActive]}
              onPress={() => setModelTab("galeri")}
            >
              <Text style={[modelSheetStyles.tabText, modelTab === "galeri" && modelSheetStyles.tabTextActive]}>
                Galeri
              </Text>
            </TouchableOpacity>
          </View>

          {modelTab === "modeller" ? (
            <BottomSheetScrollView
              style={{ flex: 1, paddingHorizontal: 10 }}
              contentContainerStyle={{ paddingBottom: sheetEditorScrollBottomPadding(insetsBottom, 12), flexGrow: 1 }}
              nestedScrollEnabled={true}
            >
              {isModelCatalogLoading ? (
                <View style={{ paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator size="small" color="#94a3b8" />
                  <Text style={{ color: "#64748b", fontSize: 12 }}>Modeller yükleniyor...</Text>
                </View>
              ) : modelCatalogFlat.length === 0 ? (
                <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Text style={{ color: "#64748b", fontSize: 12 }}>
                    {modelCatalogError
                      ? `Model listesi alınamadı: ${modelCatalogError}`
                      : "Model bulunamadı. Sunucuda `/static/models/{car,house,tree,grass}/` altında *.glb dosyaları olduğundan emin olun."}
                  </Text>
                </View>
              ) : (
                <>
                  {modelCatalogFlat.map((m) => {
                    const isActive = placingModelId === m.modelId;
                    const label = (m.name && m.name.trim()) ? m.name : formatModelDisplayName(m.filename);
                    const rawRemainingUses = m.id !== undefined && getRemainingUses
                      ? getRemainingUses(m.id)
                      : m.remainingUses ?? null;
                    const isFree = isFreeRole(m.role);
                    const remainingUses = isFree ? null : rawRemainingUses;
                    const isUsable = isModelUsable(remainingUses);
                    const isAvailable = m.isAvailable;
                    const isUsageBlocked = isAvailable && !isUsable;
                    return (
                      <TouchableOpacity
                        key={`${m.groupId}-${m.modelId}`}
                        style={[
                          styles.dropdownMenuItem,
                          isActive && styles.dropdownMenuItemActive,
                          isUsageBlocked && styles.modelItemDisabled,
                          { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
                        ]}
                        onLongPress={undefined}
                        activeOpacity={0.7}
                      >
                        <TouchableOpacity
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flex: 1,
                            opacity: !isAvailable || isUsageBlocked ? 0.65 : 1,
                          }}
                          onPress={async () => {
                            if (!isAvailable) {
                              if (m.id != null && !isFreeRole(m.role)) {
                                openPurchase(m);
                              } else {
                                Alert.alert(
                                  "Model Kilitli",
                                  `"${label}" şu an kullanılamıyor.`
                                );
                              }
                              return;
                            }
                            if (isUsageBlocked) return;
                            try {
                              await onSelectModel(m);
                            } catch (error) {
                              console.error("[ShapeDrawingDropdownSheets] Model seçilirken hata:", error);
                            }
                          }}
                          disabled={isUsageBlocked}
                        >
                          <Ionicons
                            name="cube-outline"
                            size={16}
                            color={isActive ? "#3b82f6" : "#94a3b8"}
                          />
                          <Text
                            style={[
                              styles.dropdownMenuItemText,
                              isActive && styles.dropdownMenuItemTextActive,
                              isUsageBlocked && styles.dropdownMenuItemTextDisabled,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          {(isFree || (m.isOwned === true && m.id != null)) && (remainingUses === null || typeof remainingUses === "number") && (
                            <UsageBadge
                              remainingUses={remainingUses}
                              size="small"
                              labelOverride={isFree ? "FREE" : undefined}
                            />
                          )}
                          {isAvailable ? (
                            <Ionicons name="lock-open-outline" size={16} color="#10b981" />
                          ) : (
                            <TouchableOpacity
                              onPress={() => openPurchase(m)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="lock-closed-outline" size={16} color="#f59e0b" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity style={styles.dropdownMenuItem} onPress={onClearModels}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    <Text style={styles.dropdownMenuItemText}>Modelleri Temizle</Text>
                  </TouchableOpacity>
                </>
              )}
            </BottomSheetScrollView>
          ) : modelTab === "benim" ? (
            <BenimModellerimTab
              insetsBottom={insetsBottom}
              getRemainingUses={getRemainingUses}
              formatModelDisplayName={formatModelDisplayName}
              onSelectOwnedModel={onSelectOwnedModel}
              onDeleteOwnedModel={onDeleteOwnedModel}
            />
          ) : (
            <ModelGalleryContent
              insetsBottom={insetsBottom}
              modelCatalogFlat={modelCatalogFlat}
              isModelCatalogLoading={isModelCatalogLoading}
              onSelectModel={async (m) => {
                try {
                  await onSelectModel(m);
                  onCloseModels();
                } catch (e) {
                  console.error("[ShapeDrawingDropdownSheets] Galeri model seçimi hata:", e);
                }
              }}
              formatModelDisplayName={formatModelDisplayName}
              getRemainingUses={getRemainingUses}
              onPurchaseSuccess={() => onModelCatalogRefresh?.()}
              onRequestPurchase={onRequestPurchase}
            />
          )}
        </View>
      </AppBottomSheetModal>

    </>
  );
};

