/**
 * AI ürün satın alma modalları — DroneVideoPurchaseModal ile aynı görsel dil.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export type AiCreditPurchaseModalLayoutProps = {
  visible: boolean;
  onClose: () => void;
  headerTitle: string;
  productName: string;
  productDescription?: string;
  pricingMode?: "credit" | "try";
  priceTry?: number | null;
  requiredCredits: number | null;
  balance: number | null;
  loading?: boolean;
  purchasing?: boolean;
  error?: string | null;
  success?: boolean;
  successMessage?: string;
  purchaseButtonLabel?: string;
  purchaseButtonIcon?: keyof typeof Ionicons.glyphMap;
  afterBalanceLabel?: string;
  helpText?: string;
  purchaseDisabled?: boolean;
  onPurchase: () => void;
};

export function AiCreditPurchaseModalLayout({
  visible,
  onClose,
  headerTitle,
  productName,
  productDescription,
  pricingMode = "credit",
  priceTry = null,
  requiredCredits,
  balance,
  loading = false,
  purchasing = false,
  error = null,
  success = false,
  successMessage = "İşlem tamamlandı!",
  purchaseButtonLabel = "Satın Al",
  purchaseButtonIcon = "cart",
  afterBalanceLabel = "Satın Alımdan Sonra:",
  helpText,
  purchaseDisabled = false,
  onPurchase,
}: AiCreditPurchaseModalLayoutProps) {
  const isTryMode = pricingMode === "try";
  const afterBalance =
    !isTryMode && balance !== null && requiredCredits != null ? balance - requiredCredits : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.modelInfo}>
              <Text style={styles.modelName}>{productName}</Text>
              {productDescription ? (
                <Text style={styles.modelCategory} numberOfLines={6}>
                  {productDescription}
                </Text>
              ) : null}
            </View>

            <View style={styles.creditsInfo}>
              {isTryMode ? (
                <>
                  <View style={styles.creditsRow}>
                    <Text style={styles.creditsLabel}>Paket fiyatı:</Text>
                    <Text style={styles.creditsValue}>
                      {priceTry != null ? `${Math.round(priceTry)} ₺` : "—"}
                    </Text>
                  </View>
                  {requiredCredits != null && requiredCredits > 0 ? (
                    <View style={styles.creditsRow}>
                      <Text style={styles.creditsLabel}>Ek kare (Tepe Kredi):</Text>
                      <Text style={styles.creditsValue}>{requiredCredits}</Text>
                    </View>
                  ) : null}
                  {requiredCredits != null && requiredCredits > 0 ? (
                    <View style={styles.creditsRow}>
                      <Text style={styles.creditsLabel}>Mevcut bakiye:</Text>
                      {loading ? (
                        <ActivityIndicator size="small" color="#3b82f6" />
                      ) : (
                        <Text style={styles.creditsValue}>{balance !== null ? `${balance}` : "-"}</Text>
                      )}
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.creditsRow}>
                    <Text style={styles.creditsLabel}>Gerekli Tepe Kredi:</Text>
                    <Text style={styles.creditsValue}>
                      {requiredCredits != null ? requiredCredits : "—"}
                    </Text>
                  </View>
                  <View style={styles.creditsRow}>
                    <Text style={styles.creditsLabel}>Mevcut Bakiyeniz:</Text>
                    {loading ? (
                      <ActivityIndicator size="small" color="#3b82f6" />
                    ) : (
                      <Text style={styles.creditsValue}>{balance !== null ? `${balance}` : "-"}</Text>
                    )}
                  </View>
                  <View style={styles.creditsRow}>
                    <Text style={styles.creditsLabel}>{afterBalanceLabel}</Text>
                    <Text
                      style={[
                        styles.creditsValue,
                        afterBalance !== null && afterBalance < 0 && styles.creditsValueNegative,
                      ]}
                    >
                      {afterBalance !== null ? `${afterBalance}` : "-"}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.purchaseButton,
                  (purchasing || loading || purchaseDisabled) && styles.purchaseButtonDisabled,
                ]}
                onPress={onPurchase}
                disabled={purchasing || loading || purchaseDisabled}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name={purchaseButtonIcon} size={18} color="#fff" />
                    <Text style={styles.purchaseButtonText}>{purchaseButtonLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
            </View>

            {helpText ? (
              <View style={styles.helpContainer}>
                <Text style={styles.helpText}>{helpText}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const aiCreditPurchaseModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "#3b82f6",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  modelInfo: {
    marginBottom: 20,
  },
  modelName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  modelCategory: {
    fontSize: 14,
    color: "#94a3b8",
  },
  creditsInfo: {
    marginBottom: 20,
    gap: 12,
  },
  creditsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  creditsLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  creditsValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  creditsValueNegative: {
    color: "#ef4444",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#7f1d1d33",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#fca5a5",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#14532d33",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    color: "#86efac",
    fontWeight: "600",
  },
  actions: {
    gap: 12,
  },
  purchaseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 8,
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#94a3b8",
    fontSize: 15,
  },
  helpContainer: {
    marginTop: 16,
  },
  helpText: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
});

const styles = aiCreditPurchaseModalStyles;
