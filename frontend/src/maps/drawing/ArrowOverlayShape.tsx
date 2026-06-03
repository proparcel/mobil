import React from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";
import type { ArrowScreenModel } from "./arrowOverlayGeometry";
import { getArrowGradientColors, mixHexColor } from "./mapArrowStyles";

type Props = {
  shapeId: string;
  model: ArrowScreenModel;
  outlineColor: string;
  selected?: boolean;
  onPress?: () => void;
};

/** 4 ok tipi — ortak premium katmanlı SVG (ekran piksel uzayı). */
export function ArrowOverlayShape({ shapeId, model, outlineColor, selected = false, onPress }: Props) {
  const colors = getArrowGradientColors(outlineColor, selected);
  const color = colors.dark;
  const paths = model.premium;
  const gradMainId = `arrow-main-${shapeId}`;
  const gradHeadId = `arrow-head-${shapeId}`;
  const { mainWidth } = model;
  const shadowColor = mixHexColor(color, "#000000", 0.72);
  const headDark = mixHexColor(color, "#000000", 0.55);
  const rimColor = mixHexColor(color, "#ffffff", 0.62);
  const shadowOffsetX = Math.max(1.5, mainWidth * 0.22);
  const shadowOffsetY = Math.max(2, mainWidth * 0.32);
  const rimStroke = Math.max(0.8, mainWidth * 0.12);
  const headStroke = Math.max(1, mainWidth * 0.14);
  const headOutline = Math.max(0.8, mainWidth * 0.11);
  const shadowSpread = Math.max(3, mainWidth * 0.55);
  const hitStroke = Math.max(mainWidth + 28, 36);

  return (
    <>
      <Defs>
        <LinearGradient
          id={gradMainId}
          gradientUnits="userSpaceOnUse"
          x1={model.grad.x1}
          y1={model.grad.y1}
          x2={model.grad.x2}
          y2={model.grad.y2}
        >
          <Stop offset="0%" stopColor={mixHexColor(color, "#ffffff", 0.55)} />
          <Stop offset="45%" stopColor={color} />
          <Stop offset="100%" stopColor={headDark} />
        </LinearGradient>
        <LinearGradient
          id={gradHeadId}
          gradientUnits="userSpaceOnUse"
          x1={model.grad.x1}
          y1={model.grad.y1}
          x2={model.grad.x2}
          y2={model.grad.y2}
        >
          <Stop offset="0%" stopColor={mixHexColor(color, "#ffffff", 0.65)} />
          <Stop offset="45%" stopColor={color} />
          <Stop offset="100%" stopColor={mixHexColor(headDark, "#000000", 0.25)} />
        </LinearGradient>
      </Defs>

      <G>
        {onPress ? (
          <>
            <Path
              d={paths.bodyPath}
              stroke="transparent"
              strokeWidth={hitStroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              onPress={onPress}
            />
            <Path
              d={paths.headPath}
              fill="rgba(0,0,0,0.001)"
              stroke="transparent"
              strokeWidth={12}
              onPress={onPress}
            />
          </>
        ) : null}
        <Path
          d={paths.bodyPath}
          stroke={shadowColor}
          strokeWidth={mainWidth + shadowSpread}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.35}
          transform={`translate(${shadowOffsetX} ${shadowOffsetY})`}
        />

        <Path
          d={paths.bodyPath}
          stroke={`url(#${gradMainId})`}
          strokeWidth={mainWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        <Path
          d={paths.bodyPath}
          stroke={rimColor}
          strokeWidth={rimStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.65}
        />

        <Path
          d={paths.highlightPath}
          stroke="#FFFFFF"
          strokeWidth={Math.max(2, mainWidth * 0.16)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.5}
        />

        <Path
          d={paths.headPath}
          fill={shadowColor}
          opacity={0.38}
          transform={`translate(${shadowOffsetX} ${shadowOffsetY})`}
        />

        <Path
          d={paths.headPath}
          fill={`url(#${gradHeadId})`}
          stroke={rimColor}
          strokeWidth={headStroke}
        />

        <Path
          d={paths.headPath}
          fill="none"
          stroke={headDark}
          strokeWidth={headOutline}
          opacity={0.35}
        />

        <Path d={paths.headHighlightPath} fill="#FFFFFF" opacity={0.32} />
      </G>
    </>
  );
}
