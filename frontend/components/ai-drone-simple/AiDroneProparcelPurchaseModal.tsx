/**
 * ProParcel AI Drone — sizin yerinize üretim talebi satın alma (TL + IAP veya Tepe Kredi).
 * Kredi kesimi sunucu tarafında createRequest ile yapılır; istemci useCredit çağırmaz.
 */

import React, { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { AiCreditPurchaseModalLayout } from "../ai-shared/AiCreditPurchaseModalLayout";
import { creditService } from "../../services/creditService";
import { getProductPricing, purchaseProductLicense } from "../../services/productLicenseService";

const PROPARCEL_DRONE_ACTION = "ai_drone_proparcel";

function isPurchaseUserCancelled(message: string | null | undefined): boolean {
  const text = String(message || "").trim().toLowerCase();
  return text.includes("iptal") || text.includes("cancel");
}

export type AiDroneProparcelPurchaseResult = {
  paymentReference?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  referenceId: string;
  parcelSummary?: string;
  extraDescription?: string;
  onPurchaseSuccess?: (result: AiDroneProparcelPurchaseResult) => void | Promise<boolean>;
};

export function AiDroneProparcelPurchaseModal({
  visible,
  onClose,
  referenceId,
  parcelSummary,
  extraDescription,
  onPurchaseSuccess,
}: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [requiredCredits, setRequiredCredits] = useState<number | null>(null);
  const [priceTry, setPriceTry] = useState<number | null>(null);
  const [isTryPriced, setIsTryPriced] = useState(true);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const purchaseCompletedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      purchaseCompletedRef.current = false;
      void loadPricing();
      setError(null);
      setSuccess(false);
    }
  }, [visible]);

  const loadPricing = async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getProductPricing(PROPARCEL_DRONE_ACTION);
      if (!row) {
        setPriceTry(null);
        setRequiredCredits(null);
        setBalance(null);
        setError("Fiyat bilgisi yüklenemedi.");
        return;
      }
      const tryMode = Boolean(row.is_try_priced);
      setIsTryPriced(tryMode);
      if (tryMode) {
        setPriceTry(typeof row.price_try === "number" && row.price_try > 0 ? row.price_try : null);
        setRequiredCredits(null);
        setBalance(null);
        if (typeof row.price_try !== "number" || row.price_try <= 0) {
          setError("Paket fiyatı tanımlı değil.");
        }
      } else {
        const cost =
          typeof row.credits === "number" && row.credits > 0
            ? row.credits
            : await creditService.getCreditCostForAction(PROPARCEL_DRONE_ACTION);
        setPriceTry(null);
        setRequiredCredits(cost != null && cost > 0 ? cost : null);
        if (cost == null || cost <= 0) {
          setError("Kredi maliyeti tanımlı değil.");
        }
        const res = await creditService.getBalance();
        setBalance(res.success && res.data != null ? res.data.balance : null);
      }
    } catch (e) {
      console.warn("[AiDroneProparcelPurchaseModal] pricing:", e);
      setPriceTry(null);
      setRequiredCredits(null);
      setBalance(null);
      setError("Fiyat bilgisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const buildDescription = () => {
    const desc: Record<string, unknown> = {
      service: PROPARCEL_DRONE_ACTION,
      source: "mobile_ai_drone_proparcel",
    };
    if (parcelSummary?.trim()) desc.summary = parcelSummary.trim();
    if (extraDescription?.trim()) desc.detail = extraDescription.trim();
    return JSON.stringify(desc);
  };

  const handlePurchase = async () => {
    if (!referenceId.trim()) {
      Alert.alert("Parsel", "Talep için parsel bilgisi eksik. Lütfen parseli yeniden sorgulayın.");
      return;
    }

    if (isTryPriced) {
      if (priceTry == null || priceTry <= 0) {
        Alert.alert("Fiyat bilgisi", "Paket fiyatı yüklenemedi. Lütfen tekrar deneyin.");
        return;
      }
    } else if (requiredCredits == null || requiredCredits <= 0) {
      Alert.alert("Fiyat bilgisi", "Kredi maliyeti yüklenemedi. Lütfen tekrar deneyin.");
      return;
    } else if (balance === null || balance < requiredCredits) {
      Alert.alert(
        "Yetersiz Kredi",
        `Üretim talebi için ${requiredCredits} Tepe Kredi gereklidir. Mevcut bakiyeniz: ${balance ?? 0}.`,
      );
      return;
    }

    setPurchasing(true);
    setError(null);
    setSuccess(false);

    try {
      let purchaseResult: AiDroneProparcelPurchaseResult = {};

      if (isTryPriced) {
        const result = await purchaseProductLicense({
          actionType: PROPARCEL_DRONE_ACTION,
          referenceId,
          description: buildDescription(),
        });
        if (!result.success) {
          const errMsg = result.error || result.message || "Satın alma başarısız.";
          setError(errMsg);
          if (isPurchaseUserCancelled(errMsg)) {
            onClose();
          }
          return;
        }
        purchaseResult = {
          paymentReference: result.transaction_id || `iap:${Date.now()}`,
        };
      }

      const ok = await onPurchaseSuccess?.(purchaseResult);
      if (ok === false) {
        setError("Talep oluşturulamadı.");
        return;
      }

      purchaseCompletedRef.current = true;
      setSuccess(true);
      if (!isTryPriced) {
        await loadPricing();
      }
      setTimeout(() => {
        onClose();
        purchaseCompletedRef.current = false;
      }, 900);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Satın alma işlemi sırasında bir hata oluştu.");
    } finally {
      setPurchasing(false);
    }
  };

  const summaryParts = [parcelSummary?.trim(), extraDescription?.trim()].filter(Boolean);
  const productDescription = summaryParts.length ? summaryParts.join("\n\n") : referenceId;

  return (
    <AiCreditPurchaseModalLayout
      visible={visible}
      onClose={onClose}
      headerTitle="ProParcel Üretim Talebi"
      productName="Sizin yerinize ultra gerçekçi drone video üretimi"
      productDescription={productDescription}
      pricingMode={isTryPriced ? "try" : "credit"}
      priceTry={priceTry}
      requiredCredits={isTryPriced ? null : requiredCredits}
      balance={balance}
      loading={loading}
      purchasing={purchasing}
      error={error}
      success={success}
      successMessage="Talep alındı!"
      purchaseButtonIcon={isTryPriced ? "card" : "cart"}
      helpText="Uzman editör ekibimiz videonuzu üretip hazır olduğunda size bildirim ile iletecektir."
      purchaseDisabled={loading || (isTryPriced ? priceTry == null : requiredCredits == null)}
      onPurchase={() => void handlePurchase()}
    />
  );
}
