/**
 * Editör içi tekrar canlandırma — action_type `ia_drone_realimg`.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { AiCreditPurchaseModalLayout } from "../ai-shared/AiCreditPurchaseModalLayout";
import { creditService } from "../../services/creditService";
import { IMAGE_ANIMATION_EXTRA_ACTION } from "../../services/imageAnimationService";

type Props = {
  visible: boolean;
  onClose: () => void;
  displayName: string;
  licenseRef: string;
  selectedCount: number;
  onPurchaseSuccess?: () => void | Promise<void>;
};

export function AiImageAnimationExtraPurchaseModal({
  visible,
  onClose,
  displayName,
  licenseRef,
  selectedCount,
  onPurchaseSuccess,
}: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [unitCost, setUnitCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const safeCount = Math.max(1, selectedCount);
  const requiredCredits = unitCost != null ? unitCost * safeCount : null;

  const productDescription = useMemo(() => {
    const label = displayName.trim() || "AI Resim Canlandırma";
    if (unitCost == null) return `${label}\n\n${safeCount} kare canlandırılacak.`;
    return `${label}\n\n${safeCount} kare × ${unitCost} Tepe Kredi = ${unitCost * safeCount} Tepe Kredi`;
  }, [displayName, safeCount, unitCost]);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSuccess(false);
    void loadBalance();
    void loadCreditCost();
  }, [visible, safeCount]);

  const loadCreditCost = async () => {
    try {
      const cost = await creditService.getCreditCostForAction(IMAGE_ANIMATION_EXTRA_ACTION);
      setUnitCost(cost != null && cost >= 0 ? cost : null);
    } catch (e) {
      console.warn("[AiImageAnimationExtraPurchaseModal] credit cost:", e);
      setUnitCost(null);
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
    } catch (e) {
      console.error("[AiImageAnimationExtraPurchaseModal] balance:", e);
      setError("Kredi bakiyesi yüklenemedi. Lütfen tekrar deneyin.");
      setBalance(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (requiredCredits == null || unitCost == null) {
      Alert.alert("Kredi", "Maliyet bilgisi alınamadı.");
      return;
    }
    if (balance === null || balance < requiredCredits) {
      Alert.alert(
        "Yetersiz Kredi",
        `Bu işlem için ${requiredCredits} Tepe Kredi gereklidir. Mevcut bakiyeniz: ${balance ?? 0}.`,
      );
      return;
    }

    setPurchasing(true);
    setError(null);
    setSuccess(false);

    try {
      const batchRef = `${licenseRef || "ai_img"}:${Date.now()}`;
      for (let i = 0; i < safeCount; i += 1) {
        const res = await creditService.useCredit(
          IMAGE_ANIMATION_EXTRA_ACTION,
          JSON.stringify({
            product: "AI Resim Canlandırma",
            display_name: displayName.trim() || "AI Resim Canlandırma",
            source: "mobile_image_animation_editor",
            batch: batchRef,
            slot_index: i + 1,
            slot_count: safeCount,
          }),
          `${batchRef}:slot:${i + 1}`,
        );
        if (!res.success) {
          setError(res.error || res.message || "Kredi kullanılamadı.");
          return;
        }
      }

      setSuccess(true);
      await loadBalance();
      setTimeout(() => {
        void Promise.resolve(onPurchaseSuccess?.()).finally(() => onClose());
      }, 700);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Satın alma işlemi sırasında bir hata oluştu.");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <AiCreditPurchaseModalLayout
      visible={visible}
      onClose={onClose}
      headerTitle="Canlandırma Satın Al"
      productName="Tekrar resim canlandırma"
      productDescription={productDescription}
      requiredCredits={requiredCredits}
      balance={balance}
      loading={loading}
      purchasing={purchasing}
      error={error}
      success={success}
      successMessage="Kredi düşüldü, canlandırma başlıyor!"
      purchaseButtonLabel="Canlandır"
      purchaseButtonIcon="sparkles"
      helpText="Onayladığınızda Tepe Kredi düşülür ve seçili kareler canlandırılır."
      purchaseDisabled={requiredCredits == null || safeCount < 1}
      onPurchase={() => void handlePurchase()}
    />
  );
}
