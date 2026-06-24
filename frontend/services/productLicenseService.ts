/**
 * TL paket lisansları — IAP doğrulama + purchasing_kredits fiyat okuma.
 */

import { Platform } from "react-native";
import { creditService, type CreditCostItem } from "./creditService";
import { resolveLicenseProductId } from "../config/iapProducts";
import { purchaseProduct, type ValidateReceiptResult } from "./iapService";
import { purchasePlayProduct } from "./googlePlayIapService";

export type ProductPricing = CreditCostItem;

export async function getProductPricing(actionType: string): Promise<ProductPricing | null> {
  return creditService.getProductPricingForAction(actionType);
}

export async function purchaseProductLicense(options: {
  actionType: string;
  referenceId: string;
  description?: string;
  pricing?: ProductPricing | null;
}): Promise<ValidateReceiptResult> {
  const platform = Platform.OS === "android" ? "android" : "ios";
  const pricing = options.pricing ?? (await getProductPricing(options.actionType));
  const productId = resolveLicenseProductId(options.actionType, pricing ?? undefined, platform);
  if (!productId) {
    return { success: false, error: "Mağaza ürün kimliği bulunamadı." };
  }

  const licenseOpts = {
    actionType: options.actionType,
    referenceId: options.referenceId,
    description: options.description,
  };

  if (platform === "android") {
    return purchasePlayProduct(productId, licenseOpts);
  }
  return purchaseProduct(productId, licenseOpts);
}
