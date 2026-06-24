import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { ShapeType } from "@/src/maps/drawing/types";
import type { ModelCatalogFlatItem } from "@/src/maps/models/modelCatalog";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { styles } from "./styles";
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
  onSelectModel: (m: ModelCatalogFlatItem) => void | Promise<void>;
  onClearModels: () => void;
  formatModelDisplayName: (modelId: string) => string;
  getRemainingUses?: (modelId: number) => number | null;
  onModelCatalogRefresh?: () => void;
  onRequestPurchase?: (m: ModelCatalogFlatItem) => void;
};

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
  onSelectModel,
  onClearModels,
  formatModelDisplayName,
  getRemainingUses,
  onModelCatalogRefresh,
  onRequestPurchase,
}) => {
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Galeri</Text>
            <TouchableOpacity onPress={onCloseModels} accessibilityLabel="Kapat">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          <ModelGalleryContent
            insetsBottom={insetsBottom}
            modelCatalogFlat={modelCatalogFlat}
            isModelCatalogLoading={isModelCatalogLoading}
            onSelectModel={onSelectModel}
            formatModelDisplayName={formatModelDisplayName}
            getRemainingUses={getRemainingUses}
            onPurchaseSuccess={() => onModelCatalogRefresh?.()}
            onRequestPurchase={onRequestPurchase}
            onCloseGallery={onCloseModels}
          />

          <TouchableOpacity
            style={[
              styles.dropdownMenuItem,
              {
                marginHorizontal: 10,
                marginBottom: 8,
                borderTopWidth: 1,
                borderTopColor: "#334155",
              },
            ]}
            onPress={onClearModels}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={styles.dropdownMenuItemText}>Modelleri Temizle</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheetModal>
    </>
  );
};
