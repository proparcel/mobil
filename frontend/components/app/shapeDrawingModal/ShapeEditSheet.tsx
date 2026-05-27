import React, { useCallback, useMemo } from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { getShapeCenter, scaleShapeAround } from "@/src/maps/drawing/shapeResizeUtils";
import { patchTextBoxShape } from "@/src/maps/drawing/textBoxLayout";
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

const TEXT_COLORS = ["#ffffff", "#000000", "#f8fafc", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];
const OUTLINE_COLORS = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
const FILL_COLORS = ["#3b82f6", "#f87171", "#34d399", "#fbbf24", "#a78bfa", "#f472b6"];

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
  const selectedShape = useMemo(() => {
    if (!selectedShapeId) return null;
    return shapes.find((s) => s.id === selectedShapeId) || null;
  }, [selectedShapeId, shapes]);

  const isTextBox = selectedShape?.type === "textbox";

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
    (nextPercent: number) => {
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
        const prevPct = typeof shape.shapeSizePercent === "number" ? shape.shapeSizePercent : 100;
        const ratio = clamped / prevPct;
        const center = getShapeCenter(shape);
        const rot = typeof shape.rotation === "number" ? shape.rotation : 0;
        const scaled = scaleShapeAround(shape, center, ratio, ratio, rot);
        return prev.map((s) =>
          s.id === selectedShapeId ? { ...scaled, shapeSizePercent: clamped } : s
        );
      });
    },
    [selectedShapeId, setShapes]
  );

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

      <Text style={[styles.editSectionTitle, { marginTop: 10 }]}>Yazı rengi</Text>
      <View style={styles.sliderButtons}>
        {TEXT_COLORS.map((c) => {
          const active =
            String(selectedShape.textColor || "#ffffff").toLowerCase() === c.toLowerCase();
          return (
            <TouchableOpacity
              key={c}
              style={[
                styles.sliderButton,
                {
                  backgroundColor: c,
                  borderWidth: active ? 3 : 1,
                  borderColor: active ? "#93c5fd" : "#334155",
                },
              ]}
              onPress={() => updateSelected({ textColor: c })}
              accessibilityLabel={`Yazı rengi ${c}`}
            />
          );
        })}
      </View>
    </View>
  );

  const renderColorsSection = () => (
    <View style={styles.editSection}>
      <Text style={styles.editSectionTitle}>Renkler</Text>
      <View style={styles.colorRow}>
        <View style={styles.colorInputGroup}>
          <Text style={styles.colorLabel}>{isTextBox ? "Kenarlık" : "Çizgi"}</Text>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: selectedShape.outlineColor || "#2563eb" }]}
            onPress={() => {
              const currentIndex = OUTLINE_COLORS.indexOf(selectedShape.outlineColor || "#2563eb");
              const nextColor = OUTLINE_COLORS[(currentIndex + 1) % OUTLINE_COLORS.length];
              updateSelected({ outlineColor: nextColor });
            }}
          />
        </View>
        {(selectedShape.geometry?.type === "Polygon" ||
          selectedShape.type === "circle" ||
          selectedShape.type === "ellipse" ||
          isTextBox) && (
          <View style={styles.colorInputGroup}>
            <Text style={styles.colorLabel}>Dolgu</Text>
            <TouchableOpacity
              style={[styles.colorButton, { backgroundColor: selectedShape.fillColor || "#3b82f6" }]}
              onPress={() => {
                const currentIndex = FILL_COLORS.indexOf(selectedShape.fillColor || "#3b82f6");
                const nextColor = FILL_COLORS[(currentIndex + 1) % FILL_COLORS.length];
                updateSelected({ fillColor: nextColor });
              }}
            />
          </View>
        )}
      </View>
    </View>
  );

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["12%", "60%", "92%"]}
      index={minimized ? 0 : 1}
      backdropPressBehavior="close"
      backgroundStyle={{
        backgroundColor: "#1e293b",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 4,
        borderTopColor: "#3b82f6",
      }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
    >
      <View style={{ flex: 1, paddingBottom: insetsBottom }}>
        <View style={styles.editPanelHeader} pointerEvents="auto">
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
            contentContainerStyle={[
              styles.editPanelContentContainer,
              { paddingBottom: Math.max(insetsBottom, 0) + 100 },
            ]}
            scrollEventThrottle={16}
          >
            {isTextBox && renderTextBoxSection()}

            {renderColorsSection()}

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>
                Boyut: %{typeof selectedShape.shapeSizePercent === "number" ? selectedShape.shapeSizePercent : 100}
              </Text>
              <Slider
                style={styles.sizeSlider}
                minimumValue={50}
                maximumValue={200}
                step={1}
                value={typeof selectedShape.shapeSizePercent === "number" ? selectedShape.shapeSizePercent : 100}
                onValueChange={applyShapeSizePercent}
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
                  Dolgu opaklığı: {Math.round((selectedShape.fillOpacity ?? 0.5) * 100)}%
                </Text>
                <Slider
                  style={styles.sizeSlider}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.05}
                  value={selectedShape.fillOpacity ?? 0.5}
                  onValueChange={(v) => updateSelected({ fillOpacity: v })}
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

            <TouchableOpacity style={styles.deleteButton} onPress={onDeleteShape}>
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={styles.deleteButtonText}>Şekli sil</Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        )}
      </View>
    </AppBottomSheetModal>
  );
};
