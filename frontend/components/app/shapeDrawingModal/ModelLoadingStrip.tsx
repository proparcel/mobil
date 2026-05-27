import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

type Props = {
  visible: boolean;
  text: string;
  progress: number | null;
};

/**
 * Harita üzerinde model indirme / çizim beklerken; yüzde çubuğu + metin.
 */
export const ModelLoadingStrip: React.FC<Props> = ({ visible, text, progress }) => {
  if (!visible) return null;

  const pct =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, progress))
      : null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 10,
        left: 12,
        right: 12,
        zIndex: 2600,
        elevation: 28,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.35)",
        maxWidth: 480,
        alignSelf: "center",
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ActivityIndicator size="small" color="#60a5fa" />
        <Text
          style={{ color: "#f1f5f9", fontSize: 13, fontWeight: "600", flex: 1 }}
          numberOfLines={2}
        >
          {text}
        </Text>
        {pct != null && (
          <Text style={{ color: "#93c5fd", fontSize: 12, fontWeight: "700", minWidth: 36, textAlign: "right" }}>
            %{Math.round(pct)}
          </Text>
        )}
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: "rgba(51, 65, 85, 0.9)",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: pct != null ? `${pct}%` : "35%",
            borderRadius: 3,
            backgroundColor: "#3b82f6",
            opacity: pct != null ? 1 : 0.55,
          }}
        />
      </View>
    </View>
  );
};
