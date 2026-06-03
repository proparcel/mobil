import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { adminColors } from "../../../styles/admin/common";

type Props = {
  visible: boolean;
  title?: string;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
  required?: boolean;
};

export function RejectReasonModal({
  visible,
  title = "Red nedeni",
  onCancel,
  onSubmit,
  required = true,
}: Props) {
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    const trimmed = reason.trim();
    if (required && !trimmed) return;
    onSubmit(trimmed);
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Neden girin..."
            placeholderTextColor={adminColors.textSecondary}
            multiline
            autoFocus
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>Gönder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: adminColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: adminColors.cardBorder,
  },
  title: {
    color: adminColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: adminColors.cardBorder,
    borderRadius: 8,
    padding: 10,
    color: adminColors.textPrimary,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 14,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: adminColors.textSecondary,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: adminColors.danger,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  submitText: {
    color: "#fff",
    fontWeight: "600",
  },
});
