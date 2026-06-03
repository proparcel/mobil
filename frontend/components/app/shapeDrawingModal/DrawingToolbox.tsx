import React, { useState } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { ShapeProperties, ShapeType } from "@/src/maps/drawing/types";
import type { MeasurementMode, ToolboxAnnotationMode } from "@/src/utils/measurementManager";
import type { MapPinVariant } from "@/src/maps/drawing/mapPinStyles";
import type { MapArrowVariant } from "@/src/maps/drawing/mapArrowStyles";
import { ColorPaletteField } from "./ColorPaletteField";
import { PinStylePicker } from "./PinStylePicker";
import { ArrowStylePicker } from "./ArrowStylePicker";

export type ToolboxMeasurementMode = MeasurementMode | ToolboxAnnotationMode;

type Props = {
  visible: boolean;
  shapeDrawingMode?: ShapeType | null;
  measurementMode: ToolboxMeasurementMode;
  /** Modal şekil çizimi; ana haritada kullanılmaz */
  outlineColor?: string;
  onOutlineColorChange?: (hex: string) => void;
  outlineWidth?: number;
  onOutlineWidthChange?: (w: number) => void;
  fillColor?: string;
  onFillColorChange?: (hex: string) => void;
  rulerColor: string;
  onRulerColorChange: (hex: string) => void;
  areaColor: string;
  onAreaColorChange: (hex: string) => void;
  onFinishMeasurement: () => void;
  onClose: () => void;
  topInset: number;
  /** Ana sayfa işaret modları (iğne / metin / ok) */
  annotationColor?: string;
  onAnnotationColorChange?: (hex: string) => void;
  arrowFirstPoint?: [number, number] | null;
  drawPinVariant?: MapPinVariant;
  onSelectPinVariant?: (variant: MapPinVariant) => void;
  drawArrowVariant?: MapArrowVariant;
  onSelectArrowVariant?: (variant: MapArrowVariant) => void;
  selectedShape?: ShapeProperties | null;
  onDeleteSelectedShape?: () => void;
  openTextBoxEditor?: (shapeId: string) => void;
  onOpenAdvancedEdit?: () => void;
};

function showWidthRow(mode: ShapeType | null): boolean {
  if (!mode) return false;
  if (mode === "marker") return false;
  if (mode === "pen" || mode === "freehand") return true;
  return true;
}

function selectedSupportsFill(s: ShapeProperties | null): boolean {
  if (!s) return false;
  if (s.type === "circle" || s.type === "ellipse" || s.type === "textbox") return true;
  return s.geometry?.type === "Polygon";
}

function selectedSupportsOutlineWidth(s: ShapeProperties | null): boolean {
  if (!s) return false;
  return (
    s.geometry?.type === "Polygon" || s.geometry?.type === "LineString" || s.geometry?.type === "Point" || s.type === "textbox"
  );
}

