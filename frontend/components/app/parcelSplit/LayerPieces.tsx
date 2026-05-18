/**
 * Piece polygons layer: stroke + fill, highlight selected. World coords.
 */

import React from "react";
import Svg, { Polygon } from "react-native-svg";
import type { Piece } from "../../../src/types/parcelSplit";
import { ringToWorldPoints } from "../../../src/utils/parcelSplitTransform";
import { parcelSplitTheme } from "./theme";

type Props = {
  pieces: Piece[];
  selectedPieceId: string | null;
};

export function LayerPieces({ pieces, selectedPieceId }: Props) {
  return (
    <>
      {pieces.map((p) => {
        const pts = ringToWorldPoints(p.polygon.ring);
        const selected = p.id === selectedPieceId;
        const fill = selected ? parcelSplitTheme.pieceHighlight : parcelSplitTheme.pieceFill;
        const stroke = p.valid ? parcelSplitTheme.pieceStroke : parcelSplitTheme.warningStroke;
        return (
          <Polygon
            key={p.id}
            points={pts}
            fill={fill}
            stroke={stroke}
            strokeWidth={selected ? 2.5 : 1.5}
          />
        );
      })}
    </>
  );
}
