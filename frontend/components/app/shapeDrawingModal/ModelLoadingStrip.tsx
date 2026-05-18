import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

type Props = {
  visible: boolean;
  text: string;
  progress: number | null;
};

/**
 * Tam ekran modal yerine harita üzerinde tek satır yükleme; model indirme veya haritada çizim beklerken.
 */
export const ModelLoadingStrip: React.FC<Props> = ({ visible, text, progress }) => {
  if (!visible) return null;

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
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.35)",
        maxWidth: 480,
        alignSelf: "center",
      }}
    >
      <ActivityIndicator size="small" color="#60a5fa" />
      <Text
        style={{ color: "#f1f5f9", fontSize: 13, fontWeight: "600", flexShrink: 1 }}
        numberOfLines={1}
      >
        {text}
        {typeof progress === "number" ? ` · %${Math.round(progress)}` : ""}
      </Text>
    </View>
  );
};
