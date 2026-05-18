import { useCallback } from "react";
import { Alert } from "react-native";
import type { MeasurementFeature } from "@/src/utils/measurementManager";
import { getMeasurementName } from "./naming";

export function useConfirmDeleteMeasurement(
  setMeasurementFeatures: React.Dispatch<React.SetStateAction<MeasurementFeature[]>>,
  /** Grup silindikten sonra harita seçimini kaldır */
  onMeasurementGroupDeleted?: (groupId: string) => void
) {
  return useCallback(
    (feature: MeasurementFeature, index: number) => {
      Alert.alert("Ölçümü Sil", `${getMeasurementName(feature, index)} silinsin mi?`, [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            const groupId = (feature as any)?.properties?.measurementGroupId;
            if (groupId) {
              const gid = String(groupId);
              setMeasurementFeatures((prev) => prev.filter((f) => (f as any)?.properties?.measurementGroupId !== gid));
              onMeasurementGroupDeleted?.(gid);
              return;
            }
            const label = feature.properties.label;
            setMeasurementFeatures((prev) =>
              prev.filter((f) => !(f.properties.label === label && f.properties.measurementType === feature.properties.measurementType))
            );
          },
        },
      ]);
    },
    [setMeasurementFeatures, onMeasurementGroupDeleted]
  );
}

