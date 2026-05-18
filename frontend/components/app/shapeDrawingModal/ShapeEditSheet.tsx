import React, { useCallback, useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { getShapeCenter, scaleShapeAround } from "@/src/maps/drawing/shapeResizeUtils";
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
  /** Şekli sil + seçimi kapat (üst bileşen state günceller) */
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
  const selectedShape = useMemo(() => {
    if (!selectedShapeId) return null;
    return shapes.find((s) => s.id === selectedShapeId) || null;
  }, [selectedShapeId, shapes]);

  const applyShapeSizePercent = useCallback(
    (nextPercent: number) => {
      if (!selectedShapeId) return;
      const clamped = Math.max(50, Math.min(200, Math.round(nextPercent)));
      setShapes((prev) => {
        const shape = prev.find((s) => s.id === selectedShapeId);
        if (!shape) return prev;
        const prevPct = typeof (shape as any).shapeSizePercent === "number" ? (shape as any).shapeSizePercent : 100;
        const ratio = clamped / prevPct;
        if ((shape as any).type === "marker") {
          return prev.map((s) => (s.id === selectedShapeId ? { ...s, shapeSizePercent: clamped } : s));
        }
        const center = getShapeCenter(shape as any);
        const rot = typeof (shape as any).rotation === "number" ? (shape as any).rotation : 0;
        const scaled = scaleShapeAround(shape as any, center, ratio, ratio, rot);
        return prev.map((s) =>
          s.id === selectedShapeId ? ({ ...(scaled as any), shapeSizePercent: clamped } as any) : s
        );
      });
    },
    [selectedShapeId, setShapes]
  );

  if (!visible || !selectedShapeId || !selectedShape) return null;

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["12%", "60%", "92%"]}
      index={minimized ? 0 : 1}
      backdropPressBehavior="close"
      backgroundStyle={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
    >
      <View style={{ flex: 1, paddingBottom: insetsBottom }}>
        <View style={styles.editPanelHeader} pointerEvents="auto">
          <Text style={styles.editPanelTitle}>Şekil Düzenle</Text>
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
            contentContainerStyle={[styles.editPanelContentContainer, { paddingBottom: Math.max(insetsBottom, 0) + 100 }]}
            scrollEventThrottle={16}
          >
            {/* Renk Düzenleme */}
            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Renkler</Text>
              <View style={styles.colorRow}>
                <View style={styles.colorInputGroup}>
                  <Text style={styles.colorLabel}>Çizgi</Text>
                  <TouchableOpacity
                    style={[styles.colorButton, { backgroundColor: selectedShape.outlineColor || "#2563eb" }]}
                    onPress={() => {
                      const colors = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
                      const currentIndex = colors.indexOf(selectedShape.outlineColor || "#2563eb");
                      const nextColor = colors[(currentIndex + 1) % colors.length];
                      setShapes((prev) => prev.map((s) => (s.id === selectedShapeId ? { ...s, outlineColor: nextColor } : s)));
                    }}
                  />
                </View>
                {(selectedShape.geometry?.type === "Polygon" ||
                  selectedShape.type === "circle" ||
                  selectedShape.type === "ellipse" ||
                  selectedShape.type === "textbox") && (
                  <View style={styles.colorInputGroup}>
                    <Text style={styles.colorLabel}>Dolgu</Text>
                    <TouchableOpacity
                      style={[styles.colorButton, { backgroundColor: selectedShape.fillColor || "#3b82f6" }]}
                      onPress={() => {
                        const colors = ["#3b82f6", "#f87171", "#34d399", "#fbbf24", "#a78bfa", "#f472b6"];
                        const currentIndex = colors.indexOf(selectedShape.fillColor || "#3b82f6");
                        const nextColor = colors[(currentIndex + 1) % colors.length];
                        setShapes((prev) => prev.map((s) => (s.id === selectedShapeId ? { ...s, fillColor: nextColor } : s)));
                      }}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Boyut (ölçek) */}
            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>
                Boyut: %{typeof (selectedShape as any).shapeSizePercent === "number" ? (selectedShape as any).shapeSizePercent : 100}
              </Text>
              <Slider
                style={styles.sizeSlider}
                minimumValue={50}
                maximumValue={200}
                step={1}
                value={typeof (selectedShape as any).shapeSizePercent === "number" ? (selectedShape as any).shapeSizePercent : 100}
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

            {/* Kalınlık */}
            {(selectedShape.geometry?.type === "Polygon" ||
              selectedShape.geometry?.type === "LineString" ||
              selectedShape.type === "textbox") && (
              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>Kalınlık: {selectedShape.outlineWidth || 2}px</Text>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>1</Text>
                  <View style={styles.sliderContainer}>
                    <View style={[styles.sliderTrack, { width: `${(((selectedShape.outlineWidth || 2) - 1) / 9) * 100}%` }]} />
                  </View>
                  <Text style={styles.sliderLabel}>10</Text>
                </View>
                <View style={styles.sliderButtons}>
                  {[1, 2, 3, 4, 5].map((w) => (
                    <TouchableOpacity
                      key={w}
                      style={[styles.sliderButton, (selectedShape.outlineWidth || 2) === w && styles.sliderButtonActive]}
                      onPress={() => {
                        setShapes((prev) => prev.map((s) => (s.id === selectedShapeId ? { ...s, outlineWidth: w } : s)));
                      }}
                    >
                      <Text style={styles.sliderButtonText}>{w}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* TextBox gelişmiş ayarlar */}
            {selectedShape.type === "textbox" && (
              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>Metin Kutusu</Text>

                <View style={styles.sliderButtons}>
                  <TouchableOpacity
                    style={[styles.sliderButton, styles.sliderButtonActive]}
                    onPress={() => {
                      if (selectedShapeId) openTextBoxEditor(selectedShapeId);
                    }}
                  >
                    <Text style={styles.sliderButtonText}>Metni Düzenle</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.editSectionTitle, { marginTop: 10 }]}>
                  Yazı Boyutu: {(selectedShape as any).textSize || 14}
                </Text>
                <View style={styles.sliderButtons}>
                  {[12, 14, 16, 18, 20, 24].map((sz) => (
                    <TouchableOpacity
                      key={sz}
                      style={[styles.sliderButton, ((selectedShape as any).textSize || 14) === sz && styles.sliderButtonActive]}
                      onPress={() => {
                        setShapes((prev) => prev.map((s) => (s.id === selectedShapeId ? { ...s, textSize: sz } : s)));
                      }}
                    >
                      <Text style={styles.sliderButtonText}>{sz}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.editSectionTitle, { marginTop: 10 }]}>Yazı Rengi</Text>
                <View style={styles.sliderButtons}>
                  {["#ffffff", "#000000", "#f8fafc", "#f59e0b", "#10b981", "#3b82f6"].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.sliderButton, { backgroundColor: c, borderWidth: 1, borderColor: "#334155" }]}
                      onPress={() => {
                        setShapes((prev) => prev.map((s) => (s.id === selectedShapeId ? { ...s, textColor: c } : s)));
                      }}
                    >
                      <Text style={styles.sliderButtonText}></Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Sil Butonu */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                onDeleteShape();
              }}
            >
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={styles.deleteButtonText}>Şekli Sil</Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        )}
      </View>
    </AppBottomSheetModal>
  );
};

