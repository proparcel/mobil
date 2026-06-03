import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { getShapeCenter, scaleShapeAround } from "@/src/maps/drawing/shapeResizeUtils";
import { patchTextBoxShape } from "@/src/maps/drawing/textBoxLayout";
import { ColorPaletteField } from "./ColorPaletteField";
import { PinStylePicker } from "./PinStylePicker";
import { ArrowStylePicker } from "./ArrowStylePicker";
import { SheetSlider } from "./SheetSlider";
import { normalizeMapPinVariant } from "@/src/maps/drawing/mapPinStyles";
import { normalizeMapArrowVariant } from "@/src/maps/drawing/mapArrowStyles";
import {
  EDIT_SHEET_MODAL_PROPS,
  EDIT_SHEET_SNAP_POINTS,
  editSheetExpandedIndex,
  editSheetScrollContentStyle,
  editSheetScrollViewProps,
} from "./editSheetLayout";
import { styles } from "./styles";

type Props = {
  visible: boolean;
  selectedShapeId: string | null;
  shapes: any[];
  setShapes: React.Dispatch<React.SetStateAction<any[]>>;
  insetsBottom: number;

  minimized: boolean;
  setMinimized: (next: boolean) => void;

  onClose: () => void;
  onDeleteShape: () => void;
  openTextBoxEditor: (shapeId: string) => void;
};

