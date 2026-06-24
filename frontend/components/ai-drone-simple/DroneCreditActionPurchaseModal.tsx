/**

 * Tek seferlik kredi kesimi — purchasing_kredits action_type ile.

 */



import React, { useEffect, useState } from "react";

import { Alert } from "react-native";

import { AiCreditPurchaseModalLayout } from "../ai-shared/AiCreditPurchaseModalLayout";

import { creditService } from "../../services/creditService";



type Props = {

  visible: boolean;

  onClose: () => void;

  actionType: string;

  headerTitle: string;

  productName: string;

  referenceId: string;

  description?: string;

  source?: string;

  /** Sunucu API'si coin keser; istemci /api/credit/use/ çağırmaz. */

  serverSidePurchase?: boolean;

  onPurchaseSuccess?: () => void | Promise<void | boolean>;

};



export function DroneCreditActionPurchaseModal({

  visible,

  onClose,

  actionType,

  headerTitle,

  productName,

  referenceId,

  description = "",

  source = "mobile_drone_simple_editor",

  serverSidePurchase = false,

  onPurchaseSuccess,

}: Props) {

  const [balance, setBalance] = useState<number | null>(null);

  const [requiredCredits, setRequiredCredits] = useState<number | null>(null);

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

  }, [visible, actionType]);



  const loadCreditCost = async () => {

    try {

      const cost = await creditService.getCreditCostForAction(actionType);

      setRequiredCredits(cost != null && cost >= 0 ? cost : null);

    } catch (e) {

      console.warn("[DroneCreditActionPurchaseModal] credit cost:", e);

      setRequiredCredits(null);

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

      console.error("[DroneCreditActionPurchaseModal] balance:", e);

      setError("Kredi bakiyesi yüklenemedi. Lütfen tekrar deneyin.");

      setBalance(null);

    } finally {

      setLoading(false);

    }

  };



  const handlePurchase = async () => {

    const ref = String(referenceId || "").trim();

    if (!ref) {

      Alert.alert("İşlem", "Referans bilgisi eksik.");

      return;

    }

    if (requiredCredits == null) {

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

      if (serverSidePurchase) {

        const result = await onPurchaseSuccess?.();

        if (result === false) {

          setError("Etiket kaldırma işlemi tamamlanamadı.");

          return;

        }

        setSuccess(true);

        await loadBalance();

        setTimeout(() => {

          onClose();

        }, 700);

        return;

      }



      const desc: Record<string, unknown> = {

        product: productName,

        source,

      };

      if (description.trim()) desc.detail = description.trim();

      const res = await creditService.useCredit(

        actionType,

        JSON.stringify(desc),

        ref,

      );



      if (res.success) {

        setSuccess(true);

        await loadBalance();

        setTimeout(() => {

          onPurchaseSuccess?.();

          onClose();

        }, 700);

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

      headerTitle={headerTitle}

      productName={productName}

      productDescription={description}

      requiredCredits={requiredCredits}

      balance={balance}

      loading={loading}

      purchasing={purchasing}

      error={error}

      success={success}

      successMessage="İşlem tamamlandı!"

      purchaseDisabled={requiredCredits == null}

      onPurchase={() => void handlePurchase()}

    />

  );

}

