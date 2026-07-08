/**
 * AI Video — ai_video lisans IAP modalı.
 */

import React, { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { AiCreditPurchaseModalLayout } from "../ai-shared/AiCreditPurchaseModalLayout";
import { creditService } from "../../services/creditService";
import { getProductPricing, purchaseProductLicense } from "../../services/productLicenseService";

const AI_VIDEO_ACTION = "ai_video";

function isPurchaseUserCancelled(message: string | null | undefined): boolean {
  const text = String(message || "").trim().toLowerCase();
  return text.includes("iptal") || text.includes("cancel");
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  projectTitle?: string;
  jobId?: string | null;
  licenseRef?: string;
  onPurchaseSuccess?: () => void | Promise<void | boolean>;
};

export function AiVideoNewPurchaseModal({
  visible,
  onClose,
  onDismiss,
  projectTitle = "AI Video",
  jobId,
  licenseRef,
  onPurchaseSuccess,
}: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [priceTry, setPriceTry] = useState<number | null>(null);
  const [isTryPriced, setIsTryPriced] = useState(true);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const purchaseCompletedRef = useRef(false);

  const productDescription = [
    jobId ? `İş: ${jobId}` : null,
    projectTitle.trim() || "AI Video",
    "Tek proje için AI Video üretim hakkı.",
  ]
    .filter(Boolean)
    .join("\n\n");

  useEffect(() => {
    if (visible) {
      purchaseCompletedRef.current = false;
      void loadPricing();
      setError(null);
      setSuccess(false);
    }
  }, [visible]);

  const handleModalClose = () => {
    onClose();
    if (!purchaseCompletedRef.current) {
      onDismiss?.();
    }
  };

  const loadPricing = async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getProductPricing(AI_VIDEO_ACTION);
      if (!row) {
        setPriceTry(null);
        setBalance(null);
        setError("Fiyat bilgisi yüklenemedi.");
        return;
      }
      setIsTryPriced(Boolean(row.is_try_priced));
      setPriceTry(typeof row.price_try === "number" && row.price_try > 0 ? row.price_try : null);
      const res = await creditService.getBalance();
      if (res.success && res.data != null) {
        setBalance(typeof res.data.balance === "number" ? res.data.balance : null);
      }
    } catch {
      setError("Fiyat bilgisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (isTryPriced && !priceTry) {
      Alert.alert("Ödeme", "Fiyat bilgisi yüklenemedi.");
      return;
    }

    setPurchasing(true);
    setError(null);
    setSuccess(false);

    try {
      if (isTryPriced) {
        const ref =
          String(licenseRef || "").trim() ||
          (jobId ? `ai_video:${jobId}` : `ai_video:${Date.now()}`);
        const iapResult = await purchaseProductLicense({
          actionType: AI_VIDEO_ACTION,
          referenceId: ref,
          description: JSON.stringify({
            product: "AI Video",
            job_id: jobId,
            title: projectTitle,
          }),
        });
        if (!iapResult.success) {
          const msg = iapResult.error || iapResult.message || "Ödeme başarısız.";
          if (isPurchaseUserCancelled(msg)) {
            handleModalClose();
            return;
          }
          setError(msg);
          return;
        }
      }

      const result = await onPurchaseSuccess?.();
      if (result === false) {
        setError("Video üretimi başlatılamadı.");
        return;
      }
      purchaseCompletedRef.current = true;
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Video üretimi başlatılamadı.");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <AiCreditPurchaseModalLayout
      visible={visible}
      onClose={handleModalClose}
      headerTitle="AI Video Satın Al"
      productName="AI Video üretim hakkı"
      productDescription={productDescription}
      pricingMode={isTryPriced ? "try" : "credit"}
      priceTry={priceTry}
      requiredCredits={null}
      balance={balance}
      loading={loading}
      purchasing={purchasing}
      error={error}
      success={success}
      successMessage="Lisans alındı, video üretimi devam ediyor!"
      purchaseButtonLabel={isTryPriced ? "Öde ve Devam Et" : "Devam Et"}
      purchaseButtonIcon="film"
      helpText="AI Video lisansı ile yatay video üretimini başlatabilirsiniz."
      purchaseDisabled={isTryPriced && !priceTry}
      onPurchase={() => void handlePurchase()}
    />
  );
}
