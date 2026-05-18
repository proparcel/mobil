import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View, Image, StyleSheet } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { ShapeType } from "@/src/maps/drawing/types";
import type { ModelCatalogFlatItem } from "@/src/maps/models/modelCatalog";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { styles } from "./styles";
import { UsageBadge } from "./UsageBadge";
import { fetchOwnedModels, isModelUsable } from "@/src/services/modelUsageService";
import type { OwnedModel } from "@/src/types/models";
import { API_URL } from "../../../config/api";
import { isFreeRole } from "@/src/maps/models/modelAvailability";
import { ModelGalleryContent } from "./ModelGalleryModal";

type MeasurementMode = "distance" | "area" | null;

type Props = {
  insetsBottom: number;

  /** Tek araç çubuğu menüsü: Harita araçları / Nesne / Bina / Resim */
  mainActionMenuOpen: boolean;
  onCloseMainActionMenu: () => void;
  onMainMenuSelectMapTools: () => void;
  onMainMenuSelectModels: () => void;
  /** Bina oluştur bottom sheet */
  onMainMenuSelectBinaOlustur: () => void;
  onMainMenuSelectResim: () => void;

  mapToolsOpen: boolean;
  onCloseMapTools: () => void;
  modelsOpen: boolean;
  onCloseModels: () => void;

  cameraMenuOpen: boolean;
  onCloseCameraMenu: () => void;
  onSelectResimCek: () => void;
  onSelectResimler: () => void;

  shapeDrawingMode: ShapeType | null;
  measurementMode: MeasurementMode;

  onSelectShape: (next: ShapeType | null) => void;
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
};

