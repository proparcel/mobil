/**
 * Yakalama anında önceden projekte edilmiş vektör overlay (ok) çizimi.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { ArrowOverlayShape } from './ArrowOverlayShape';
import {
  getOverlayFillOpacity,
  getOverlayShapeColors,
  getOverlayStrokeWidth,
} from './mapOverlayStyles';
import type { ShapeProperties } from './types';
import { pointsToSvg, type ProjectedShapeGeometry } from './shapeScreenProjection';

export type MapCaptureVectorItem = {
  shape: ShapeProperties;
  geom: ProjectedShapeGeometry;
};

type Props = {
  width: number;
  height: number;
  items: MapCaptureVectorItem[];
  viewBoxWidth?: number;
  viewBoxHeight?: number;
};

export function MapCaptureVectorOverlay({
  width,
  height,
  items,
  viewBoxWidth,
  viewBoxHeight,
}: Props) {
  if (!items.length) return null;

  const vbW = viewBoxWidth && viewBoxWidth > 1 ? viewBoxWidth : width;
  const vbH = viewBoxHeight && viewBoxHeight > 1 ? viewBoxHeight : height;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid slice"
        style={styles.svg}
      >
        {items.map(({ shape, geom }) => {
          const colors = getOverlayShapeColors(shape, false);
          const strokeW = getOverlayStrokeWidth(shape, false);
          const haloW = strokeW + 3;
          const shadowW = strokeW + 5;

          if (shape.type === 'arrow' && geom.arrow) {
            return (
              <ArrowOverlayShape
                key={shape.id}
                shapeId={shape.id}
                model={geom.arrow}
                outlineColor={colors.outline}
                selected={false}
                onPress={() => {}}
              />
            );
          }

          return (
            <React.Fragment key={shape.id}>
              {geom.polygons.map((ring, idx) => {
                const pts = pointsToSvg(ring);
                return (
                  <Polygon
                    key={`${shape.id}-poly-${idx}`}
                    points={pts}
                    fill={colors.fill}
                    fillOpacity={getOverlayFillOpacity(shape, false)}
                    stroke={colors.outline}
                    strokeWidth={strokeW}
                    strokeLinejoin="round"
                  />
                );
              })}
              {geom.polylines.map((line, idx) => {
                const pts = pointsToSvg(line);
                const shadowPts = pointsToSvg(
                  line.map(([x, y]) => [x + 1.5, y + 1.5] as [number, number]),
                );
                return (
                  <React.Fragment key={`${shape.id}-line-${idx}`}>
                    <Polyline
                      points={shadowPts}
                      fill="none"
                      stroke={colors.shadow}
                      strokeWidth={shadowW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.75}
                    />
                    <Polyline
                      points={pts}
                      fill="none"
                      stroke={colors.halo}
                      strokeWidth={haloW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Polyline
                      points={pts}
                      fill="none"
                      stroke={colors.outline}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
