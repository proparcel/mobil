import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { ShapeType } from "@/src/maps/drawing/types";
import { styles } from "./styles";

type Props = {
  visible: boolean;
  shapeDrawingMode: ShapeType | null;
  measurementMode: "distance" | "area" | null;
  parcelSelectMode: boolean;
  resizeMode: any;
  rotationMode: any;
  /** Kalem / serbest için: çizim hedefi */
  drawSurface?: "map" | "screen";
  onToggleDrawSurface?: () => void;
  showDrawSurfaceToggle?: boolean;
};

export const ModeInfoBar: React.FC<Props> = ({
  visible,
  shapeDrawingMode,
  measurementMode,
  parcelSelectMode,
  resizeMode,
  rotationMode,
  drawSurface = "map",
  onToggleDrawSurface,
  showDrawSurfaceToggle = false,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.infoContainer}>
      {showDrawSurfaceToggle && onToggleDrawSurface ? (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => drawSurface !== "map" && onToggleDrawSurface()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: drawSurface === "map" ? "rgba(59, 130, 246, 0.35)" : "rgba(51, 65, 85, 0.6)",
              borderWidth: 1,
              borderColor: drawSurface === "map" ? "#3b82f6" : "#475569",
            }}
          >
            <Text style={{ color: drawSurface === "map" ? "#e2e8f0" : "#94a3b8", fontSize: 12, fontWeight: "600" }}>Haritaya çiz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => drawSurface !== "screen" && onToggleDrawSurface()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: drawSurface === "screen" ? "rgba(59, 130, 246, 0.35)" : "rgba(51, 65, 85, 0.6)",
              borderWidth: 1,
              borderColor: drawSurface === "screen" ? "#3b82f6" : "#475569",
            }}
          >
            <Text style={{ color: drawSurface === "screen" ? "#e2e8f0" : "#94a3b8", fontSize: 12, fontWeight: "600" }}>Ekrana çiz</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <Text style={styles.infoText}>
        {resizeMode && "Haritanın herhangi bir yerine dokunarak şekli büyütüp küçültebilirsiniz. Uzun basarak bitirin."}
        {rotationMode && "Haritanın herhangi bir yerine dokunarak şekli döndürebilirsiniz. Uzun basarak bitirin."}
        {!resizeMode && !rotationMode && shapeDrawingMode === "rectangle" && "İki nokta tıklayın (başlangıç, bitiş)"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "triangle" && "Üç nokta tıklayın"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "circle" && "İki nokta tıklayın (merkez, yarıçap)"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "ellipse" && "Üç nokta tıklayın (merkez, eksen1, eksen2)"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "polygon" && "Noktalar tıklayın, uzun basarak bitirin"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "line" && "Noktalar tıklayın, uzun basarak bitirin"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "pen" && "Parmağınızı sürükleyin (kalem)"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "freehand" && "Parmağınızı sürükleyin (serbest çizim)"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "arrow" && "İki nokta tıklayın (başlangıç, bitiş)"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "marker" && "Bir nokta tıklayın"}
        {!resizeMode && !rotationMode && shapeDrawingMode === "textbox" && "Bir nokta tıklayın"}
        {!resizeMode && !rotationMode && measurementMode === "distance" && "İki nokta tıklayın (mesafe ölçümü)"}
        {!resizeMode && !rotationMode && measurementMode === "area" && "Noktalar tıklayın, uzun basarak bitirin (alan ölçümü)"}
        {!resizeMode && !rotationMode && parcelSelectMode && "Haritada bir noktaya tıklayın (parsel seçimi)"}
      </Text>
    </View>
  );
};
