import React, { useMemo } from "react";
import { Platform, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppBottomSheetModal from "../../../components/app/AppBottomSheetModal";
import { sheetModalBottomInset, sheetScrollBottomPadding } from "../../../src/utils/sheetSafeArea";

type Props = {
  visible: boolean;
  onContinue: () => void;
  onCancel: () => void;
};

const SHEET_HEIGHT = 280;
const SHEET_LOWER_OFFSET = 40;

export function VrPermissionSheet({ visible, onContinue, onCancel }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();

  const bottomInset = useMemo(
    () => Math.max(0, sheetModalBottomInset(insets?.bottom || 0) - SHEET_LOWER_OFFSET),
    [insets?.bottom],
  );

  const snapPoints = useMemo(
    () => [SHEET_HEIGHT + sheetScrollBottomPadding(insets?.bottom || 0, 20)],
    [insets?.bottom],
  );

  const modalProps = useMemo(
    () => ({
      bottomInset,
      ...(Platform.OS === "ios" ? { containerStyle: { marginBottom: -SHEET_LOWER_OFFSET } } : null),
    }),
    [bottomInset],
  );

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onCancel}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropPressBehavior="close"
      modalProps={modalProps}
    >
      <View style={styles.content}>
        <Text style={styles.title}>VR Parsel Görüntüleme</Text>
        <Text style={styles.body}>
          VR Parsel Görüntüleme için kamera ve konum izni gerekiyor.
        </Text>
        <Text style={styles.bodySecondary}>
          Konum yalnızca harita referansı doğrulaması içindir; hareket takibi AR kamera ile yapılır.
          Üç harita + üç AR noktası ile kalibrasyon yapılır. Görüntüler izniniz olmadan kaydedilmez.
        </Text>
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelText}>Vazgeç</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.continueButton]} onPress={onContinue}>
            <Text style={styles.continueText}>Devam Et</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 22,
    marginBottom: 8,
  },
  bodySecondary: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
  },
  continueButton: {
    backgroundColor: "#3b82f6",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
  },
  continueText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
});
