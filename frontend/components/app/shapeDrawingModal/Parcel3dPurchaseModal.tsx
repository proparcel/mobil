/**
 * 3D Tasarım (parsel bazlı) satın alma modalı.
 * - Kredi maliyeti PurchasingCredit tablosundan (3d_design) gelir.
 * - Hisseli parsel satın alma modalı ile aynı UX.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { creditService } from "../../../services/creditService";

const FALLBACK_CREDITS = 2;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Örn: mahalle_ada_parsel */
  referenceId?: string;
  /** Sunucu TKGM çözümlemesi için (web satın alma JSON ile aynı alanlar) */
  mahalle?: string;
  ada?: string;
  parsel?: string;
  mahalleTkgmValue?: number;
  proparcelValue?: number;
  onPurchaseSuccess?: () => void;
};

export const Parcel3dPurchaseModal: React.FC<Props> = ({
  visible,
  onClose,
  referenceId,
  mahalle,
  ada,
  parsel,
  mahalleTkgmValue,
  proparcelValue,
  onPurchaseSuccess,
}) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [requiredCredits, setRequiredCredits] = useState<number>(FALLBACK_CREDITS);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      loadBalance();
      loadCreditCost();
      setError(null);
      setSuccess(false);
    }
  }, [visible]);

  const loadCreditCost = async () => {
    try {
      const res = await creditService.getCreditCosts();
      const costs = (res as any).data?.costs ?? (res as any).costs;
      if (costs && typeof costs["3d_design"] === "number" && costs["3d_design"] >= 0) {
        setRequiredCredits(costs["3d_design"]);
      }
    } catch (e) {
      console.warn("[Parcel3dPurchaseModal] Credit cost load error:", e);
    }
  };

  const loadBalance = async () => {
    setLoading(true);
    try {
      const res = await creditService.getBalance();
      if (res.success && res.data != null) {
        setBalance(res.data.balance);
      } else {
        setBalance(null);
      }
    } catch (e: any) {
      console.error("[Parcel3dPurchaseModal] Balance load error:", e);
      setError("Kredi bakiyesi yüklenemedi. Lütfen tekrar deneyin.");
      setBalance(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (balance === null || balance < requiredCredits) {
      Alert.alert(
        "Yetersiz Kredi",
        `Bu parsel için 3D tasarım kaydetmek/paylaşmak için ${requiredCredits} Coin gereklidir. Mevcut bakiyeniz: ${balance ?? 0} Coin.`
      );
      return;
    }

    setPurchasing(true);
    setError(null);
    setSuccess(false);

    try {
      const desc: Record<string, unknown> = { source: "mobile_3d_purchase" };
      const m = String(mahalle ?? "").trim();
      const a = String(ada ?? "").trim();
      const p = String(parsel ?? "").trim();
      if (m) desc.mahalleLabel = m;
      if (a) desc.ada = a;
      if (p) desc.parsel = p;
      if (mahalleTkgmValue != null && Number.isFinite(Number(mahalleTkgmValue))) {
        const mv = Number(mahalleTkgmValue);
        desc.mahalleTkgm = String(mv);
        desc.mahalleTkgmValue = mv;
      }
      if (proparcelValue != null && Number.isFinite(Number(proparcelValue))) {
        desc.proparcel_value = Number(proparcelValue);
      }
      const res = await creditService.useCredit(
        "3d_design",
        JSON.stringify(desc),
        referenceId
      );

      if (res.success) {
        setSuccess(true);
        await loadBalance();
        setTimeout(() => {
          onPurchaseSuccess?.();
          onClose();
        }, 1200);
      } else {
        setError((res as any).error || "Satın alma işlemi başarısız oldu.");
      }
    } catch (e: any) {
      console.error("[Parcel3dPurchaseModal] Purchase error:", e);
      setError(e?.message || "Satın alma işlemi sırasında bir hata oluştu.");
    } finally {
      setPurchasing(false);
    }
  };

  const afterBalance = balance !== null ? balance - requiredCredits : null;
  const hasEnoughCredits = balance !== null && balance >= requiredCredits;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>3D Tasarım Satın Al</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.modelInfo}>
              <Text style={styles.modelName}>Bu parsel için tek seferlik satın alma</Text>
              <Text style={styles.modelCategory}>Kaydet ve Paylaş özelliklerini açar.</Text>
            </View>

            <View style={styles.creditsInfo}>
              <View style={styles.creditsRow}>
                <Text style={styles.creditsLabel}>Gerekli Kredi:</Text>
                <Text style={styles.creditsValue}>{requiredCredits} Coin</Text>
              </View>
              <View style={styles.creditsRow}>
                <Text style={styles.creditsLabel}>Mevcut Bakiyeniz:</Text>
                {loading ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Text style={styles.creditsValue}>{balance !== null ? `${balance} Coin` : "-"}</Text>
                )}
              </View>
              <View style={styles.creditsRow}>
                <Text style={styles.creditsLabel}>Satın Alımdan Sonra:</Text>
                <Text
                  style={[
                    styles.creditsValue,
                    afterBalance !== null && afterBalance < 0 && styles.creditsValueNegative,
                  ]}
                >
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
                <Text style={styles.successText}>Satın alma başarılı!</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.purchaseButton,
                  (!hasEnoughCredits || purchasing) && styles.purchaseButtonDisabled,
                ]}
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

