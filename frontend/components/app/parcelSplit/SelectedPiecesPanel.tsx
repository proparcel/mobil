/**
 * Seçilen parçalar paneli: ayraç altında sol hizalı kartlar (poligon + kenar ölçüleri),
 * satır dolunca alt satıra geçer. Kapat ve tek tek kaldır.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import Svg, { Polygon as SvgPolygon, Text as SvgText } from "react-native-svg";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { Piece, Point } from "../../../src/types/parcelSplit";
import { getBbox } from "../../../src/utils/parcelSplitTransform";
import { parcelSplitTheme } from "./theme";
import type { MetreEdgeFeature } from "./LayerEdgeMeasurements";
import { pieceToEdgeFeaturesMetre } from "./LayerEdgeMeasurements";

const CARD_SIZE = 88;
const CARD_PADDING = 8;
const CARD_GAP = 10;

/** Mini poligon + kenar etiketleri, fit to CARD_SIZE. */
function MiniPieceCard({
  piece,
  onRemove,
}: {
  piece: Piece;
  onRemove: () => void;
}) {
  const ring = piece.polygon.ring;
  const bbox = useMemo(() => getBbox(ring), [ring]);
  const spanX = bbox.maxX - bbox.minX || 1;
  const spanY = bbox.maxY - bbox.minY || 1;
  const scale = Math.min((CARD_SIZE - CARD_PADDING * 2) / spanX, (CARD_SIZE - CARD_PADDING * 2) / spanY, 20);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const pad = CARD_PADDING + (CARD_SIZE - CARD_PADDING * 2) / 2;

  const points = ring.map((p) => {
    const sx = pad + (p.x - cx) * scale;
    const sy = pad + (p.y - cy) * scale;
    return `${sx},${sy}`;
  }).join(" ");

  const edgeFeatures = useMemo(() => pieceToEdgeFeaturesMetre(piece), [piece]);

  const labelPositions = edgeFeatures
    .filter((f): f is MetreEdgeFeature & { type: "Point"; text: string } => f.type === "Point" && !!f.text)
    .map((f) => {
      const sx = pad + (f.coords.x - cx) * scale;
      const sy = pad + (f.coords.y - cy) * scale;
      return { x: sx, y: sy, text: f.text };
    });

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={onRemove}
        accessibilityLabel="Parçayı kaldır"
      >
        <Ionicons name="close-circle" size={22} color={parcelSplitTheme.muted} />
      </TouchableOpacity>
      <Svg width={CARD_SIZE} height={CARD_SIZE} style={styles.cardSvg}>
        <SvgPolygon
          points={points}
          fill={parcelSplitTheme.pieceFill}
          stroke={parcelSplitTheme.pieceStroke}
          strokeWidth={1.2}
        />
        {labelPositions.map((lp, i) => (
          <SvgText
            key={i}
            x={lp.x}
            y={lp.y}
            fontSize={8}
            fontWeight="700"
            fill={parcelSplitTheme.accentBlue}
            textAnchor="middle"
          >
            {lp.text}
          </SvgText>
        ))}
      </Svg>
      <Text style={styles.cardArea} numberOfLines={1}>
        {Math.round(piece.area)} m²
      </Text>
    </View>
  );
}

type Props = {
  selectedPieceIds: string[];
  pieces: Piece[];
  onRemovePiece: (id: string) => void;
  onClose: () => void;
  insetsBottom?: number;
};

export function SelectedPiecesPanel({
  selectedPieceIds,
  pieces,
  onRemovePiece,
  onClose,
  insetsBottom = 0,
}: Props) {
  const selectedPieces = useMemo(
    () => selectedPieceIds.map((id) => pieces.find((p) => p.id === id)).filter((p): p is Piece => !!p),
    [selectedPieceIds, pieces]
  );

  if (selectedPieces.length === 0) return null;

  return (
    <View style={[styles.panel, { paddingBottom: insetsBottom + 8 }]}>
      <View style={styles.separator} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Seçilen parçalar</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Paneli kapat">
          <Ionicons name="chevron-down" size={20} color={parcelSplitTheme.textMuted} />
          <Text style={styles.closeBtnText}>Kapat</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardsRow}>
          {selectedPieces.map((piece) => (
            <MiniPieceCard
              key={piece.id}
              piece={piece}
              onRemove={() => onRemovePiece(piece.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: parcelSplitTheme.cardBg,
    borderTopWidth: 1,
    borderTopColor: parcelSplitTheme.borderSoft,
  },
  separator: {
    height: 1,
    backgroundColor: parcelSplitTheme.borderSoft,
    marginHorizontal: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: parcelSplitTheme.brandNavy,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeBtnText: {
    fontSize: 12,
    color: parcelSplitTheme.textMuted,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
    justifyContent: "flex-start",
  },
  card: {
    width: CARD_SIZE + 4,
    alignItems: "center",
    position: "relative",
  },
  removeBtn: {
    position: "absolute",
    top: -4,
    right: -4,
    zIndex: 1,
    backgroundColor: parcelSplitTheme.cardBg,
    borderRadius: 12,
  },
  cardSvg: {
    backgroundColor: "rgba(248,250,252,0.8)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: parcelSplitTheme.borderSoft,
  },
  cardArea: {
    fontSize: 10,
    color: parcelSplitTheme.textMuted,
    marginTop: 4,
    maxWidth: CARD_SIZE + 4,
  },
});
