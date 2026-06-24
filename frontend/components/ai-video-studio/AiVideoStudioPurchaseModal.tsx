/**
 * AI Video Studio — TL baz paket + ek kare Tepe Kredi onay modalı.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { AiCreditPurchaseModalLayout } from "../ai-shared/AiCreditPurchaseModalLayout";
import { creditService } from "../../services/creditService";
import { getProductPricing, purchaseProductLicense } from "../../services/productLicenseService";
import {
  formatStudioQuoteSummary,
  type AiVideoStudioQuote,
} from "../../services/aiVideoStudioService";
import { useRouter } from "../../src/hooks/useNavigation";

type Props = {
  visible: boolean;
  onClose: () => void;
  quote: AiVideoStudioQuote | null;
  jobTitle?: string;
  jobId?: string | null;
  initialBalance?: number | null;
  onBalanceChange?: (balance: number | null) => void;
  onPurchaseSuccess?: () => void | Promise<void | boolean>;
};

const AI_VIDEO_ACTION = "ai_video";

export function AiVideoStudioPurchaseModal({
  visible,
  onClose,
  quote,
  jobTitle = "AI Video",
  jobId,
  initialBalance = null,
  onBalanceChange,
  onPurchaseSuccess,
}: Props) {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(initialBalance);
  const [priceTry, setPriceTry] = useState<number | null>(null);
  const [baseIsTryPriced, setBaseIsTryPriced] = useState(true);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const extraCredits = useMemo(() => {
    const q = quote as (AiVideoStudioQuote & { extra_total_credits?: number }) | null;
    if (q?.extra_total_credits != null) return q.extra_total_credits;
    const base = q?.base_credits ?? 0;
    const total = q?.total ?? 0;
    return Math.max(0, total - base);
  }, [quote]);

  const requiredCredits = baseIsTryPriced ? (extraCredits > 0 ? extraCredits : null) : (quote?.total ?? null);

  const productDescription = useMemo(() => {
    const summary = formatStudioQuoteSummary(quote);
    const title = jobTitle.trim() || "AI Video";
    const jobLine = jobId ? `İş: ${jobId}\n\n` : "";
    if (!summary) return `${jobLine}${title}`;
    return `${jobLine}${title}\n\n${summary}`;
  }, [jobId, jobTitle, quote]);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSuccess(false);
    setBalance(initialBalance ?? null);
    void loadPricing();
  }, [visible, initialBalance, quote?.total]);

  const loadPricing = async () => {
    setLoading(true);
    try {
      const row = await getProductPricing(AI_VIDEO_ACTION);
      const tryMode = Boolean(row?.is_try_priced);
      setBaseIsTryPriced(tryMode);
      setPriceTry(typeof row?.price_try === "number" ? row.price_try : null);

      const res = await creditService.getBalance();
      if (res.success && res.data != null) {
        const next = typeof res.data.balance === "number" ? res.data.balance : null;
        setBalance(next);
        onBalanceChange?.(next);
      }
    } catch (e) {
      console.error("[AiVideoStudioPurchaseModal] pricing:", e);
      setError("Fiyat bilgisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!baseIsTryPriced && requiredCredits == null) {
      Alert.alert("Kredi", "Maliyet bilgisi alınamadı.");
      return;
    }
    if (!baseIsTryPriced && (balance === null || (requiredCredits != null && balance < requiredCredits))) {
      Alert.alert(
        "Yetersiz Kredi",
        `Bu video için ${requiredCredits} Tepe Kredi gereklidir. Mevcut bakiyeniz: ${balance ?? 0}.`,
        [
          { text: "İptal", style: "cancel" },
          { text: "Paketler", onPress: () => router.push("pricing") },
        ],
      );
      return;
    }
    if (baseIsTryPriced && extraCredits > 0 && (balance === null || balance < extraCredits)) {
      Alert.alert(
        "Yetersiz Kredi",
        `Ek kareler için ${extraCredits} Tepe Kredi gereklidir. Mevcut bakiyeniz: ${balance ?? 0}.`,
      );
      return;
    }

    setPurchasing(true);
    setError(null);
    setSuccess(false);

    try {
      if (baseIsTryPriced) {
        const ref = jobId ? `studio:${jobId}:base` : `ai_video:${Date.now()}`;
        const iapResult = await purchaseProductLicense({
          actionType: AI_VIDEO_ACTION,
          referenceId: ref,
          description: JSON.stringify({ product: "AI Video Studio", job_id: jobId, title: jobTitle }),
        });
        if (!iapResult.success) {
          setError(iapResult.error || iapResult.message || "Ödeme başarısız.");
          return;
        }
      }

      const result = await onPurchaseSuccess?.();
      if (result === false) {
        setError("Video üretimi başlatılamadı.");
        return;
      }
      setSuccess(true);
      await loadPricing();
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
      onClose={onClose}
      headerTitle="AI Video Satın Al"
      productName="AI Video üretim hakkı"
      productDescription={productDescription}
      pricingMode={baseIsTryPriced ? "try" : "credit"}
      priceTry={priceTry}
      requiredCredits={requiredCredits}
      balance={balance}
      loading={loading}
      purchasing={purchasing}
      error={error}
      success={success}
      successMessage="Video üretimi başlatıldı!"
      purchaseButtonLabel={baseIsTryPriced ? "Öde ve Video Oluştur" : "Video Oluştur"}
      purchaseButtonIcon="film"
      helpText={
        baseIsTryPriced
          ? "Baz paket mağaza üzerinden TL ile alınır. Ek kareler teslimat sonrası Tepe Kredi ile düşülür."
          : "Kredi, video başarıyla hazır olunca düşülür. Hazır olunca bildirim alacaksınız."
      }
      purchaseDisabled={requiredCredits == null && !baseIsTryPriced}
      onPurchase={() => void handlePurchase()}
    />
  );
}
