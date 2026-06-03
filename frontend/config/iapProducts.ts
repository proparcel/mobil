/**
 * Apple In-App Purchase ürün kimlikleri ve backend paket eşlemesi.
 * App Store Connect Product ID'ler ile birebir eşleşmelidir.
 *
 * Kurumsal: baslangic / standart / pro (.monthly | .yearly)
 * Bireysel: individual.baslangic / standart / pro (.monthly | .yearly)
 * Ek paket: ek.baslangic / standart / pro (Consumable)
 */

import type { CreditPackage } from "../services/creditService";

/** Kurumsal aylık — App Store: 1 Month, Auto-Renewable */
export const IAP_KURUMSAL_MONTHLY_SKUS = [
  "com.proparcel.baslangic.monthly",
  "com.proparcel.standart.monthly",
  "com.proparcel.pro.monthly",
] as const;

/** Kurumsal yıllık — App Store: 1 Year, Auto-Renewable */
export const IAP_KURUMSAL_YEARLY_SKUS = [
  "com.proparcel.baslangic.yearly",
  "com.proparcel.standart.yearly",
  "com.proparcel.pro.yearly",
] as const;

/** Bireysel aylık — App Store: 1 Month, Auto-Renewable */
export const IAP_INDIVIDUAL_MONTHLY_SKUS = [
  "com.proparcel.individual.baslangic.monthly",
  "com.proparcel.individual.standart.monthly",
  "com.proparcel.individual.pro.monthly",
] as const;

/** Bireysel yıllık — App Store: 1 Year, Auto-Renewable */
export const IAP_INDIVIDUAL_YEARLY_SKUS = [
  "com.proparcel.individual.baslangic.yearly",
  "com.proparcel.individual.standart.yearly",
  "com.proparcel.individual.pro.yearly",
] as const;

/** Ek paket — App Store: Consumable (aktif yıllık abonelik gerekir) */
export const IAP_EK_CONSUMABLE_SKUS = [
  "com.proparcel.ek.baslangic",
  "com.proparcel.ek.standart",
  "com.proparcel.ek.pro",
] as const;

/** @deprecated Kurumsal aylık alias */
export const IAP_MONTHLY_SUBSCRIPTION_SKUS = IAP_KURUMSAL_MONTHLY_SKUS;

/** @deprecated Kurumsal yıllık alias */
export const IAP_YEARLY_SUBSCRIPTION_SKUS = IAP_KURUMSAL_YEARLY_SKUS;

/** App Store Connect'te artık kullanılmayan Product ID'ler */
export const IAP_LEGACY_BLOCKED_SKUS = [
  "com.proparcel.credit100",
  "com.proparcel.credit200",
  "com.proparcel.credit400",
  "com.proparcel.credit250",
  "com.proparcel.credit500",
  "com.proparcel.standart.monthl",
] as const;

export const IAP_SUBSCRIPTION_SKUS = [
  ...IAP_KURUMSAL_MONTHLY_SKUS,
  ...IAP_KURUMSAL_YEARLY_SKUS,
  ...IAP_INDIVIDUAL_MONTHLY_SKUS,
  ...IAP_INDIVIDUAL_YEARLY_SKUS,
] as const;

export type IapKurumsalMonthlySku = (typeof IAP_KURUMSAL_MONTHLY_SKUS)[number];
export type IapKurumsalYearlySku = (typeof IAP_KURUMSAL_YEARLY_SKUS)[number];
export type IapIndividualMonthlySku = (typeof IAP_INDIVIDUAL_MONTHLY_SKUS)[number];
export type IapIndividualYearlySku = (typeof IAP_INDIVIDUAL_YEARLY_SKUS)[number];
export type IapEkConsumableSku = (typeof IAP_EK_CONSUMABLE_SKUS)[number];
export type IapProductSku =
  | IapKurumsalMonthlySku
  | IapKurumsalYearlySku
  | IapIndividualMonthlySku
  | IapIndividualYearlySku
  | IapEkConsumableSku;

export const ALL_IAP_SKUS: readonly string[] = [
  ...IAP_SUBSCRIPTION_SKUS,
  ...IAP_EK_CONSUMABLE_SKUS,
];

/** Kurumsal aylık slug → Product ID */
export const SLUG_TO_IAP_KURUMSAL_MONTHLY: Record<string, IapKurumsalMonthlySku> = {
  "baslangic-1ay": "com.proparcel.baslangic.monthly",
  "standart-1ay": "com.proparcel.standart.monthly",
  "profesyonel-1ay": "com.proparcel.pro.monthly",
};

