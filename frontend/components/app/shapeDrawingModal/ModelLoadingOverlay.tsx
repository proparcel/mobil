import React from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";

type Props = {
  visible: boolean;
  text: string;
  progress: number | null;
};

export const ModelLoadingOverlay: React.FC<Props> = ({ visible, text, progress }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <View
          style={{
            width: "92%",
            maxWidth: 420,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: "rgba(148, 163, 184, 0.25)",
          }}
        >
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 12 }}>
            {text}
          </Text>
          {typeof progress === "number" && (
            <Text style={{ color: "#cbd5e1", fontSize: 12, marginTop: 6, textAlign: "center" }}>
              İndirme: {progress}%
            </Text>
          )}
          <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 10, textAlign: "center" }}>
            İlk indirme uzun sürebilir. İndirme bitince model `file://` cache’ten kullanılacak.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

