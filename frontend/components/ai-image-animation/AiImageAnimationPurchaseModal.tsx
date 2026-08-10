/**

 * AI Resim Canlandırma lisansı — action_type `ai_img` (editör içi ilk canlandırma).

 */



import React, { useEffect, useState } from "react";

import { Alert } from "react-native";

import { AiCreditPurchaseModalLayout } from "../ai-shared/AiCreditPurchaseModalLayout";

import { creditService } from "../../services/creditService";

import { DEFAULT_IMAGE_ANIMATION_TITLE, IMAGE_ANIMATION_PACKAGE_UNITS } from "../../services/imageAnimationService";

const AI_IMG_ACTION = "ai_img";

const FALLBACK_CREDITS = 1;



type Props = {
  visible: boolean;
  onClose: () => void;
  referenceId: string;
  displayName: string;
  onPurchaseSuccess?: () => void;
};

export function AiImageAnimationPurchaseModal({
  visible,
  onClose,
  referenceId,
  displayName,
  onPurchaseSuccess,
}: Props) {

  const [balance, setBalance] = useState<number | null>(null);

  const [requiredCredits, setRequiredCredits] = useState<number>(FALLBACK_CREDITS);

  const [loading, setLoading] = useState(false);

  const [purchasing, setPurchasing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);



  useEffect(() => {

    if (!visible) return;

    setError(null);

    setSuccess(false);

    void loadBalance();

    void loadCreditCost();

  }, [visible]);



  const loadCreditCost = async () => {

    try {

      const cost = await creditService.getCreditCostForAction(AI_IMG_ACTION);

      if (cost != null && cost > 0) setRequiredCredits(cost);

    } catch (e) {

      console.warn("[AiImageAnimationPurchaseModal] credit cost:", e);

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

      console.error("[AiImageAnimationPurchaseModal] balance:", e);

      setError("Kredi bakiyesi yüklenemedi. Lütfen tekrar deneyin.");

      setBalance(null);

    } finally {

      setLoading(false);

    }

  };



  const handlePurchase = async () => {

    if (!referenceId.trim()) {

      Alert.alert("İşlem", "Referans bilgisi eksik.");

      return;

    }

    if (balance === null || balance < requiredCredits) {

      Alert.alert(

        "Yetersiz Kredi",

        `AI Resim Canlandırma lisansı için ${requiredCredits} Tepe Kredi gereklidir. Mevcut bakiyeniz: ${balance ?? 0}.`,

      );

      return;

    }



    setPurchasing(true);

    setError(null);

    setSuccess(false);



    try {

      const res = await creditService.useCredit(
        AI_IMG_ACTION,
        JSON.stringify({
          product: "AI Resim Canlandırma",
          display_name: displayName.trim() || DEFAULT_IMAGE_ANIMATION_TITLE,
          source: "mobile_image_animation_purchase",
        }),
        referenceId,
      );



      if (res.success) {

        setSuccess(true);

        await loadBalance();

        setTimeout(() => {

          onPurchaseSuccess?.();

          onClose();

        }, 900);

      } else {

        setError(res.error || res.message || "Satın alma işlemi başarısız oldu.");

      }

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

      headerTitle="AI Resim Canlandırma Satın Al"

      productName={`${IMAGE_ANIMATION_PACKAGE_UNITS} resim canlandırma hakkı`}

      productDescription={displayName.trim() || DEFAULT_IMAGE_ANIMATION_TITLE}

      requiredCredits={requiredCredits}

      balance={balance}

      loading={loading}

      purchasing={purchasing}

      error={error}

      success={success}

      successMessage="Lisans tanımlandı!"

      purchaseButtonLabel="Satın Al"
      purchaseButtonIcon="cart"
      helpText={`${requiredCredits} Tepe Kredi karşılığında ${IMAGE_ANIMATION_PACKAGE_UNITS} resim canlandırma hakkı tanımlanır. Onayladıktan sonra editöre yönlendirilirsiniz.`}

      onPurchase={() => void handlePurchase()}

    />

  );

}