export const DrawingToolbox: React.FC<Props> = ({
  visible,
  shapeDrawingMode = null,
  measurementMode,
  outlineColor = "#3b82f6",
  onOutlineColorChange = () => {},
  outlineWidth = 4,
  onOutlineWidthChange = () => {},
  fillColor = "rgba(59, 130, 246, 0.25)",
  onFillColorChange = () => {},
  rulerColor,
  onRulerColorChange,
  areaColor,
  onAreaColorChange,
  onFinishMeasurement,
  onClose,
  topInset,
  selectedShape = null,
  onDeleteSelectedShape,
  openTextBoxEditor,
  onOpenAdvancedEdit,
  annotationColor = "#3b82f6",
  onAnnotationColorChange,
  arrowFirstPoint = null,
  drawPinVariant = "classic",
  onSelectPinVariant,
  drawArrowVariant = "classic",
  onSelectArrowVariant,
}) => {
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  if (!visible) return null;

  const measuring = measurementMode === "distance" || measurementMode === "area";
  const annotating =
    measurementMode === "pin" || measurementMode === "text" || measurementMode === "arrow";
  const drawing = Boolean(shapeDrawingMode);
  const editingSelection = Boolean(selectedShape) && !measuring && !annotating;

  return (
    <View
      style={[toolboxStyles.wrap, { top: Math.max(8, topInset) + 6 }]}
      accessibilityLabel="Çizim özellikleri"
    >
      <View style={toolboxStyles.head}>
        <Text style={toolboxStyles.title}>{editingSelection ? "Seçili şekil" : "Özellikler"}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color="#e2e8f0" />
        </TouchableOpacity>
      </View>

      {measuring && (
        <>
          <Text style={toolboxStyles.hint}>
            {measurementMode === "distance"
              ? "İki nokta ile mesafe; yarım kalan ilk noktayı bitir ile iptal edebilirsiniz."
              : "Alan için en az 3 nokta; bitir ile poligonu kaydedin."}
          </Text>
          <ColorPaletteField
            label="Ölçüm rengi"
            value={measurementMode === "distance" ? rulerColor : areaColor}
            onSelect={(c) =>
              measurementMode === "distance" ? onRulerColorChange(c) : onAreaColorChange(c)
            }
            pickerId="measure"
            activePickerId={activeColorPicker}
            setActivePickerId={setActiveColorPicker}
          />
          <TouchableOpacity style={toolboxStyles.finishBtn} onPress={onFinishMeasurement} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={toolboxStyles.finishBtnText}>Mevcut ölçümü bitir</Text>
          </TouchableOpacity>
        </>
      )}

      {annotating && (
        <>
          <Text style={toolboxStyles.hint}>
            {measurementMode === "pin"
              ? "Haritaya dokunarak iğne ekleyin. Renk aşağıdan."
              : measurementMode === "text"
                ? "Haritaya dokunarak metin ekleyin. Renk aşağıdan."
                : arrowFirstPoint
                  ? "Ok bitiş noktasını seçin veya bitir ile başlangıcı iptal edin."
                  : "Ok başlangıç noktasını seçin."}
          </Text>
          <ColorPaletteField
            label="İşaret rengi"
            value={annotationColor}
            onSelect={(c) => onAnnotationColorChange?.(c)}
            pickerId="annotate"
            activePickerId={activeColorPicker}
            setActivePickerId={setActiveColorPicker}
          />
          {measurementMode === "arrow" && onSelectArrowVariant ? (
            <ArrowStylePicker
              selected={drawArrowVariant}
              onSelect={onSelectArrowVariant}
              accentColor={annotationColor}
              compact
            />
          ) : null}
          {measurementMode === "arrow" && Boolean(arrowFirstPoint) ? (
            <TouchableOpacity style={toolboxStyles.finishBtn} onPress={onFinishMeasurement} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={toolboxStyles.finishBtnText}>Ok başlangıcını iptal et</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}

      {!measuring && !annotating && editingSelection && selectedShape && (
        <>
          <Text style={toolboxStyles.hint}>Renk dokunuşu seçili şekle uygulanır.</Text>
          <ColorPaletteField
            label="Çizgi rengi"
            value={selectedShape.outlineColor || outlineColor}
            onSelect={onOutlineColorChange}
            pickerId="sel-outline"
            activePickerId={activeColorPicker}
            setActivePickerId={setActiveColorPicker}
          />
          {selectedSupportsFill(selectedShape) && (
            <ColorPaletteField
              label="Dolgu rengi"
              value={selectedShape.fillColor || fillColor}
              onSelect={onFillColorChange}
              pickerId="sel-fill"
              activePickerId={activeColorPicker}
              setActivePickerId={setActiveColorPicker}
            />
          )}
          {selectedSupportsOutlineWidth(selectedShape) && selectedShape.type !== "marker" && (
            <>
              <Text style={toolboxStyles.subLabel}>Çizgi kalınlığı: {Math.round(selectedShape.outlineWidth || outlineWidth)} px</Text>
              <Slider
                style={toolboxStyles.slider}
                minimumValue={1}
                maximumValue={24}
                step={1}
                value={selectedShape.outlineWidth ?? outlineWidth}
                onValueChange={onOutlineWidthChange}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#475569"
                thumbTintColor="#93c5fd"
              />
            </>
          )}
          {selectedShape.type === "textbox" && openTextBoxEditor ? (
            <TouchableOpacity style={toolboxStyles.secondaryBtn} onPress={() => openTextBoxEditor(selectedShape.id)} activeOpacity={0.85}>
              <Ionicons name="text-outline" size={18} color="#e2e8f0" />
              <Text style={toolboxStyles.secondaryBtnText}>Metni düzenle</Text>
            </TouchableOpacity>
          ) : null}
          {onOpenAdvancedEdit ? (
            <TouchableOpacity style={toolboxStyles.secondaryBtn} onPress={onOpenAdvancedEdit} activeOpacity={0.85}>
              <Ionicons name="options-outline" size={18} color="#e2e8f0" />
              <Text style={toolboxStyles.secondaryBtnText}>Boyut ve gelişmiş</Text>
            </TouchableOpacity>
          ) : null}
          {onDeleteSelectedShape ? (
            <TouchableOpacity style={toolboxStyles.deleteBtn} onPress={onDeleteSelectedShape} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={toolboxStyles.deleteBtnText}>Şekli sil</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}

      {!measuring && !annotating && drawing && (
        <>
          {shapeDrawingMode === "marker" && onSelectPinVariant ? (
            <PinStylePicker
              selected={drawPinVariant}
              onSelect={onSelectPinVariant}
              accentColor={outlineColor}
              compact
            />
          ) : null}
          {shapeDrawingMode === "arrow" && onSelectArrowVariant ? (
            <ArrowStylePicker
              selected={drawArrowVariant}
              onSelect={onSelectArrowVariant}
              accentColor={outlineColor}
              compact
            />
          ) : null}
          <ColorPaletteField
            label={shapeDrawingMode === "marker" ? "Kenarlık" : "Çizgi rengi"}
            value={outlineColor}
            onSelect={onOutlineColorChange}
            pickerId="draw-outline"
            activePickerId={activeColorPicker}
            setActivePickerId={setActiveColorPicker}
          />
          {shapeDrawingMode === "marker" ? (
            <ColorPaletteField
              label="İğne rengi"
              value={fillColor.startsWith("rgba") || fillColor.startsWith("rgb(") ? outlineColor : fillColor}
              onSelect={onFillColorChange}
              pickerId="draw-pin-fill"
              activePickerId={activeColorPicker}
              setActivePickerId={setActiveColorPicker}
            />
          ) : null}
          {shapeDrawingMode &&
            shapeDrawingMode !== "marker" &&
            shapeDrawingMode !== "arrow" &&
            shapeDrawingMode !== "line" &&
            shapeDrawingMode !== "pen" &&
            shapeDrawingMode !== "freehand" && (
            <ColorPaletteField
              label="Dolgu rengi"
              value={
                fillColor.startsWith("rgba") || fillColor.startsWith("rgb(")
                  ? outlineColor
                  : fillColor
              }
              onSelect={onFillColorChange}
              pickerId="draw-fill"
              activePickerId={activeColorPicker}
              setActivePickerId={setActiveColorPicker}
            />
          )}
          {showWidthRow(shapeDrawingMode) && (
            <>
              <Text style={toolboxStyles.subLabel}>Çizgi kalınlığı: {Math.round(outlineWidth)} px</Text>
              <Slider
                style={toolboxStyles.slider}
                minimumValue={2}
                maximumValue={24}
                step={1}
                value={outlineWidth}
                onValueChange={onOutlineWidthChange}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#475569"
                thumbTintColor="#93c5fd"
              />
            </>
          )}
        </>
      )}
    </View>
  );
};

const toolboxStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 10,
    left: undefined,
    maxWidth: 300,
    zIndex: 1260,
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.35)",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { color: "#f8fafc", fontSize: 15, fontWeight: "700" },
  hint: { color: "#94a3b8", fontSize: 11, lineHeight: 15, marginBottom: 10 },
  subLabel: { color: "#cbd5e1", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  slider: { width: "100%", height: 36, marginBottom: 4 },
  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(59, 130, 246, 0.9)",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  finishBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(51, 65, 85, 0.95)",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#475569",
  },
  secondaryBtnText: { color: "#e2e8f0", fontWeight: "600", fontSize: 13 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(220, 38, 38, 0.92)",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
