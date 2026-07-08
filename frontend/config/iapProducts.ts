/**
 * Apple In-App Purchase ürün kimlikleri ve backend paket eşlemesi.
 * App Store Connect Product ID'ler ile birebir eşleşmelidir.
 *
 * Kurumsal aylık: sub.corp.*.monthly (Consumable) | Kurumsal yıllık: corp.yearly.* (Subscription)
 * Bireysel aylık: sub.indiv.*.monthly (Consumable) | Bireysel yıllık: indiv.yearly.* (Subscription)
 * Ek paket: ek.baslangic / standart / pro (Consumable)
 */

import type { CreditPackage } from "../services/creditService";

/** Kurumsal aylık — App Store: Consumable (In-App Purchase) */
export const IAP_KURUMSAL_MONTHLY_SKUS = [
  "com.proparcel.sub.corp.baslangic.monthly",
  "com.proparcel.sub.corp.standart.monthly",
  "com.proparcel.sub.corp.pro.monthly",
] as const;

/** Kurumsal yıllık — App Store: 1 Year, Auto-Renewable */
export const IAP_KURUMSAL_YEARLY_SKUS = [
  "com.proparcel.corp.yearly.baslangic",
  "com.proparcel.corp.yearly.standart",
  "com.proparcel.corp.yearly.pro",
] as const;

/** Bireysel aylık — App Store: Consumable (In-App Purchase) */
export const IAP_INDIVIDUAL_MONTHLY_SKUS = [
  "com.proparcel.sub.indiv.baslangic.monthly",
  "com.proparcel.sub.indiv.standart.monthly",
  "com.proparcel.sub.indiv.pro.monthly",
] as const;

/** Bireysel yıllık — App Store: 1 Year, Auto-Renewable */
export const IAP_INDIVIDUAL_YEARLY_SKUS = [
  "com.proparcel.indiv.yearly.baslangic",
  "com.proparcel.indiv.yearly.standart",
  "com.proparcel.indiv.yearly.pro",
] as const;

/** Ek paket — App Store / Play: Consumable */
export const IAP_EK_CONSUMABLE_SKUS = [
  "com.proparcel.ek.baslangic",
  "com.proparcel.ek.standart",
  "com.proparcel.ek.pro",
] as const;

/** TL paket lisansları — App Store / Play: Consumable */
export const IAP_LICENSE_CONSUMABLE_SKUS = [
  "com.proparcel.license.ai_video",
  "com.proparcel.license.drone_video",
  "com.proparcel.license.ai_drone_proparcel",
  "com.proparcel.license.drone_video_ek_sahne_1",
  "com.proparcel.license.drone_video_ek_sahne_2",
] as const;

export const LICENSE_ACTION_TO_IAP_SKU: Record<string, (typeof IAP_LICENSE_CONSUMABLE_SKUS)[number]> = {
  ai_video: "com.proparcel.license.ai_video",
  drone_video: "com.proparcel.license.drone_video",
  ai_drone_proparcel: "com.proparcel.license.ai_drone_proparcel",
  drone_video_ek_sahne: "com.proparcel.license.drone_video_ek_sahne_1",
  drone_video_ek_sahne_2: "com.proparcel.license.drone_video_ek_sahne_2",
};

/** iOS App Store — Auto-Renewable Subscription (yalnızca yıllık) */
export const IAP_IOS_SUBSCRIPTION_SKUS = [
  ...IAP_KURUMSAL_YEARLY_SKUS,
  ...IAP_INDIVIDUAL_YEARLY_SKUS,
] as const;

/** iOS App Store — Consumable (aylık paketler + ek) */
export const IAP_IOS_CONSUMABLE_SKUS = [
  ...IAP_KURUMSAL_MONTHLY_SKUS,
  ...IAP_INDIVIDUAL_MONTHLY_SKUS,
  ...IAP_EK_CONSUMABLE_SKUS,
  ...IAP_LICENSE_CONSUMABLE_SKUS,
] as const;

