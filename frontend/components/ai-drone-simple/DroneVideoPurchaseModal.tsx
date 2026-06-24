/**
 * Parsel bazlı AI Drone Video lisansı — TL + IAP (is_try_priced) veya Tepe Kredi.
 */

import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { AiCreditPurchaseModalLayout } from "../ai-shared/AiCreditPurchaseModalLayout";
import { creditService } from "../../services/creditService";
import { getProductPricing, purchaseProductLicense } from "../../services/productLicenseService";
import type { DroneParcelQuery } from "../../services/aiDroneSimpleEditorService";

const DRONE_VIDEO_ACTION = "drone_video";

type Props = {
  visible: boolean;
  onClose: () => void;
  referenceId: string;
  parcel?: DroneParcelQuery | null;
  parcelSummary?: string;
  onPurchaseSuccess?: () => void;
};

export function DroneVideoPurchaseModal({
  visible,
  onClose,
  referenceId,
  parcel,
  parcelSummary,
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

  useEffect(() => {
    if (visible) {
      void loadPricing();
      setError(null);
      setSuccess(false);
    }
  }, [visible]);

  const loadPricing = async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getProductPricing(DRONE_VIDEO_ACTION);
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
            : await creditService.getCreditCostForAction(DRONE_VIDEO_ACTION);
        setPriceTry(null);
        setRequiredCredits(cost != null && cost > 0 ? cost : null);
        if (cost == null || cost <= 0) {
          setError("Kredi maliyeti tanımlı değil.");
        }
        const res = await creditService.getBalance();
        setBalance(res.success && res.data != null ? res.data.balance : null);
      }
    } catch (e) {
      console.warn("[DroneVideoPurchaseModal] pricing:", e);
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
      product: "AI Drone Video",
      source: "mobile_drone_simple_editor",
    };
    if (parcel) {
      if (parcel.mahalle) desc.mahalleLabel = parcel.mahalle;
      if (parcel.ada) desc.ada = parcel.ada;
      if (parcel.parsel) desc.parsel = parcel.parsel;
      if (parcel.city) desc.city = parcel.city;
      if (parcel.town) desc.town = parcel.town;
      if (parcel.mahalleTkgmValue != null) {
        desc.mahalleTkgm = String(parcel.mahalleTkgmValue);
        desc.mahalleTkgmValue = parcel.mahalleTkgmValue;
      }
      if (parcel.proparcelValue != null) desc.proparcel_value = parcel.proparcelValue;
    }
    return JSON.stringify(desc);
  };

  const handlePurchase = async () => {
    if (!referenceId.trim()) {
      Alert.alert("Parsel", "Lisans için parsel bilgisi eksik. Lütfen parseli yeniden sorgulayın.");
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
        `AI Drone Video lisansı için ${requiredCredits} Tepe Kredi gereklidir. Mevcut bakiyeniz: ${balance ?? 0}.`,
      );
      return;
    }

    setPurchasing(true);
    setError(null);
    setSuccess(false);

    try {
      if (isTryPriced) {
        const result = await purchaseProductLicense({
          actionType: DRONE_VIDEO_ACTION,
          referenceId,
          description: buildDescription(),
        });
        if (!result.success) {
          setError(result.error || result.message || "Satın alma başarısız.");
          return;
        }
      } else {
        const res = await creditService.useCredit(DRONE_VIDEO_ACTION, buildDescription(), referenceId);
        if (!res.success) {
          setError(res.error || res.message || "Satın alma işlemi başarısız oldu.");
          return;
        }
      }

      setSuccess(true);
      await loadPricing();
      setTimeout(() => {
        onPurchaseSuccess?.();
        onClose();
      }, 900);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Satın alma işlemi sırasında bir hata oluştu.");
    } finally {
      setPurchasing(false);
    }
  };

  const summary = parcelSummary?.trim() || referenceId;

  return (
    <AiCreditPurchaseModalLayout
      visible={visible}
      onClose={onClose}
      headerTitle="AI Drone Video Satın Al"
      productName="Tek kullanımlık video üretim hakkı"
      productDescription={summary}
      pricingMode={isTryPriced ? "try" : "credit"}
      priceTry={priceTry}
      requiredCredits={isTryPriced ? null : requiredCredits}
      balance={balance}
      loading={loading}
      purchasing={purchasing}
      error={error}
      success={success}
      successMessage="Lisans tanımlandı!"
      purchaseButtonIcon={isTryPriced ? "card" : "cart"}
      helpText={
        isTryPriced
          ? "Ödeme App Store veya Google Play üzerinden alınır. Ek üretim denemeleri ayrı Tepe Kredi maliyetine tabidir."
          : "Bu hak seçili parsel için bir kez video üretimi içerir. Ek üretim denemeleri ayrı Tepe Kredi maliyetine tabidir."
      }
      purchaseDisabled={loading || (isTryPriced ? priceTry == null : requiredCredits == null)}
      onPurchase={() => void handlePurchase()}
    />
  );
}
