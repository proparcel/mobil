import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { ModelInstance } from "@/src/maps/models/ModelManager";

type Props = {
  instances: ModelInstance[];
  onFocusAll: () => void;
  onTogglePanel?: () => void;
  panelVisible?: boolean;
  hasPlacementStatus?: boolean; // Model placement status görünüyor mu?
};

export const ModelDebugBanner: React.FC<Props> = ({
  instances,
  onFocusAll,
  onTogglePanel,
  panelVisible = false,
  hasPlacementStatus = false,
}) => {
  // Model instance yoksa banner'ı gösterme
  if (instances.length === 0) {
    return null;
  }

  const modelCount = instances.length;
  const modelText = modelCount === 1 ? "Model Eklendi" : "Model Eklendi";

  // Model placement status varsa onun altında, yoksa üstte
  // Placement status yaklaşık 60px yüksekliğinde, 12px top + 60px + 8px gap = 80px
  const topOffset = hasPlacementStatus ? 80 : 12;

  return (
    <View
      style={{
        position: "absolute",
        top: topOffset,
        left: 12,
        right: 12,
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderWidth: 1,
        borderColor: "rgba(59, 130, 246, 0.4)",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        zIndex: 1199, // Model placement status'un altında (1200)
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
      pointerEvents="box-none"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
        <View
          style={{
            backgroundColor: "rgba(34, 197, 94, 0.2)",
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "700" }}>
            {modelCount} {modelText}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onFocusAll}
          style={{
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="locate" size={14} color="#3b82f6" />
          <Text style={{ color: "#3b82f6", fontSize: 11, fontWeight: "600" }}>
            Tüm Modellere Odaklan
          </Text>
        </TouchableOpacity>
      </View>

      {onTogglePanel && (
        <TouchableOpacity
          onPress={onTogglePanel}
          style={{
            padding: 4,
            borderRadius: 4,
            backgroundColor: panelVisible ? "rgba(59, 130, 246, 0.2)" : "transparent",
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={panelVisible ? "chevron-up" : "chevron-down"}
            size={18}
            color={panelVisible ? "#3b82f6" : "#94a3b8"}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};
