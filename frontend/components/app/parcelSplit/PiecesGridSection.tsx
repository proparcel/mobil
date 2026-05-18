/**
 * Parça kartları grid: tüm parçaları thumbnail olarak gösterir. Tıklayınca canvas'ta seçilir ve parsel detay modalı (üst seviyede) açılır.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import Svg, { Polygon as SvgPolygon, Text as SvgText } from "react-native-svg";
import type { Piece, Point } from "../../../src/types/parcelSplit";
import { getBbox } from "../../../src/utils/parcelSplitTransform";
import { parcelSplitTheme } from "./theme";
import type { MetreEdgeFeature } from "./LayerEdgeMeasurements";
import { pieceToEdgeFeaturesMetre } from "./LayerEdgeMeasurements";

const CARD_SIZE = 88;
const CARD_PADDING = 8;
const CARD_GAP = 10;

function PieceCard({
  piece,
  selected,
  onPress,
  darkMode,
}: {
  piece: Piece;
  selected: boolean;
  onPress: () => void;
  darkMode?: boolean;
}) {
  const ring = piece.polygon.ring;
  const bbox = useMemo(() => getBbox(ring), [ring]);
  const spanX = bbox.maxX - bbox.minX || 1;
  const spanY = bbox.maxY - bbox.minY || 1;
  const scale = Math.min(
    (CARD_SIZE - CARD_PADDING * 2) / spanX,
    (CARD_SIZE - CARD_PADDING * 2) / spanY,
    20
  );
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const pad = CARD_PADDING + (CARD_SIZE - CARD_PADDING * 2) / 2;

  const points = ring
    .map((p) => {
      const sx = pad + (p.x - cx) * scale;
      const sy = pad + (p.y - cy) * scale;
      return `${sx},${sy}`;
    })
    .join(" ");

  const edgeFeatures = useMemo(() => pieceToEdgeFeaturesMetre(piece), [piece]);
  const labelPositions = edgeFeatures
    .filter((f): f is MetreEdgeFeature & { type: "Point"; text: string } => f.type === "Point" && !!f.text)
    .map((f) => {
      const sx = pad + (f.coords.x - cx) * scale;
      const sy = pad + (f.coords.y - cy) * scale;
      return { x: sx, y: sy, text: f.text };
    });

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={`Parça ${piece.id} - ${Math.round(piece.area)} m²`}
    >
      <Svg width={CARD_SIZE} height={CARD_SIZE} style={[styles.cardSvg, darkMode && styles.cardSvgDark]}>
        <SvgPolygon
          points={points}
          fill={selected ? (darkMode ? "rgba(59,130,246,0.35)" : parcelSplitTheme.pieceHighlight) : (darkMode ? "#334155" : parcelSplitTheme.pieceFill)}
          stroke={selected ? parcelSplitTheme.accentBlue : (darkMode ? "#475569" : parcelSplitTheme.pieceStroke)}
          strokeWidth={selected ? 2 : 1.2}
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
      <Text style={[styles.cardArea, darkMode && styles.cardAreaDark]} numberOfLines={1}>
        {Math.round(piece.area)} m²
      </Text>
    </TouchableOpacity>
  );
}

type Props = {
  pieces: Piece[];
  selectedPieceId: string | null;
  onSelectPiece: (id: string | null) => void;
  /** Dark arka plan için kart stilleri */
  darkMode?: boolean;
};

export function PiecesGridSection({ pieces, selectedPieceId, onSelectPiece, darkMode }: Props) {
  if (pieces.length === 0) {
    return (
      <View style={[styles.empty, darkMode && styles.emptyDark]}>
        <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>Henüz parça yok</Text>
        <Text style={[styles.emptyHint, darkMode && styles.emptyHintDark]}>Hesapla ile bölme yapın</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardsRow}>
          {pieces.map((piece) => (
            <PieceCard
              key={piece.id}
              piece={piece}
              selected={piece.id === selectedPieceId}
              onPress={() => {
                onSelectPiece(selectedPieceId === piece.id ? null : piece.id);
              }}
              darkMode={darkMode}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
    justifyContent: "flex-start",
  },
  card: {
    width: CARD_SIZE + 4,
    alignItems: "center",
    borderRadius: 8,
  },
  cardSelected: {
    backgroundColor: "rgba(59,130,246,0.12)",
    borderRadius: 8,
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
  cardAreaDark: {
    color: "#94a3b8",
  },
  cardSvgDark: {
    backgroundColor: "rgba(51,65,85,0.6)",
    borderColor: "#475569",
  },
  empty: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: parcelSplitTheme.textMuted,
    fontWeight: "600",
  },
  emptyHint: {
    fontSize: 12,
    color: parcelSplitTheme.textMuted,
    marginTop: 4,
  },
  emptyDark: {},
  emptyTextDark: { color: "#94a3b8" },
  emptyHintDark: { color: "#64748b" },
});
