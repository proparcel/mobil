import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { ModelInstance } from "@/src/maps/models/ModelManager";

type Props = {
  instances: ModelInstance[];
  // Mapbox.Models'e verilen string mapping
  modelsProp?: Record<string, string | number>;
  pitch?: number;
  hasTerrain?: boolean;
  onFocusModel: (instance: ModelInstance) => void;
  onRemoveInstance?: (instanceId: string) => void;
  bottomInset: number;
};

export const ModelDebugPanel: React.FC<Props> = ({
  instances,
  modelsProp,
  pitch = 0,
  hasTerrain = false,
  onFocusModel,
  onRemoveInstance,
  bottomInset,
}) => {
  if (instances.length === 0) {
    return null;
  }

  const getInstanceStatus = (instance: ModelInstance) => {
    const entry = modelsProp?.[instance.modelId];
    const hasRegistry = entry !== undefined && entry !== null && String(entry).trim() !== "";
    const canRender3D = pitch > 0;
    const shouldRenderModelLayer = canRender3D;

    if (!hasRegistry) {
      return { status: "error", icon: "close-circle", color: "#ef4444", text: "Registry yok" };
    }
    if (!shouldRenderModelLayer) {
      return {
        status: "warning",
        icon: "warning",
        color: "#f59e0b",
        text: "2D mod (pitch=0, fallback layer)",
      };
    }
    return { status: "ok", icon: "checkmark-circle", color: "#22c55e", text: "Render edilebilir" };
  };

  return (
    <View
      style={{
        position: "absolute",
        bottom: Math.max(bottomInset, 0) + 12,
        left: 12,
        right: 12,
        maxHeight: Math.min(400, Math.round((instances.length * 120) + 60)),
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderWidth: 1,
        borderColor: "rgba(59, 130, 246, 0.4)",
        borderRadius: 12,
        zIndex: 1100, // ParcelInfoPanel'in üstünde
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(59, 130, 246, 0.2)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
          Model Debug ({instances.length} instance)
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
          }}
        >
          <Ionicons name="information-circle" size={14} color="#3b82f6" />
          <Text style={{ color: "#94a3b8", fontSize: 11 }}>
            Pitch: {pitch.toFixed(0)}° {hasTerrain ? "| Terrain: Açık" : "| Terrain: Kapalı"}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ maxHeight: Math.min(340, Math.round(instances.length * 120)) }}
        showsVerticalScrollIndicator={true}
      >
        {instances.map((instance, index) => {
          const status = getInstanceStatus(instance);
          const entry = modelsProp?.[instance.modelId];

          return (
            <View
              key={instance.id}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderBottomWidth: index < instances.length - 1 ? 1 : 0,
                borderBottomColor: "rgba(59, 130, 246, 0.1)",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Ionicons name={status.icon as any} size={16} color={status.color} />
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600", flex: 1 }}>
                  {instance.modelId}
                </Text>
                <Text style={{ color: status.color, fontSize: 10 }}>{status.text}</Text>
              </View>

              <View style={{ marginLeft: 24, gap: 4 }}>
                <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                  Koordinat: [{instance.coordinate[0].toFixed(6)}, {instance.coordinate[1].toFixed(6)}]
                </Text>
                <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                  Scale: [{instance.modelScale[0]}, {instance.modelScale[1]}, {instance.modelScale[2]}]
                </Text>
                <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                  Rotation: [{instance.modelRotation[0]}, {instance.modelRotation[1]}, {instance.modelRotation[2]}]
                </Text>
                <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                  Translation: [{instance.modelTranslation[0]}, {instance.modelTranslation[1]}, {instance.modelTranslation[2]}]
                </Text>
                <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                  Opacity: {instance.modelOpacity}
                </Text>
                {entry !== undefined && entry !== null && (
                  <Text style={{ color: "#64748b", fontSize: 9, marginTop: 2 }}>
                    Registry: {typeof entry === "string" ? (entry.startsWith("file://") ? "file://..." : entry.startsWith("http") ? "http..." : "uri...") : "assetId"}
                  </Text>
                )}
              </View>

              <View style={{ marginTop: 8, marginLeft: 24, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <TouchableOpacity
                  onPress={() => onFocusModel(instance)}
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
                  <Ionicons name="locate" size={12} color="#3b82f6" />
                  <Text style={{ color: "#3b82f6", fontSize: 10, fontWeight: "600" }}>Focus</Text>
                </TouchableOpacity>
                {onRemoveInstance ? (
                  <TouchableOpacity
                    onPress={() => onRemoveInstance(instance.id)}
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.2)",
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={12} color="#ef4444" />
                    <Text style={{ color: "#ef4444", fontSize: 10, fontWeight: "600" }}>Sil</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};
