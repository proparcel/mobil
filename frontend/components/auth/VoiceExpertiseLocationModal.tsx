import React from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VoiceSearchListeningAnimation from "../app/VoiceSearchListeningAnimation";
import type { RegistrationExpertiseValue } from "./RegistrationExpertiseStep";
import { useVoiceExpertiseLocationWizard } from "../../src/hooks/useVoiceExpertiseLocationWizard";
import type { RegistrationCompanyItem } from "../../src/types/auth";
import type {
  VoiceRegistrationCorporateType,
  VoiceRegistrationMemberType,
} from "../../src/types/voiceRegistration";

const WIZARD_ANIM_SIZE = 140;

export type VoiceExpertiseLocationModalProps = {
  visible: boolean;
  mode: "quarters" | "cities";
  memberType: VoiceRegistrationMemberType;
  corporateType: VoiceRegistrationCorporateType | null;
  selectedCompany: RegistrationCompanyItem | null;
  currentValue: RegistrationExpertiseValue;
  onApply: (next: RegistrationExpertiseValue) => void;
  onClose: () => void;
};

export default function VoiceExpertiseLocationModal(props: VoiceExpertiseLocationModalProps) {
  const {
    visible,
    mode,
    memberType,
    corporateType,
    selectedCompany,
    currentValue,
    onApply,
    onClose,
  } = props;
  const insets = useSafeAreaInsets();

  const context = React.useMemo(
    () => ({
      memberType,
      corporateType,
      selectedCompany,
      consultantCorporateType:
        selectedCompany?.corporate_type &&
        ["emlak", "spk", "lihkab"].includes(String(selectedCompany.corporate_type))
          ? (selectedCompany.corporate_type as VoiceRegistrationCorporateType)
          : null,
    }),
    [memberType, corporateType, selectedCompany],
  );

  const wizard = useVoiceExpertiseLocationWizard({
    visible,
    mode,
    context,
    currentValue,
    onApply,
    onClose,
  });

  const {
    prompt,
    wizardState,
    pendingReview,
    voiceRecorder,
    isFull,
    progressStep,
    handleConfirm,
    handleRetry,
    handleCancel,
  } = wizard;

  const isProcessing = wizardState === "processing";
  const isListening = wizardState === "listening" || voiceRecorder.isRecording;
  const isSuccessReview = pendingReview?.status === "success";
  const isErrorReview = pendingReview?.status === "error";
  const isReviewing = isSuccessReview || isErrorReview;
  const animMode = isProcessing ? "processing" : isListening ? "listening" : "idle";

  const hintText = (() => {
    if (isFull) return "En fazla 5 bölge seçebilirsiniz.";
    if (isProcessing) return "İşleniyor…";
    if (isReviewing) return null;
    if (isListening) return "Dinliyorum…";
    return "Cevabınızı söyleyin ve Tamam'a basın.";
  })();

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheet}>
          <Text style={styles.progress}>{progressStep}/5</Text>
          <Text style={styles.prompt}>{prompt}</Text>

          {!isReviewing && !isFull ? (
            <View style={styles.animWrap}>
              <VoiceSearchListeningAnimation
                mode={animMode}
                audioLevel={voiceRecorder.isRecording ? voiceRecorder.audioLevel : 0}
                size={WIZARD_ANIM_SIZE}
                mapOrbBackground
                compactLabel
              />
            </View>
          ) : null}

          {hintText ? <Text style={styles.hint}>{hintText}</Text> : null}

          {isSuccessReview ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Algılanan sonuç</Text>
              <Text style={styles.resultText}>{pendingReview.summary}</Text>
            </View>
          ) : null}

          {isErrorReview ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{pendingReview.message}</Text>
            </View>
          ) : null}

          {voiceRecorder.permissionHint && !isReviewing ? (
            <Text style={styles.permissionHint}>{voiceRecorder.permissionHint}</Text>
          ) : null}

          <View style={styles.actions}>
            {isFull ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleCancel}>
                <Text style={styles.primaryBtnText}>Kapat</Text>
              </TouchableOpacity>
            ) : isSuccessReview ? (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm}>
                  <Text style={styles.primaryBtnText}>Tamam</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleRetry}>
                  <Text style={styles.secondaryBtnText}>Tekrar Dene</Text>
                </TouchableOpacity>
              </>
            ) : isErrorReview ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleRetry}>
                <Text style={styles.primaryBtnText}>Tekrar Dene</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, isProcessing && styles.btnDisabled]}
                onPress={handleConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Tamam</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.linkBtn} onPress={handleCancel}>
              <Text style={styles.linkBtnText}>Atla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8, 17, 31, 0.72)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.35)",
  },
  progress: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  prompt: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    marginBottom: 8,
  },
  animWrap: {
    alignItems: "center",
    marginVertical: 8,
  },
  hint: {
    color: "#93c5fd",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  resultCard: {
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(37, 99, 235, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.45)",
  },
  resultLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  resultText: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  errorCard: {
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(127, 29, 29, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.45)",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
  },
  permissionHint: {
    color: "#fbbf24",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  actions: {
    marginTop: 16,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
  },
  secondaryBtnText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "600",
  },
  linkBtn: {
    paddingVertical: 8,
    alignItems: "center",
  },
  linkBtnText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  btnDisabled: {
    opacity: 0.7,
  },
});