const SHAPE_OPTIONS: Array<{ type: ShapeType; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> =
  [
    { type: "rectangle", label: "Kare", icon: "square-outline" },
    { type: "triangle", label: "Üçgen", icon: "triangle-outline" },
    { type: "circle", label: "Yuvarlak", icon: "ellipse-outline" },
    { type: "ellipse", label: "Elips", icon: "ellipse" },
    { type: "polygon", label: "Çokgen", icon: "git-merge-outline" },
    { type: "line", label: "Çizgi", icon: "remove-outline" },
    { type: "pen", label: "Kalem", icon: "brush-outline" },
    { type: "freehand", label: "Serbest", icon: "create-outline" },
    { type: "arrow", label: "Ok", icon: "arrow-forward-outline" },
    { type: "marker", label: "Nokta", icon: "location-outline" },
    { type: "textbox", label: "Metin", icon: "text-outline" },
  ];

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
      contentContainerStyle={[modelSheetStyles.ownedScrollContent, { paddingBottom: Math.max(insetsBottom, 0) + 24, flexGrow: 1 }]}
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
  mainActionMenuOpen,
  onCloseMainActionMenu,
  onMainMenuSelectMapTools,
  onMainMenuSelectModels,
  onMainMenuSelectBinaOlustur,
  onMainMenuSelectResim,
  mapToolsOpen,
  onCloseMapTools,
  modelsOpen,
  onCloseModels,
  cameraMenuOpen,
  onCloseCameraMenu,
  onSelectResimCek,
  onSelectResimler,
  shapeDrawingMode,
  measurementMode,
  onSelectShape,
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
}) => {
  const [modelTab, setModelTab] = useState<"modeller" | "benim" | "galeri">("modeller");
  const [drawGroupOpen, setDrawGroupOpen] = useState(true);
  const [measureGroupOpen, setMeasureGroupOpen] = useState(true);
  const [textGroupOpen, setTextGroupOpen] = useState(true);

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
      {/* Araç çubuğu: Şekil | Nesne | Bina | Ölçüm | Resim */}
      <AppBottomSheetModal
        visible={mainActionMenuOpen}
        onClose={onCloseMainActionMenu}
        snapPoints={["50%"]}
        initialIndex={0}
        backdropPressBehavior="close"
        backgroundStyle={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
      >
        <View style={{ flex: 1, paddingBottom: insetsBottom }}>
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>İşlemler</Text>
            <TouchableOpacity onPress={onCloseMainActionMenu} accessibilityLabel="Kapat">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 12, gap: 8 }}>
            <TouchableOpacity style={[styles.dropdownMenuItem]} onPress={onMainMenuSelectMapTools}>
              <Ionicons name="construct-outline" size={18} color="#3b82f6" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.dropdownMenuItemText, { color: "#fff" }]}>Harita araçları</Text>
                <Text style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>Çizim, ölçüm, metin</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownMenuItem]}
              onPress={onMainMenuSelectModels}
            >
              <Ionicons name="cube-outline" size={18} color="#3b82f6" />
              <Text style={[styles.dropdownMenuItemText, { color: "#fff" }]}>Nesne Ekle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownMenuItem]}
              onPress={onMainMenuSelectBinaOlustur}
              accessibilityLabel="Bina Oluştur"
            >
              <Ionicons name="business-outline" size={18} color="#3b82f6" />
              <Text style={[styles.dropdownMenuItemText, { color: "#fff" }]}>Bina Oluştur</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownMenuItem]}
              onPress={onMainMenuSelectResim}
            >
              <Ionicons name="image-outline" size={18} color="#3b82f6" />
              <Text style={[styles.dropdownMenuItemText, { color: "#fff" }]}>Resim Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppBottomSheetModal>

      {/* Kamera Menüsü (Resim Çek | Resimler) */}
      <AppBottomSheetModal
        visible={cameraMenuOpen}
        onClose={onCloseCameraMenu}
        snapPoints={["70%"]}
        initialIndex={0}
        backdropPressBehavior="close"
        backgroundStyle={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
      >
        <View style={{ flex: 1, paddingBottom: insetsBottom }}>
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Resim</Text>
            <TouchableOpacity onPress={onCloseCameraMenu} accessibilityLabel="Kapat">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 12, gap: 8 }}>
            <TouchableOpacity
              style={[styles.dropdownMenuItem]}
              onPress={() => {
                onSelectResimCek();
                onCloseCameraMenu();
              }}
            >
              <Ionicons name="camera" size={18} color="#3b82f6" />
              <Text style={[styles.dropdownMenuItemText, { color: "#fff" }]}>Resim Çek</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownMenuItem]}
              onPress={() => {
                onSelectResimler();
                onCloseCameraMenu();
              }}
            >
              <Ionicons name="images" size={18} color="#3b82f6" />
              <Text style={[styles.dropdownMenuItemText, { color: "#fff" }]}>Resimler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppBottomSheetModal>

      {/* Harita araçları — çizim / metin / ölçüm grupları (web index Araçlar) */}
      <AppBottomSheetModal
        visible={mapToolsOpen}
        onClose={onCloseMapTools}
        snapPoints={["75%", "92%"]}
        initialIndex={0}
        backdropPressBehavior="close"
        backgroundStyle={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
      >
        <View style={{ flex: 1, paddingBottom: insetsBottom }}>
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Harita araçları</Text>
            <TouchableOpacity onPress={onCloseMapTools} accessibilityLabel="Kapat">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          <BottomSheetScrollView
            style={{ flex: 1, paddingHorizontal: 10 }}
            contentContainerStyle={{ paddingBottom: Math.max(insetsBottom, 0) + 24 }}
          >
            <TouchableOpacity
              style={[styles.dropdownMenuItem, { backgroundColor: "rgba(51,65,85,0.5)" }]}
              onPress={() => setDrawGroupOpen((v) => !v)}
            >
              <Ionicons name="pencil-outline" size={18} color="#94a3b8" />
              <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>Çizim araçları</Text>
              <Ionicons name={drawGroupOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
            {drawGroupOpen &&
              SHAPE_OPTIONS.filter((o) => o.type !== "textbox").map((opt) => {
                const active = shapeDrawingMode === opt.type;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    style={[styles.dropdownMenuItem, active && styles.dropdownMenuItemActive]}
                    onPress={() => {
                      onSelectShape(active ? null : opt.type);
                      onCloseMapTools();
                    }}
                  >
                    <Ionicons name={opt.icon} size={16} color={active ? "#3b82f6" : "#94a3b8"} />
                    <Text style={[styles.dropdownMenuItemText, active && styles.dropdownMenuItemTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            {drawGroupOpen && onClearAllShapes ? (
              <TouchableOpacity
                style={[styles.dropdownMenuItem, { borderTopWidth: 1, borderTopColor: "#334155", marginTop: 4 }]}
                onPress={() => {
                  Alert.alert("Şekilleri temizle", "Tüm çizim şekillerini kaldırmak istiyor musunuz?", [
                    { text: "İptal", style: "cancel" },
                    { text: "Temizle", style: "destructive", onPress: () => onClearAllShapes() },
                  ]);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={styles.dropdownMenuItemText}>Şekilleri temizle</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.dropdownMenuItem, { marginTop: 12, backgroundColor: "rgba(51,65,85,0.5)" }]}
              onPress={() => setTextGroupOpen((v) => !v)}
            >
              <Ionicons name="text-outline" size={18} color="#94a3b8" />
              <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>Metin</Text>
              <Ionicons name={textGroupOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
            {textGroupOpen ? (
              <TouchableOpacity
                style={[styles.dropdownMenuItem, shapeDrawingMode === "textbox" && styles.dropdownMenuItemActive]}
                onPress={() => {
                  const active = shapeDrawingMode === "textbox";
                  onSelectShape(active ? null : "textbox");
                  onCloseMapTools();
                }}
              >
                <Ionicons name="chatbox-outline" size={16} color={shapeDrawingMode === "textbox" ? "#3b82f6" : "#94a3b8"} />
                <Text
                  style={[styles.dropdownMenuItemText, shapeDrawingMode === "textbox" && styles.dropdownMenuItemTextActive]}
                >
                  Metin kutusu ekle
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.dropdownMenuItem, { marginTop: 12, backgroundColor: "rgba(51,65,85,0.5)" }]}
              onPress={() => setMeasureGroupOpen((v) => !v)}
            >
              <Ionicons name="analytics-outline" size={18} color="#94a3b8" />
              <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>Ölçüm araçları</Text>
              <Ionicons name={measureGroupOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
            {measureGroupOpen ? (
              <>
                <TouchableOpacity
                  style={[styles.dropdownMenuItem, hasSingleParcelSelected && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    if (!hasSingleParcelSelected) {
                      Alert.alert("Uyarı", "Parsel seçiniz.");
                      return;
                    }
                    onHisseliParsellereBolPress();
                  }}
                >
                  <Ionicons name="git-branch-outline" size={16} color={hasSingleParcelSelected ? "#3b82f6" : "#94a3b8"} />
                  <Text style={[styles.dropdownMenuItemText, hasSingleParcelSelected && styles.dropdownMenuItemTextActive]}>
                    Hisseli Parsellere Böl
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdownMenuItem, measurementMode === "distance" && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    onSelectMeasurement(measurementMode === "distance" ? null : "distance");
                    onCloseMapTools();
                  }}
                >
                  <Ionicons name="resize" size={16} color={measurementMode === "distance" ? "#3b82f6" : "#94a3b8"} />
                  <Text style={[styles.dropdownMenuItemText, measurementMode === "distance" && styles.dropdownMenuItemTextActive]}>
                    Mesafe ölçümü
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdownMenuItem, measurementMode === "area" && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    onSelectMeasurement(measurementMode === "area" ? null : "area");
                    onCloseMapTools();
                  }}
                >
                  <Ionicons name="square-outline" size={16} color={measurementMode === "area" ? "#3b82f6" : "#94a3b8"} />
                  <Text style={[styles.dropdownMenuItemText, measurementMode === "area" && styles.dropdownMenuItemTextActive]}>
                    Alan ölçümü
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dropdownMenuItem} onPress={onEdgeMeasures}>
                  <MaterialCommunityIcons name="vector-square" size={16} color="#94a3b8" />
                  <Text style={styles.dropdownMenuItemText}>Kenar mesafeleri</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownMenuItem}
                  onPress={() => {
                    onClearMeasurements();
                    onCloseMapTools();
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={styles.dropdownMenuItemText}>Ölçümleri temizle</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </BottomSheetScrollView>
        </View>
      </AppBottomSheetModal>

      {/* Models */}
      <AppBottomSheetModal
        visible={modelsOpen}
        onClose={onCloseModels}
        snapPoints={["70%", "90%"]}
        initialIndex={0}
        backdropPressBehavior="close"
        backgroundStyle={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
      >
        <View style={{ flex: 1, paddingBottom: insetsBottom }}>
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
              contentContainerStyle={{ paddingBottom: Math.max(insetsBottom, 0) + 24, flexGrow: 1 }}
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
                    const isDisabled = !isUsable;
                    // isAvailable artık tek yerden (modelCatalog) hesaplanır.
                    const isAvailable = m.isAvailable;
                    return (
                      <TouchableOpacity
                        key={`${m.groupId}-${m.modelId}`}
                        style={[
                          styles.dropdownMenuItem,
                          isActive && styles.dropdownMenuItemActive,
                          isDisabled && styles.modelItemDisabled,
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
                            opacity: isDisabled ? 0.5 : 1,
                          }}
                          onPress={async () => {
                            if (isDisabled) return;
                            try {
                              await onSelectModel(m);
                            } catch (error) {
                              console.error("[ShapeDrawingDropdownSheets] Model seçilirken hata:", error);
                            }
                          }}
                          disabled={isDisabled}
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
                              isDisabled && styles.dropdownMenuItemTextDisabled,
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
                            <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
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
            />
          )}
        </View>
      </AppBottomSheetModal>

    </>
  );
};