export const ShapeEditSheet: React.FC<Props> = ({
  visible,
  selectedShapeId,
  shapes,
  setShapes,
  insetsBottom,
  minimized,
  setMinimized,
  onClose,
  onDeleteShape,
  openTextBoxEditor,
}) => {
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  const selectedShape = useMemo(() => {
    if (!selectedShapeId) return null;
    return shapes.find((s) => s.id === selectedShapeId) || null;
  }, [selectedShapeId, shapes]);

  const isTextBox = selectedShape?.type === "textbox";
  const isMarker = selectedShape?.type === "marker";
  const isArrow = selectedShape?.type === "arrow";

  const updateSelected = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedShapeId) return;
      setShapes((prev) =>
        prev.map((s) => {
          if (s.id !== selectedShapeId) return s;
          if (s.type === "textbox") return patchTextBoxShape(s, patch);
          return { ...s, ...patch };
        })
      );
    },
    [selectedShapeId, setShapes]
  );

  const applyShapeSizePercent = useCallback(
    (nextPercent: number, baseline?: { pct: number; shape: any } | null) => {
      if (!selectedShapeId) return;
      const clamped = Math.max(50, Math.min(200, Math.round(nextPercent)));
      setShapes((prev) => {
        const shape = prev.find((s) => s.id === selectedShapeId);
        if (!shape) return prev;
        if (shape.type === "marker") {
          return prev.map((s) => (s.id === selectedShapeId ? { ...s, shapeSizePercent: clamped } : s));
        }
        if (shape.type === "textbox") {
          return prev.map((s) =>
            s.id === selectedShapeId ? patchTextBoxShape(s, { shapeSizePercent: clamped }) : s
          );
        }
        const baseShape = baseline?.shape ?? shape;
        const basePct = baseline?.pct ?? (typeof shape.shapeSizePercent === "number" ? shape.shapeSizePercent : 100);
        const ratio = clamped / basePct;
        const center = getShapeCenter(baseShape);
        const rot = typeof baseShape.rotation === "number" ? baseShape.rotation : 0;
        const scaled = scaleShapeAround(baseShape, center, ratio, ratio, rot);
        return prev.map((s) =>
          s.id === selectedShapeId ? { ...scaled, shapeSizePercent: clamped } : s
        );
      });
    },
    [selectedShapeId, setShapes]
  );

  const sizePercentBase =
    typeof selectedShape?.shapeSizePercent === "number" ? selectedShape.shapeSizePercent : 100;
  const fillOpacityBase = selectedShape?.fillOpacity ?? 0.5;
  const [sizeDraft, setSizeDraft] = useState(sizePercentBase);
  const [fillOpacityDraft, setFillOpacityDraft] = useState(fillOpacityBase);
  const sizeSlidingRef = useRef(false);
  const fillSlidingRef = useRef(false);
  const sizeSlideBaselineRef = useRef<{ pct: number; shape: any } | null>(null);

  const snapshotShapeForResize = useCallback((shape: any) => {
    try {
      return JSON.parse(JSON.stringify(shape));
    } catch {
      return shape;
    }
  }, []);

  useEffect(() => {
    if (!sizeSlidingRef.current) setSizeDraft(sizePercentBase);
  }, [sizePercentBase, selectedShapeId]);

  useEffect(() => {
    if (!fillSlidingRef.current) setFillOpacityDraft(fillOpacityBase);
  }, [fillOpacityBase, selectedShapeId]);

  if (!visible || !selectedShapeId || !selectedShape) return null;

  const renderTextBoxSection = () => (
    <View style={styles.editSection}>
      <Text style={styles.editSectionTitle}>Metin kutusu</Text>

      <TouchableOpacity
        style={[styles.sliderButton, styles.sliderButtonActive, { marginBottom: 12, alignSelf: "stretch" }]}
        onPress={() => openTextBoxEditor(selectedShapeId!)}
      >
        <Text style={styles.sliderButtonText}>Metni düzenle</Text>
      </TouchableOpacity>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Text style={styles.colorLabel}>Kutu arka planı</Text>
        <Switch
          value={selectedShape.boxFillEnabled !== false}
          onValueChange={(on) => updateSelected({ boxFillEnabled: on })}
          trackColor={{ false: "#475569", true: "#3b82f6" }}
          thumbColor="#fff"
        />
      </View>

      <Text style={styles.editSectionTitle}>
        Yazı boyutu: {selectedShape.textSize || 14}
      </Text>
      <View style={styles.sliderButtons}>
        {[12, 14, 16, 18, 20, 24].map((sz) => (
          <TouchableOpacity
            key={sz}
            style={[
              styles.sliderButton,
              (selectedShape.textSize || 14) === sz && styles.sliderButtonActive,
            ]}
            onPress={() => updateSelected({ textSize: sz })}
          >
            <Text style={styles.sliderButtonText}>{sz}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ColorPaletteField
        label="Yazı rengi"
        value={String(selectedShape.textColor || "#ffffff")}
        onSelect={(c) => updateSelected({ textColor: c })}
        pickerId="text"
        activePickerId={activeColorPicker}
        setActivePickerId={setActiveColorPicker}
      />
    </View>
  );

  const supportsFill =
    selectedShape.geometry?.type === "Polygon" ||
    selectedShape.type === "circle" ||
    selectedShape.type === "ellipse" ||
    isTextBox;

  const renderColorsSection = () => (
    <View style={styles.editSection}>
      <Text style={styles.editSectionTitle}>Renkler</Text>
      <ColorPaletteField
        label={isMarker ? "Kenarlık" : isTextBox ? "Kenarlık" : "Çizgi"}
        value={selectedShape.outlineColor || "#2563eb"}
        onSelect={(c) => updateSelected({ outlineColor: c })}
        pickerId="outline"
        activePickerId={activeColorPicker}
        setActivePickerId={setActiveColorPicker}
      />
      {(supportsFill || isMarker) ? (
        <ColorPaletteField
          label={isMarker ? "İğne rengi" : "Dolgu"}
          value={selectedShape.fillColor || "#3b82f6"}
          onSelect={(c) => updateSelected({ fillColor: c })}
          pickerId="fill"
          activePickerId={activeColorPicker}
          setActivePickerId={setActiveColorPicker}
        />
      ) : null}
    </View>
  );

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      flushToScreenBottom
      snapPoints={[...EDIT_SHEET_SNAP_POINTS]}
      index={editSheetExpandedIndex(minimized)}
      backdropPressBehavior="close"
      backgroundStyle={{
        backgroundColor: "#1e293b",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 4,
        borderTopColor: "#3b82f6",
      }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
      modalProps={EDIT_SHEET_MODAL_PROPS}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.editPanelHeader} pointerEvents="box-none">
          <Text style={styles.editPanelTitle}>
            {isTextBox ? "Metin düzenle" : "Şekil düzenle"}
          </Text>
          <View style={styles.editPanelHeaderButtons}>
            <TouchableOpacity onPress={() => setMinimized(!minimized)} style={styles.editPanelMinimizeButton}>
              <Ionicons name={minimized ? "chevron-up" : "chevron-down"} size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.editPanelCloseButton}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {!minimized && (
          <BottomSheetScrollView
            style={styles.editPanelContent}
            contentContainerStyle={editSheetScrollContentStyle(insetsBottom)}
            {...editSheetScrollViewProps}
          >
            {isTextBox && renderTextBoxSection()}

            {isMarker ? (
              <View style={styles.editSection}>
                <PinStylePicker
                  selected={normalizeMapPinVariant(selectedShape.pinVariant)}
                  onSelect={(variant) => updateSelected({ pinVariant: variant })}
                />
              </View>
            ) : null}

            {isArrow ? (
              <View style={styles.editSection}>
                <ArrowStylePicker
                  selected={normalizeMapArrowVariant(selectedShape.arrowVariant)}
                  onSelect={(variant) => updateSelected({ arrowVariant: variant })}
                />
              </View>
            ) : null}

            {renderColorsSection()}

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>
                Boyut: %{Math.round(sizeDraft)}
              </Text>
              <SheetSlider
                style={styles.sizeSlider}
                minimumValue={50}
                maximumValue={200}
                step={1}
                value={sizeDraft}
                onSlidingStart={() => {
                  sizeSlidingRef.current = true;
                  if (selectedShape && selectedShape.type !== "marker") {
                    sizeSlideBaselineRef.current = {
                      pct: sizePercentBase,
                      shape: snapshotShapeForResize(selectedShape),
                    };
                  } else {
                    sizeSlideBaselineRef.current = null;
                  }
                }}
                onValueChange={(v) => {
                  setSizeDraft(v);
                  if (isMarker) {
                    const clamped = Math.max(50, Math.min(200, Math.round(v)));
                    updateSelected({ shapeSizePercent: clamped });
                  } else if (sizeSlideBaselineRef.current) {
                    applyShapeSizePercent(v, sizeSlideBaselineRef.current);
                  }
                }}
                onSlidingComplete={(v) => {
                  sizeSlidingRef.current = false;
                  setSizeDraft(v);
                  applyShapeSizePercent(v, sizeSlideBaselineRef.current);
                  sizeSlideBaselineRef.current = null;
                }}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#475569"
                thumbTintColor="#e2e8f0"
              />
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>50%</Text>
                <Text style={styles.sliderLabel}>200%</Text>
              </View>
            </View>

            {(selectedShape.geometry?.type === "Polygon" ||
              selectedShape.type === "circle" ||
              selectedShape.type === "ellipse" ||
              isTextBox) && (
              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>
                  Dolgu opaklığı: {Math.round(fillOpacityDraft * 100)}%
                </Text>
                <SheetSlider
                  style={styles.sizeSlider}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.05}
                  value={fillOpacityDraft}
                  onSlidingStart={() => {
                    fillSlidingRef.current = true;
                  }}
                  onValueChange={(v) => {
                    setFillOpacityDraft(v);
                  }}
                  onSlidingComplete={(v) => {
                    fillSlidingRef.current = false;
                    setFillOpacityDraft(v);
                    updateSelected({ fillOpacity: v });
                  }}
                  minimumTrackTintColor="#3b82f6"
                  maximumTrackTintColor="#475569"
                  thumbTintColor="#e2e8f0"
                />
              </View>
            )}

            {(selectedShape.geometry?.type === "Polygon" ||
              selectedShape.geometry?.type === "LineString" ||
              isTextBox) && (
              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>
                  Kalınlık: {selectedShape.outlineWidth || 2}px
                </Text>
                <View style={styles.sliderButtons}>
                  {[1, 2, 3, 4, 5].map((w) => (
                    <TouchableOpacity
                      key={w}
                      style={[
                        styles.sliderButton,
                        (selectedShape.outlineWidth || 2) === w && styles.sliderButtonActive,
                      ]}
                      onPress={() => updateSelected({ outlineWidth: w })}
                    >
                      <Text style={styles.sliderButtonText}>{w}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity style={[styles.deleteButton, { marginBottom: 8 }]} onPress={onDeleteShape}>
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={styles.deleteButtonText}>Şekli sil</Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        )}
      </View>
    </AppBottomSheetModal>
  );
};
