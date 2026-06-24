import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { UserCardInfo } from "../../services/aiDroneSimpleEditorService";
import { portraitUserCardPreviewScale } from "../../src/utils/portraitOverlayContract";

type Props = {
  data: UserCardInfo;
  width: number;
  scale?: number;
};

function initialsFromName(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toLocaleUpperCase("tr-TR");
  }
  return (parts[0] || "?").slice(0, 2).toLocaleUpperCase("tr-TR");
}

export function PortraitUserInfoCard({ data, width, scale }: Props) {
  const S = scale ?? portraitUserCardPreviewScale(width);
  const cardHeight = Math.round(76 * S);
  const avatarCenterX = 45 * S;
  const avatarOuterR = 43 * S;
  const avatarInnerR = 39 * S;
  const barTop = 17 * S;
  const barHeight = 58 * S;
  const barLeft = 38 * S;
  const cardWidth = Math.max(200 * S, width);
  const companyName = String(data.companyName || "ProParcel").trim();
  const fullName = String(data.fullName || "").trim();
  const avatarUrl = String(data.avatarUrl || "").trim();
  const initials = initialsFromName(fullName || companyName);
  const barWidth = Math.max(80 * S, cardWidth - barLeft);
  const gradId = `pp-user-card-grad-${Math.round(cardWidth)}`;
  const textLeft = 102 * S;
  const textTop = 28 * S;
  const barRadius = 24 * S;
  const avatarTop = 46 * S - avatarInnerR;

  return (
    <View style={[styles.wrap, { width: cardWidth, height: cardHeight }]}>
      <Svg width={cardWidth} height={cardHeight} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient
            id={gradId}
            x1={barLeft}
            y1={barTop + barHeight / 2}
            x2={cardWidth}
            y2={barTop + barHeight / 2}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="rgba(2, 6, 23, 0.9)" />
            <Stop offset="62%" stopColor="rgba(15, 23, 42, 0.72)" />
            <Stop offset="100%" stopColor="rgba(15, 23, 42, 0)" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect
          x={barLeft}
          y={barTop}
          width={barWidth}
          height={barHeight}
          rx={barRadius}
          fill={`url(#${gradId})`}
        />
        <Circle cx={avatarCenterX} cy={46 * S} r={avatarOuterR} fill="rgba(2, 6, 23, 0.82)" />
        <Circle cx={avatarCenterX} cy={46 * S} r={avatarInnerR} fill="#f97316" opacity={0.98} />
      </Svg>
      <View
        style={{
          position: "absolute",
          left: avatarCenterX - avatarInnerR,
          top: avatarTop,
          width: avatarInnerR * 2,
          height: avatarInnerR * 2,
          borderRadius: avatarInnerR,
          overflow: "hidden",
        }}
        pointerEvents="none"
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: avatarInnerR * 2, height: avatarInnerR * 2 }} />
        ) : (
          <View
            style={{
              width: avatarInnerR * 2,
              height: avatarInnerR * 2,
              backgroundColor: "#f97316",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 24 * S, fontWeight: "850" }}>{initials}</Text>
          </View>
        )}
      </View>
      <View style={{ position: "absolute", left: textLeft, top: textTop, maxWidth: "58%", gap: 2 }} pointerEvents="none">
        {fullName ? (
          <>
            <Text style={{ color: "#e2e8f0", fontSize: 12 * S, fontWeight: "650" }} numberOfLines={1}>
              {companyName}
            </Text>
            <Text style={{ color: "#fff", fontSize: 20 * S, fontWeight: "850" }} numberOfLines={1}>
              {fullName}
            </Text>
          </>
        ) : (
          <Text style={{ color: "#fff", fontSize: 17 * S, fontWeight: "800" }} numberOfLines={1}>
            {companyName}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
});