/** Google Play — yıllık abonelik SKU'ları */
export const IAP_PLAY_SUBSCRIPTION_SKUS = [
  ...IAP_KURUMSAL_YEARLY_SKUS,
  ...IAP_INDIVIDUAL_YEARLY_SKUS,
] as const;

/** Google Play — tek seferlik (aylık + ek) SKU'ları */
export const IAP_PLAY_INAPP_SKUS = [
  ...IAP_KURUMSAL_MONTHLY_SKUS,
  ...IAP_INDIVIDUAL_MONTHLY_SKUS,
  ...IAP_EK_CONSUMABLE_SKUS,
  ...IAP_LICENSE_CONSUMABLE_SKUS,
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
  "com.proparcel.baslangic.monthly",
  "com.proparcel.standart.monthly",
  "com.proparcel.pro.monthly",
  "com.proparcel.individual.baslangic.monthly",
  "com.proparcel.individual.standart.monthly",
  "com.proparcel.individual.pro.monthly",
  "com.proparcel.indiv.monthly.baslangic",
  "com.proparcel.indiv.monthly.standart",
  "com.proparcel.indiv.monthly.pro",
  "com.proparcel.baslangic.yearly",
  "com.proparcel.standart.yearly",
  "com.proparcel.pro.yearly",
  "com.proparcel.sub.corp.baslangic.yearly",
  "com.proparcel.sub.corp.standart.yearly",
  "com.proparcel.sub.corp.pro.yearly",
  "com.proparcel.individual.baslangic.yearly",
  "com.proparcel.individual.standart.yearly",
  "com.proparcel.individual.pro.yearly",
  "com.proparcel.sub.indiv.baslangic.yearly",
  "com.proparcel.sub.indiv.standart.yearly",
  "com.proparcel.sub.indiv.pro.yearly",
] as const;

export const IAP_SUBSCRIPTION_SKUS = IAP_IOS_SUBSCRIPTION_SKUS;

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
  ...IAP_IOS_SUBSCRIPTION_SKUS,
  ...IAP_IOS_CONSUMABLE_SKUS,
];

/** Kurumsal aylık slug → Product ID */
export const SLUG_TO_IAP_KURUMSAL_MONTHLY: Record<string, IapKurumsalMonthlySku> = {
  "baslangic-1ay": "com.proparcel.sub.corp.baslangic.monthly",
  "standart-1ay": "com.proparcel.sub.corp.standart.monthly",
  "profesyonel-1ay": "com.proparcel.sub.corp.pro.monthly",
};

/** Kurumsal yıllık slug → Product ID */
export const SLUG_TO_IAP_KURUMSAL_YEARLY: Record<string, IapKurumsalYearlySku> = {
  "baslangic-12ay": "com.proparcel.corp.yearly.baslangic",
  "standart-12ay": "com.proparcel.corp.yearly.standart",
  "profesyonel-12ay": "com.proparcel.corp.yearly.pro",
};

/** Bireysel aylık slug → Product ID */
export const SLUG_TO_IAP_INDIVIDUAL_MONTHLY: Record<string, IapIndividualMonthlySku> = {
  "baslangic-1ay-bireysel": "com.proparcel.sub.indiv.baslangic.monthly",
  "standart-1ay-bireysel": "com.proparcel.sub.indiv.standart.monthly",
  "profesyonel-1ay-bireysel": "com.proparcel.sub.indiv.pro.monthly",
};

/** Bireysel yıllık slug → Product ID */
export const SLUG_TO_IAP_INDIVIDUAL_YEARLY: Record<string, IapIndividualYearlySku> = {
  "baslangic-12ay-bireysel": "com.proparcel.indiv.yearly.baslangic",
  "standart-12ay-bireysel": "com.proparcel.indiv.yearly.standart",
  "profesyonel-12ay-bireysel": "com.proparcel.indiv.yearly.pro",
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
  return (IAP_IOS_CONSUMABLE_SKUS as readonly string[]).includes(productId);
}

