/**
 * Ortak parsel detay modalı: parsel poligonu + kenar ölçüleri (m).
 * Canvas tıklaması veya bottom sheet listesinden seçimde açılır.
 * Ekrana sığması için diyagram boyutu pencereye göre sınırlanır.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, useWindowDimensions } from "react-native";
import Svg, { Polygon as SvgPolygon, Text as SvgText } from "react-native-svg";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { Piece } from "../../../src/types/parcelSplit";
import { getBbox } from "../../../src/utils/parcelSplitTransform";
import { parcelSplitTheme } from "./theme";
import type { MetreEdgeFeature } from "./LayerEdgeMeasurements";
import { pieceToEdgeFeaturesMetre } from "./LayerEdgeMeasurements";

const MAX_MODAL_SIZE = 280;
const PADDING = 24;

export type PieceDetailModalProps = {
  piece: Piece | null;
  onClose: () => void;
};

export function PieceDetailModal({ piece, onClose }: PieceDetailModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const modalSize = useMemo(() => {
    const maxW = windowWidth - PADDING * 2 - 32;
    const maxH = (windowHeight - PADDING * 2 - 80) * 0.6;
    return Math.min(MAX_MODAL_SIZE, maxW, maxH, 240);
  }, [windowWidth, windowHeight]);

  if (!piece) return null;

  const ring = piece.polygon.ring;
  const edgeFeatures = useMemo(() => pieceToEdgeFeaturesMetre(piece), [piece]);
  const labelCoords = useMemo(
    () =>
      edgeFeatures
        .filter((f): f is MetreEdgeFeature & { type: "Point"; text: string } => f.type === "Point" && !!f.text)
        .map((f) => f.coords),
    [edgeFeatures]
  );

  const { minX, maxX, minY, maxY, scale, cx, cy, pad } = useMemo(() => {
    const ringBbox = getBbox(ring);
    let minX = ringBbox.minX;
    let maxX = ringBbox.maxX;
    let minY = ringBbox.minY;
    let maxY = ringBbox.maxY;
    for (const c of labelCoords) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
    }
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const inner = modalSize - 24;
    const scale = Math.min(inner / spanX, inner / spanY, 50);
    const pad = modalSize / 2;
    return { minX, maxX, minY, maxY, scale, cx, cy, pad };
  }, [ring, labelCoords, modalSize]);

  const points = ring
    .map((p) => `${pad + (p.x - cx) * scale},${pad + (p.y - cy) * scale}`)
    .join(" ");

  const labelPositions = edgeFeatures
    .filter((f): f is MetreEdgeFeature & { type: "Point"; text: string } => f.type === "Point" && !!f.text)
    .map((f) => ({
      x: pad + (f.coords.x - cx) * scale,
      y: pad + (f.coords.y - cy) * scale,
      text: f.text,
    }));

  const fontSize = Math.max(9, Math.min(12, Math.floor(modalSize / 24)));

  return (
    <Modal visible transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalContent, { maxWidth: windowWidth - PADDING * 2, maxHeight: windowHeight - PADDING * 2 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{Math.round(piece.area)} m²</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={parcelSplitTheme.textMuted} />
            </TouchableOpacity>
          </View>
          <Svg width={modalSize} height={modalSize} style={styles.modalSvg} viewBox={`0 0 ${modalSize} ${modalSize}`} preserveAspectRatio="xMidYMid meet">
            <SvgPolygon
              points={points}
              fill={parcelSplitTheme.pieceFill}
              stroke={parcelSplitTheme.pieceStroke}
              strokeWidth={2}
            />
            {labelPositions.map((lp, i) => (
              <SvgText
                key={i}
                x={lp.x}
                y={lp.y}
                fontSize={fontSize}
                fontWeight="700"
                fill={parcelSplitTheme.accentBlue}
                textAnchor="middle"
              >
                {lp.text}
              </SvgText>
            ))}
          </Svg>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxWidth: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: parcelSplitTheme.brandNavy,
  },
  modalSvg: {
    backgroundColor: "rgba(248,250,252,0.8)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: parcelSplitTheme.borderSoft,
  },
});
