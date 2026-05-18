import React, { useCallback, useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { styles } from "./styles";

const PALETTE = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

type Props = {
  visible: boolean;
  selectedMeasurementGroupId: string | null;
  measurementFeatures: any[];
  setMeasurementFeatures: React.Dispatch<React.SetStateAction<any[]>>;
  insetsBottom: number;
  minimized: boolean;
  setMinimized: (next: boolean) => void;
  onClose: () => void;
  onDelete: () => void;
};

export const MeasurementEditSheet: React.FC<Props> = ({
  visible,
  selectedMeasurementGroupId,
  measurementFeatures,
  setMeasurementFeatures,
  insetsBottom,
  minimized,
  setMinimized,
  onClose,
  onDelete,
}) => {
  const sampleFeature = useMemo(() => {
    if (!selectedMeasurementGroupId) return null;
    return (
      (measurementFeatures || []).find(
        (f: any) =>
          f?.properties?.measurementGroupId === selectedMeasurementGroupId &&
          !f?.properties?.isTemporary &&
          !f?.properties?.isLabelOnly
      ) || null
    );
  }, [measurementFeatures, selectedMeasurementGroupId]);

  const currentColor = useMemo(() => {
    const mc = sampleFeature?.properties?.measureColor;
    if (typeof mc === "string" && mc.startsWith("#") && /^#[0-9A-Fa-f]{6}$/i.test(mc)) return mc;
    const t = sampleFeature?.properties?.measurementType;
    return t === "area" ? "#FBBF24" : "#3B82F6";
  }, [sampleFeature]);

  const applyColor = useCallback(
    (hex: string) => {
      if (!selectedMeasurementGroupId) return;
      const gid = selectedMeasurementGroupId;
      setMeasurementFeatures((prev) =>
        (prev || []).map((f: any) => {
          if (f?.properties?.measurementGroupId !== gid) return f;
          return {
            ...f,
            properties: { ...f.properties, measureColor: hex },
          };
        })
      );
    },
    [selectedMeasurementGroupId, setMeasurementFeatures]
  );

  if (!visible || !selectedMeasurementGroupId) return null;

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["12%", "55%", "88%"]}
      index={minimized ? 0 : 1}
      backdropPressBehavior="close"
      backgroundStyle={{
        backgroundColor: "#1e293b",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 4,
        borderTopColor: "#10b981",
      }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
    >
      <View style={{ flex: 1, paddingBottom: insetsBottom }}>
        <View style={styles.editPanelHeader} pointerEvents="auto">
          <Text style={styles.editPanelTitle}>Ölçüm özellikleri</Text>
          <View style={styles.editPanelHeaderButtons}>
            <TouchableOpacity onPress={() => setMinimized(!minimized)} style={styles.editPanelMinimizeButton}>
              <Ionicons name={minimized ? "chevron-up" : "chevron-down"} size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.editPanelCloseButton}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {!minimized && (
          <BottomSheetScrollView
            style={styles.editPanelContent}
            contentContainerStyle={[styles.editPanelContentContainer, { paddingBottom: Math.max(insetsBottom, 0) + 100 }]}
            scrollEventThrottle={16}
          >
            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Renk (anında uygulanır)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                {PALETTE.map((hex) => (
                  <TouchableOpacity
                    key={hex}
                    onPress={() => applyColor(hex)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: hex,
                      borderWidth: currentColor.toLowerCase() === hex.toLowerCase() ? 3 : 1,
                      borderColor: currentColor.toLowerCase() === hex.toLowerCase() ? "#fff" : "#334155",
                    }}
                    accessibilityLabel={`Renk ${hex}`}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={styles.deleteButtonText}>Ölçümü sil</Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        )}
      </View>
    </AppBottomSheetModal>
  );
};