export function isEkProductId(productId: string): boolean {
  return (IAP_EK_CONSUMABLE_SKUS as readonly string[]).includes(productId);
}

export function isMonthlyPackageProductId(productId: string): boolean {
  return (
    (IAP_KURUMSAL_MONTHLY_SKUS as readonly string[]).includes(productId) ||
    (IAP_INDIVIDUAL_MONTHLY_SKUS as readonly string[]).includes(productId)
  );
}

/** @deprecated iOS'ta aylık paketler abonelik değil consumable; isMonthlyPackageProductId kullanın */
export function isMonthlySubscriptionProductId(productId: string): boolean {
  return isMonthlyPackageProductId(productId);
}

export function isYearlySubscriptionProductId(productId: string): boolean {
  return (
    (IAP_KURUMSAL_YEARLY_SKUS as readonly string[]).includes(productId) ||
    (IAP_INDIVIDUAL_YEARLY_SKUS as readonly string[]).includes(productId)
  );
}

export function isSubscriptionProductId(productId: string): boolean {
  return isYearlySubscriptionProductId(productId);
}

export function isKnownIapProductId(productId: string): boolean {
  return isSubscriptionProductId(productId) || isConsumableProductId(productId);
}

/** @deprecated Tüm IAP ürünleri abonelik değil; ek paketler consumable. */
export function isCreditProductId(productId: string): boolean {
  return isConsumableProductId(productId);
}

/** Paket için Google Play Product ID döndürür; yoksa null. */
export function resolvePlayProductId(pkg: CreditPackage): string | null {
  const slug = (pkg.slug || "").toLowerCase();
  for (const map of ALL_SLUG_MAPS) {
    if (slug && map[slug]) {
      return map[slug];
    }
  }
  const android = (pkg.android_product_id || "").trim();
  if (android) return android;
  const ios = (pkg.ios_product_id || "").trim();
  if (ios) return ios;
  return null;
}

/** @deprecated resolvePlayProductId kullanın */
export function resolveIapProductId(pkg: CreditPackage): string | null {
  return resolvePlayProductId(pkg);
}

export function packageHasIapProduct(pkg: CreditPackage): boolean {
  return resolveIapProductId(pkg) != null;
}

export function isPlaySubscriptionProductId(productId: string): boolean {
  return (IAP_PLAY_SUBSCRIPTION_SKUS as readonly string[]).includes(productId);
}

export function isPlayInAppProductId(productId: string): boolean {
  return (IAP_PLAY_INAPP_SKUS as readonly string[]).includes(productId);
}

export function packageHasPlayProduct(pkg: CreditPackage): boolean {
  return packageHasIapProduct(pkg);
}

export function isLicenseProductId(productId: string): boolean {
  return (IAP_LICENSE_CONSUMABLE_SKUS as readonly string[]).includes(productId);
}

export function licenseActionForProductId(productId: string): string | null {
  for (const [action, sku] of Object.entries(LICENSE_ACTION_TO_IAP_SKU)) {
    if (sku === productId) return action;
  }
  return null;
}

export function resolveLicenseProductId(
  actionType: string,
  pricing?: {
    ios_product_id?: string;
    google_product_id?: string;
    android_product_id?: string;
  } | null,
  platform: "ios" | "android" = "ios",
): string | null {
  const fromApi =
    platform === "android"
      ? (pricing?.google_product_id || pricing?.android_product_id || "").trim()
      : (pricing?.ios_product_id || "").trim();
  if (fromApi) return fromApi;
  return LICENSE_ACTION_TO_IAP_SKU[actionType] ?? null;
}

export function isEkPackage(pkg: CreditPackage): boolean {
  const slug = (pkg.slug || "").toLowerCase();
  return Boolean(pkg.is_ek_package || slug.startsWith("ek_"));
}

/** Ek paket — herkes satın alabilir (yıllık abonelik zorunlu değil). */
export function ekPackageRequiresYearlySubscription(_pkg: CreditPackage): boolean {
  return false;
}