/** Kurumsal yıllık slug → Product ID */
export const SLUG_TO_IAP_KURUMSAL_YEARLY: Record<string, IapKurumsalYearlySku> = {
  "baslangic-12ay": "com.proparcel.baslangic.yearly",
  "standart-12ay": "com.proparcel.standart.yearly",
  "profesyonel-12ay": "com.proparcel.pro.yearly",
};

/** Bireysel aylık slug → Product ID */
export const SLUG_TO_IAP_INDIVIDUAL_MONTHLY: Record<string, IapIndividualMonthlySku> = {
  "baslangic-1ay-bireysel": "com.proparcel.individual.baslangic.monthly",
  "standart-1ay-bireysel": "com.proparcel.individual.standart.monthly",
  "profesyonel-1ay-bireysel": "com.proparcel.individual.pro.monthly",
};

/** Bireysel yıllık slug → Product ID */
export const SLUG_TO_IAP_INDIVIDUAL_YEARLY: Record<string, IapIndividualYearlySku> = {
  "baslangic-12ay-bireysel": "com.proparcel.individual.baslangic.yearly",
  "standart-12ay-bireysel": "com.proparcel.individual.standart.yearly",
  "profesyonel-12ay-bireysel": "com.proparcel.individual.pro.yearly",
};

/** Ek paket slug → Product ID */
export const SLUG_TO_IAP_EK: Record<string, IapEkConsumableSku> = {
  "ek_baslangic": "com.proparcel.ek.baslangic",
  "ek_standart": "com.proparcel.ek.standart",
  "ek_profesyonel": "com.proparcel.ek.pro",
};

/** @deprecated Kurumsal aylık alias */
export const SLUG_TO_IAP_MONTHLY = SLUG_TO_IAP_KURUMSAL_MONTHLY;

/** @deprecated Kurumsal yıllık alias */
export const SLUG_TO_IAP_YEARLY = SLUG_TO_IAP_KURUMSAL_YEARLY;

const ALL_SLUG_MAPS: ReadonlyArray<Record<string, string>> = [
  SLUG_TO_IAP_KURUMSAL_MONTHLY,
  SLUG_TO_IAP_KURUMSAL_YEARLY,
  SLUG_TO_IAP_INDIVIDUAL_MONTHLY,
  SLUG_TO_IAP_INDIVIDUAL_YEARLY,
  SLUG_TO_IAP_EK,
];

export function isLegacyBlockedProductId(productId: string): boolean {
  return (IAP_LEGACY_BLOCKED_SKUS as readonly string[]).includes(productId);
}

export function isConsumableProductId(productId: string): boolean {
  return (IAP_EK_CONSUMABLE_SKUS as readonly string[]).includes(productId);
}

export function isEkProductId(productId: string): boolean {
  return isConsumableProductId(productId);
}

export function isMonthlySubscriptionProductId(productId: string): boolean {
  return (
    (IAP_KURUMSAL_MONTHLY_SKUS as readonly string[]).includes(productId) ||
    (IAP_INDIVIDUAL_MONTHLY_SKUS as readonly string[]).includes(productId)
  );
}

export function isYearlySubscriptionProductId(productId: string): boolean {
  return (
    (IAP_KURUMSAL_YEARLY_SKUS as readonly string[]).includes(productId) ||
    (IAP_INDIVIDUAL_YEARLY_SKUS as readonly string[]).includes(productId)
  );
}

export function isSubscriptionProductId(productId: string): boolean {
  return isMonthlySubscriptionProductId(productId) || isYearlySubscriptionProductId(productId);
}

export function isKnownIapProductId(productId: string): boolean {
  return isSubscriptionProductId(productId) || isConsumableProductId(productId);
}

/** @deprecated Tüm IAP ürünleri abonelik değil; ek paketler consumable. */
export function isCreditProductId(productId: string): boolean {
  return isConsumableProductId(productId);
}

/** Paket için App Store Product ID döndürür; yoksa null. */
export function resolveIapProductId(pkg: CreditPackage): string | null {
  const slug = (pkg.slug || "").toLowerCase();
  for (const map of ALL_SLUG_MAPS) {
    if (slug && map[slug]) {
      return map[slug];
    }
  }
  return pkg.ios_product_id ?? null;
}

export function packageHasIapProduct(pkg: CreditPackage): boolean {
  return resolveIapProductId(pkg) != null;
}

export function isEkPackage(pkg: CreditPackage): boolean {
  const slug = (pkg.slug || "").toLowerCase();
  return Boolean(pkg.is_ek_package || slug.startsWith("ek_"));
}
