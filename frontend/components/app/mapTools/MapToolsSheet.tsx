import React, { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { MapPinVariant } from "@/src/maps/drawing/mapPinStyles";
import type { MapArrowVariant } from "@/src/maps/drawing/mapArrowStyles";
import type { MeasurementMode } from "@/src/utils/measurementManager";
import type { ShapeType } from "@/src/maps/drawing/types";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { MAP_TOOLS_SHEET_BACKGROUND } from "../../../src/constants/parcelPolygonDesign";
import { sheetEditorScrollBottomPadding, sheetScrollBottomPadding } from "../../../src/utils/sheetSafeArea";
import { styles } from "../shapeDrawingModal/styles";
import { MapDrawToolsSection } from "../shapeDrawingModal/MapDrawToolsSection";

export type MapToolsSurface = "home" | "editor";

type Props = {
  visible: boolean;
  onClose: () => void;
  surface: MapToolsSurface;
  insetsBottom: number;
  shapeDrawingMode: ShapeType | null;
  measurementMode: MeasurementMode;
  onSelectShape: (next: ShapeType | null) => void;
  onSelectMeasurement: (next: MeasurementMode) => void;
  drawPinVariant?: MapPinVariant;
  onSelectPinVariant?: (variant: MapPinVariant) => void;
  drawArrowVariant?: MapArrowVariant;
  onSelectArrowVariant?: (variant: MapArrowVariant) => void;
  onClearShapes?: () => void;
  onClearMeasurements: () => void;
  onClearAllLayers?: () => void;
  /** home: parsel grubu */
  onOpenParcelPolygonDesign?: () => void;
  onHisseliParsellereBol?: () => void;
  hasParcelForHisseli?: boolean;
  onToggleEdgeMeasures?: () => void | Promise<void>;
  /** editor: kenar ölçüleri */
  onEdgeMeasures?: () => void | Promise<void>;
  hasSingleParcelSelected?: boolean;
};

export function MapToolsSheet({
  visible,
  onClose,
  surface,
  insetsBottom,
  shapeDrawingMode,
  measurementMode,
  onSelectShape,
  onSelectMeasurement,
  drawPinVariant,
  onSelectPinVariant,
  drawArrowVariant,
  onSelectArrowVariant,
  onClearShapes,
  onClearMeasurements,
  onClearAllLayers,
  onOpenParcelPolygonDesign,
  onHisseliParsellereBol,
  hasParcelForHisseli = false,
  onToggleEdgeMeasures,
  onEdgeMeasures,
  hasSingleParcelSelected = false,
}: Props) {
  const [parcelGroupOpen, setParcelGroupOpen] = useState(false);
  const [measureGroupOpen, setMeasureGroupOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setParcelGroupOpen(false);
    setMeasureGroupOpen(false);
  }, [visible]);

  const measureGroupTitle = surface === "home" ? "Ölçüm" : "Ölçüm araçları";
  const clearShapesMessage =
    surface === "home"
      ? "Haritadaki çizim şekillerini kaldırmak istiyor musunuz?"
      : "Tüm çizim şekillerini kaldırmak istiyor musunuz?";

  const handleHisseliPress = () => {
    const hasParcel = surface === "home" ? hasParcelForHisseli : hasSingleParcelSelected;
    if (!hasParcel) {
      Alert.alert("Uyarı", "Parsel seçiniz.");
      return;
    }
    onHisseliParsellereBol?.();
    onClose();
  };

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      flushToScreenBottom={surface === "editor"}
      snapPoints={["75%", "92%"]}
      initialIndex={0}
      backdropPressBehavior="close"
      backgroundStyle={
        surface === "home"
          ? MAP_TOOLS_SHEET_BACKGROUND
          : {
              backgroundColor: "#1e293b",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTopWidth: 4,
              borderTopColor: "#3b82f6",
            }
      }
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
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Harita araçları</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat">
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={{ flex: 1, paddingHorizontal: 10 }}
          contentContainerStyle={{
            paddingBottom:
              surface === "editor"
                ? sheetEditorScrollBottomPadding(insetsBottom, 12)
                : sheetScrollBottomPadding(insetsBottom, 24),
          }}
        >
          {surface === "home" ? (
            <>
              <TouchableOpacity
                style={[styles.dropdownMenuItem, { backgroundColor: "rgba(51,65,85,0.5)" }]}
                onPress={() => setParcelGroupOpen((v) => !v)}
              >
                <MaterialCommunityIcons name="map-marker-path" size={18} color="#94a3b8" />
                <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>Parsel</Text>
                <Ionicons
                  name={parcelGroupOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#94a3b8"
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>
              {parcelGroupOpen ? (
                <>
                  <TouchableOpacity
                    testID="parcel-polygon-design-opt"
                    style={styles.dropdownMenuItem}
                    onPress={() => {
                      onClose();
                      onOpenParcelPolygonDesign?.();
                    }}
                  >
                    <MaterialCommunityIcons name="vector-polygon" size={16} color="#94a3b8" />
                    <Text style={styles.dropdownMenuItemText}>Parsel Poligon Tasarımı</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="hisseli-parsellere-bol-opt"
                    style={[styles.dropdownMenuItem, hasParcelForHisseli && styles.dropdownMenuItemActive]}
                    onPress={handleHisseliPress}
                  >
                    <MaterialCommunityIcons
                      name="git-branch-outline"
                      size={16}
                      color={hasParcelForHisseli ? "#3b82f6" : "#94a3b8"}
                    />
                    <Text style={[styles.dropdownMenuItemText, hasParcelForHisseli && styles.dropdownMenuItemTextActive]}>
                      Hisseli Parsellere Böl
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="show-edges-opt"
                    style={styles.dropdownMenuItem}
                    onPress={() => onToggleEdgeMeasures?.()}
                  >
                    <MaterialCommunityIcons name="vector-square" size={16} color="#94a3b8" />
                    <Text style={styles.dropdownMenuItemText}>Kenar Ölçüleri</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </>
          ) : null}

          <View style={{ marginTop: surface === "home" ? 12 : 0 }}>
            <MapDrawToolsSection
              surface={surface}
              shapeDrawingMode={shapeDrawingMode}
              onSelectShape={onSelectShape}
              onClearShapes={onClearShapes}
              onClose={onClose}
              clearConfirmMessage={clearShapesMessage}
              drawPinVariant={drawPinVariant}
              onSelectPinVariant={onSelectPinVariant}
              drawArrowVariant={drawArrowVariant}
              onSelectArrowVariant={onSelectArrowVariant}
            />
          </View>

          <TouchableOpacity
            style={[styles.dropdownMenuItem, { marginTop: 12, backgroundColor: "rgba(51,65,85,0.5)" }]}
            onPress={() => setMeasureGroupOpen((v) => !v)}
          >
            <Ionicons name="analytics-outline" size={18} color="#94a3b8" />
            <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>{measureGroupTitle}</Text>
            <Ionicons
              name={measureGroupOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color="#94a3b8"
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>

          {measureGroupOpen ? (
            <>
              {surface === "editor" ? (
                <TouchableOpacity
                  style={[styles.dropdownMenuItem, hasSingleParcelSelected && styles.dropdownMenuItemActive]}
                  onPress={handleHisseliPress}
                >
                  <Ionicons name="git-branch-outline" size={16} color={hasSingleParcelSelected ? "#3b82f6" : "#94a3b8"} />
                  <Text style={[styles.dropdownMenuItemText, hasSingleParcelSelected && styles.dropdownMenuItemTextActive]}>
                    Hisseli Parsellere Böl
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                testID={surface === "home" ? "measure-distance-opt" : undefined}
                style={[styles.dropdownMenuItem, measurementMode === "distance" && styles.dropdownMenuItemActive]}
                onPress={() => {
                  onSelectMeasurement(measurementMode === "distance" ? null : "distance");
                  onClose();
                }}
              >
                {surface === "home" ? (
                  <MaterialCommunityIcons
                    name="ruler"
                    size={16}
                    color={measurementMode === "distance" ? "#3b82f6" : "#94a3b8"}
                  />
                ) : (
                  <Ionicons name="resize" size={16} color={measurementMode === "distance" ? "#3b82f6" : "#94a3b8"} />
                )}
                <Text style={[styles.dropdownMenuItemText, measurementMode === "distance" && styles.dropdownMenuItemTextActive]}>
                  {surface === "home" ? "Mesafe Ölçüm" : "Mesafe ölçümü"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID={surface === "home" ? "measure-area-opt" : undefined}
                style={[styles.dropdownMenuItem, measurementMode === "area" && styles.dropdownMenuItemActive]}
                onPress={() => {
                  onSelectMeasurement(measurementMode === "area" ? null : "area");
                  onClose();
                }}
              >
                {surface === "home" ? (
                  <MaterialCommunityIcons
                    name="ruler-square"
                    size={16}
                    color={measurementMode === "area" ? "#3b82f6" : "#94a3b8"}
                  />
                ) : (
                  <Ionicons name="square-outline" size={16} color={measurementMode === "area" ? "#3b82f6" : "#94a3b8"} />
                )}
                <Text style={[styles.dropdownMenuItemText, measurementMode === "area" && styles.dropdownMenuItemTextActive]}>
                  {surface === "home" ? "Alan Ölçüm" : "Alan ölçümü"}
                </Text>
              </TouchableOpacity>

              {surface === "editor" ? (
                <>
                  <TouchableOpacity style={styles.dropdownMenuItem} onPress={() => onEdgeMeasures?.()}>
                    <MaterialCommunityIcons name="vector-square" size={16} color="#94a3b8" />
                    <Text style={styles.dropdownMenuItemText}>Kenar mesafeleri</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => {
                      onClearMeasurements();
                      onClose();
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    <Text style={styles.dropdownMenuItemText}>Ölçümleri temizle</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </>
          ) : null}

          {surface === "home" ? (
            <>
              <TouchableOpacity
                testID="eraser-opt"
                style={[styles.dropdownMenuItem, { marginTop: 12 }]}
                onPress={() => {
                  onClearMeasurements();
                  onClose();
                }}
              >
                <MaterialCommunityIcons name="eraser" size={16} color="#ef4444" />
                <Text style={styles.dropdownMenuItemText}>Silgi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="clear-all-measurements-opt"
                style={styles.dropdownMenuItem}
                onPress={() => {
                  onClearAllLayers?.();
                  onClose();
                }}
              >
                <MaterialCommunityIcons name="broom" size={16} color="#ef4444" />
                <Text style={styles.dropdownMenuItemText}>Tümünü Temizle</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </BottomSheetScrollView>
      </View>
    </AppBottomSheetModal>
  );
}
