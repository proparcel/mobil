import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type Props = {
  visible: boolean;
  bottomInset: number;
  label?: string;
  onFinish: () => void;
  /** bottom: varsayılan (3D editör); top: ana harita */
  placement?: "top" | "bottom";
  topOffset?: number;
};

/** Çizim modunda altta veya üstte gösterilir. */
export const DrawingFinishBar: React.FC<Props> = ({
  visible,
  bottomInset,
  label = "Çizim bitir",
  onFinish,
  placement = "bottom",
  topOffset = 8,
}) => {
  if (!visible) return null;

  const edgeStyle =
    placement === "top"
      ? { top: topOffset }
      : { bottom: Math.max(bottomInset, 8) + 12 };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        ...edgeStyle,
        alignItems: "center",
        zIndex: 1350,
      }}
    >
      <TouchableOpacity
        onPress={onFinish}
        activeOpacity={0.88}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: "#2563eb",
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.25)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 10,
        }}
        accessibilityLabel={label}
      >
        <Ionicons name="checkmark-circle" size={22} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
};
