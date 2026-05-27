import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Modal } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { fetchCreditBalance, purchaseModel, type PurchaseModelResponse } from "@/src/services/modelPurchaseService";

type PurchaseModelModalProps = {
  visible: boolean;
  onClose: () => void;
  modelId: number;
  modelName: string;
  modelCategory: string;
  credits: number;
  onPurchaseSuccess?: () => void;
};

const categoryLabels: Record<string, { icon: string; label: string }> = {
  house: { icon: "🏠", label: "Ev Modeli" },
  car: { icon: "🚗", label: "Araç Modeli" },
  tree: { icon: "🌳", label: "Ağaç Modeli" },
  grass: { icon: "🌿", label: "Çim Modeli" },
};

export const PurchaseModelModal: React.FC<PurchaseModelModalProps> = ({
  visible,
  onClose,
  modelId,
  modelName,
  modelCategory,
  credits,
  onPurchaseSuccess,
}) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const categoryInfo = categoryLabels[modelCategory] || { icon: "📦", label: modelCategory };

  useEffect(() => {
    if (visible) {
      loadBalance();
      setError(null);
      setSuccess(false);
    }
  }, [visible]);

  const loadBalance = async () => {
    setLoading(true);
    try {
      const data = await fetchCreditBalance();
      setBalance(data.balance);
    } catch (e: any) {
      console.error("[PurchaseModelModal] Balance load error:", e);
      setError("Kredi bakiyesi yüklenemedi. Lütfen tekrar deneyin.");
      setBalance(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (balance === null || balance < credits) {
      Alert.alert(
        credits > 0 ? "Yetersiz Kredi" : "Bakiye yüklenemedi",
        credits > 0
          ? `Bu modeli satın almak için ${credits} Coin gereklidir. Mevcut bakiyeniz: ${balance ?? 0} Coin.`
          : "Kredi bakiyeniz alınamadı. İnternet bağlantınızı kontrol edip tekrar deneyin."
      );
      return;
    }

    setPurchasing(true);
    setError(null);
    setSuccess(false);

    try {
      const result: PurchaseModelResponse = await purchaseModel(modelId);
      
      if (result.success) {
        setSuccess(true);
        // Update balance
        await loadBalance();
        
        // Call success callback after a short delay
        setTimeout(() => {
          onPurchaseSuccess?.();
          onClose();
        }, 1500);
      } else {
        setError(result.error || "Satın alma işlemi başarısız oldu.");
      }
    } catch (e: any) {
      console.error("[PurchaseModelModal] Purchase error:", e);
      const errorMsg = e?.message || "Satın alma işlemi sırasında bir hata oluştu.";
      setError(errorMsg);
    } finally {
      setPurchasing(false);
    }
  };

  const afterBalance = balance !== null ? balance - credits : null;
  const hasEnoughCredits = balance !== null && balance >= credits;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>3D Model Satın Al</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.modelInfo}>
              <Text style={styles.modelName}>{modelName}</Text>
              <Text style={styles.modelCategory}>
                {categoryInfo.icon} {categoryInfo.label}
              </Text>
            </View>

            <View style={styles.creditsInfo}>
              <View style={styles.creditsRow}>
                <Text style={styles.creditsLabel}>Gerekli Kredi:</Text>
                <Text style={styles.creditsValue}>
                  {credits > 0 ? `${credits} Coin` : "Ücretsiz"}
                </Text>
              </View>
              
              <View style={styles.creditsRow}>
                <Text style={styles.creditsLabel}>Mevcut Bakiyeniz:</Text>
                {loading ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Text style={styles.creditsValue}>
                    {balance !== null ? `${balance} Coin` : "-"}
                  </Text>
                )}
              </View>
              
              <View style={styles.creditsRow}>
                <Text style={styles.creditsLabel}>Satın Alımdan Sonra:</Text>
                <Text style={[styles.creditsValue, afterBalance !== null && afterBalance < 0 && styles.creditsValueNegative]}>
                  {afterBalance !== null ? `${afterBalance} Coin` : "-"}
                </Text>
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {success && (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.successText}>Model başarıyla satın alındı!</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.purchaseButton, (!hasEnoughCredits || purchasing) && styles.purchaseButtonDisabled]}
                onPress={handlePurchase}
                disabled={!hasEnoughCredits || purchasing}
              >
                {purchasing ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.purchaseButtonText}>İşleniyor...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cart" size={18} color="#fff" />
                    <Text style={styles.purchaseButtonText}>Satın Al</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>
                Yetersiz krediniz varsa kredi paketlerimizi inceleyebilirsiniz.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  creditsValueNegative: {
    color: "#ef4444",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#ef4444",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: "#10b981",
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  purchaseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  purchaseButtonDisabled: {
    opacity: 0.5,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    padding: 14,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#334155",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#94a3b8",
  },
  helpContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  helpText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
});
