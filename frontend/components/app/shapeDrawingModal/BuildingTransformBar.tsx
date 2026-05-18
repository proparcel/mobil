/**
 * Seçili bina extrusion — alt çubuk (legacy); ana akış BuildingUnifiedSheet kullanır.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import { BuildingEditPanel, type BuildingEditPanelProps } from "./BuildingEditPanel";

type Props = BuildingEditPanelProps & {
  visible: boolean;
  bottomInset?: number;
};

export const BuildingTransformBar: React.FC<Props> = ({
  visible,
  bottomInset = 0,
  ...panelProps
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.bar, styles.barZIndex, { paddingBottom: Math.max(bottomInset, 0) + 6 }]}>
      <BuildingEditPanel {...panelProps} />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "column",
    alignItems: "stretch",
    alignSelf: "center",
    maxWidth: 520,
    width: "100%",
    backgroundColor: "#1e293b",
    paddingTop: 4,
    paddingHorizontal: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  barZIndex: { zIndex: 2500, elevation: 25 },
});
