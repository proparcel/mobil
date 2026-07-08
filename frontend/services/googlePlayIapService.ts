/**
 * Google Play Billing servis katmanı (Android only).
 * iOS için `iapService.ts` kullanılır — iki platform ayrı yönetilir.
 */

import { Platform } from "react-native";
import { authJsonFetch } from "./apiClient";
import {
  IAP_PLAY_INAPP_SKUS,
  IAP_PLAY_SUBSCRIPTION_SKUS,
  isConsumableProductId,
  isKnownIapProductId,
  isLicenseProductId,
  isPlaySubscriptionProductId,
} from "../config/iapProducts";

type IapModule = typeof import("react-native-iap");
type Product = import("react-native-iap").Product;
type Purchase = import("react-native-iap").Purchase;
type PurchaseError = import("react-native-iap").PurchaseError;

export interface PlayProductInfo {
  productId: string;
  title: string;
  description: string;
  localizedPrice: string;
  price?: number;
  currency?: string;
  type: "subs" | "in-app";
  offerToken?: string;
}

export interface ValidateReceiptPayload {
  product_id: string;
  transaction_id: string;
  package_id?: number;
  purchase_token?: string;
  action_type?: string;
  reference_id?: string;
  description?: string;
}

export interface ValidateReceiptResult {
  success: boolean;
  message?: string;
  error?: string;
  transaction_id?: string;
  purchase_id?: number;
  new_balance?: number;
  already_processed?: boolean;
  amount_paid?: number;
  currency?: string;
  display_price?: string;
}

export interface PurchaseProductOptions {
  packageId?: number;
  actionType?: string;
  referenceId?: string;
  description?: string;
  onSuccess?: (result: ValidateReceiptResult) => void;
  onError?: (message: string) => void;
}

const IS_ANDROID = Platform.OS === "android";

let iapModule: IapModule | null = null;
let connected = false;
let initPromise: Promise<boolean> | null = null;

const processedTransactionIds = new Set<string>();
const validatingTransactionIds = new Set<string>();
const pendingPurchaseResolvers = new Map<
  string,
  {
    resolve: (r: ValidateReceiptResult) => void;
    reject: (e: Error) => void;
    packageId?: number;
    actionType?: string;
    referenceId?: string;
    description?: string;
  }
>();

let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;
let cachedStoreProducts: PlayProductInfo[] = [];

async function getIap(): Promise<IapModule | null> {
  if (!IS_ANDROID) return null;
  if (iapModule) return iapModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-iap") as IapModule;
    iapModule = mod;
    return iapModule;
  } catch (e) {
    console.error("[googlePlayIap] react-native-iap yüklenemedi", e);
    return null;
  }
}

async function withNetworkRetry<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 800): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function purchaseKey(purchase: Purchase): string {
  if (purchase.transactionId) return String(purchase.transactionId);
  if (purchase.purchaseToken) return String(purchase.purchaseToken);
  if (purchase.id) return String(purchase.id);
  return String(purchase.productId);
}

function mapProduct(p: Product, type: "subs" | "in-app", offerToken?: string): PlayProductInfo {
  const anyP = p as Product & {
    localizedPrice?: string;
    displayPrice?: string;
    price?: number;
    currency?: string;
    subscriptionOfferDetails?: Array<{ offerToken?: string }>;
    subscriptionOfferDetailsAndroid?: Array<{ offerToken?: string }>;
  };
  const token =
    offerToken ||
    anyP.subscriptionOfferDetails?.[0]?.offerToken ||
    anyP.subscriptionOfferDetailsAndroid?.[0]?.offerToken;
  return {
    productId: p.id,
    title: p.title,
    description: p.description,
    localizedPrice: anyP.localizedPrice || anyP.displayPrice || "",
    price: anyP.price ?? undefined,
    currency: anyP.currency || undefined,
    type,
    offerToken: token,
  };
}

function isConsumableForFinish(productId: string): boolean {
  return isConsumableProductId(productId) || !isPlaySubscriptionProductId(productId);
}

function playProductQueryType(productId: string): "subs" | "in-app" {
  return isPlaySubscriptionProductId(productId) ? "subs" : "in-app";
}

function formatPlayPurchaseErrorMessage(error: PurchaseError | Error, productId?: string): string {
  const code = String((error as PurchaseError).code || "");
  const raw = String(error.message || "");
  const lower = `${code} ${raw}`.toLowerCase();
  if (
    lower.includes("sku-not-found") ||
    lower.includes("sku_not_found") ||
    lower.includes("not found") && lower.includes("sku")
  ) {
    const skuHint = productId ? ` (${productId})` : "";
    return (
      `Google Play'de ürün bulunamadı${skuHint}. ` +
      "Play Console → Monetize → In-app products altında Product ID'nin birebir tanımlı, " +
      "Active durumda ve test build'inizle aynı uygulama paketinde (com.proparcel.mobile) olduğundan emin olun."
    );
  }
  if (lower.includes("user_cancelled") || lower.includes("user_canceled")) {
    return "Satın alma iptal edildi.";
  }
  return raw || "Satın alma başarısız.";
}

async function ensurePlayProductInCatalog(productId: string): Promise<PlayProductInfo | null> {
  const cached = cachedStoreProducts.find((p) => p.productId === productId);
  if (cached) return cached;

  await loadPlayProducts();
  const reloaded = cachedStoreProducts.find((p) => p.productId === productId);
  if (reloaded) return reloaded;

  const iap = await getIap();
  if (!iap) return null;

  const type = playProductQueryType(productId);
  try {
    const rows = await iap.fetchProducts({ skus: [productId], type });
    const first = rows?.[0];
    if (!first) return null;
    const mapped = mapProduct(first, type);
    cachedStoreProducts = [...cachedStoreProducts.filter((p) => p.productId !== productId), mapped];
    return mapped;
  } catch (e) {
    console.warn("[googlePlayIap] ensurePlayProductInCatalog failed:", productId, e);
    return null;
  }
}

async function validateReceipt(payload: ValidateReceiptPayload): Promise<ValidateReceiptResult> {
  if (!IS_ANDROID) {
    return { success: false, error: "Google Play yalnızca Android'de kullanılabilir." };
  }

  const token = (payload.purchase_token || "").trim();
  const txId = (payload.transaction_id || "").trim();
  if (!token) {
    return { success: false, error: "purchase_token gerekli." };
  }
  if (processedTransactionIds.has(txId || token)) {
    return { success: true, already_processed: true, transaction_id: txId || token };
  }

  const res = await withNetworkRetry(() =>
    authJsonFetch<{
      success?: boolean;
      message?: string;
      error?: string;
      error_code?: string;
      transaction_id?: string;
      purchase_id?: number;
      new_balance?: number;
      already_processed?: boolean;
    }>("/api/payments/google/verify/", {
      method: "POST",
      json: {
        product_id: payload.product_id,
        purchase_token: token,
        transaction_id: txId,
        platform: "android",
        package_id: payload.package_id,
        action_type: payload.action_type,
        reference_id: payload.reference_id,
        description: payload.description,
      },
    })
  );

  if (!res.ok) {
    return {
      success: false,
      error: res.error || "Doğrulama isteği başarısız.",
      message: typeof res.payload?.message === "string" ? res.payload.message : undefined,
    };
  }

  const body = res.data ?? {};
  const success = body.success === true;
  if (success) {
    processedTransactionIds.add(txId || token);
  }

  return {
    success,
    message: body.message,
    error: body.error,
    transaction_id: body.transaction_id || txId,
    purchase_id: body.purchase_id,
    new_balance: body.new_balance,
    already_processed: body.already_processed,
  };
}

async function handlePurchaseUpdate(purchase: Purchase): Promise<void> {
  const iap = await getIap();
  if (!iap) return;

  const txId = purchaseKey(purchase);
  if (validatingTransactionIds.has(txId)) return;

  const waiter = pendingPurchaseResolvers.get(purchase.productId);
  if (processedTransactionIds.has(txId)) {
    try {
      await iap.finishTransaction({
        purchase,
        isConsumable: isConsumableForFinish(purchase.productId),
      });
    } catch {
      /* ignore */
    }
    if (waiter) {
      waiter.resolve({
        success: true,
        already_processed: true,
        transaction_id: txId,
      });
    }
    return;
  }

  validatingTransactionIds.add(txId);
  try {
    const result = await validateReceipt({
      product_id: purchase.productId,
      transaction_id: txId,
      package_id: waiter?.packageId,
      purchase_token: purchase.purchaseToken ?? undefined,
      action_type: waiter?.actionType,
      reference_id: waiter?.referenceId,
      description: waiter?.description,
    });
    if (result.success) {
      processedTransactionIds.add(txId);
      await iap.finishTransaction({
        purchase,
        isConsumable: isConsumableForFinish(purchase.productId),
      });
    }
    if (waiter) {
      waiter.resolve(result);
    }
  } catch (err) {
    if (waiter) {
      waiter.reject(err instanceof Error ? err : new Error(String(err)));
    }
  } finally {
    validatingTransactionIds.delete(txId);
  }
}

function attachListeners(iap: IapModule): void {
  if (purchaseUpdateSub) purchaseUpdateSub.remove();
  if (purchaseErrorSub) purchaseErrorSub.remove();

  purchaseUpdateSub = iap.purchaseUpdatedListener((purchase) => {
    void handlePurchaseUpdate(purchase);
  });

  purchaseErrorSub = iap.purchaseErrorListener((error: PurchaseError) => {
    const code = String(error.code || "");
    if (code.includes("USER_CANCELLED") || code.includes("E_USER_CANCELLED")) {
      pendingPurchaseResolvers.forEach(({ reject }) => reject(new Error("Satın alma iptal edildi.")));
      pendingPurchaseResolvers.clear();
      return;
    }
    const message = formatPlayPurchaseErrorMessage(error);
    pendingPurchaseResolvers.forEach(({ reject }) => reject(new Error(message)));
    pendingPurchaseResolvers.clear();
  });
}

export async function initializeGooglePlayIAP(): Promise<boolean> {
  if (!IS_ANDROID) return false;
  if (connected) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const iap = await getIap();
    if (!iap) return false;
    try {
      const ok = await iap.initConnection();
      connected = ok;
      if (ok) attachListeners(iap);
      return ok;
    } catch (e) {
      console.error("[googlePlayIap] initConnection failed", e);
      connected = false;
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export async function teardownGooglePlayIAP(): Promise<void> {
  if (!IS_ANDROID || !connected) return;
  const iap = await getIap();
  purchaseUpdateSub?.remove();
  purchaseErrorSub?.remove();
  purchaseUpdateSub = null;
  purchaseErrorSub = null;
  if (iap) {
    try {
      await iap.endConnection();
    } catch {
      /* ignore */
    }
  }
  connected = false;
}

export async function loadPlayProducts(): Promise<PlayProductInfo[]> {
  if (!IS_ANDROID) return [];
  await initializeGooglePlayIAP();
  const iap = await getIap();
  if (!iap) return [];

  const subs = IAP_PLAY_SUBSCRIPTION_SKUS.length
    ? await iap.fetchProducts({ skus: [...IAP_PLAY_SUBSCRIPTION_SKUS], type: "subs" })
    : [];
  const inApp = IAP_PLAY_INAPP_SKUS.length
    ? await iap.fetchProducts({ skus: [...IAP_PLAY_INAPP_SKUS], type: "in-app" })
    : [];

  const subRows = (subs ?? []).map((p) => mapProduct(p, "subs"));
  const inAppRows = (inApp ?? []).map((p) => mapProduct(p, "in-app"));
  cachedStoreProducts = [...subRows, ...inAppRows];
  return cachedStoreProducts;
}

export async function purchasePlayProduct(
  productId: string,
  options: PurchaseProductOptions = {}
): Promise<ValidateReceiptResult> {
  if (!IS_ANDROID) {
    throw new Error("Google Play yalnızca Android'de kullanılabilir.");
  }
  if (!isKnownIapProductId(productId) && !isLicenseProductId(productId)) {
    throw new Error(`Geçersiz ürün kimliği: ${productId}`);
  }

  await initializeGooglePlayIAP();
  const iap = await getIap();
  if (!iap) throw new Error("Ödeme modülü yüklenemedi.");

  const catalog = await ensurePlayProductInCatalog(productId);
  if (!catalog) {
    throw new Error(formatPlayPurchaseErrorMessage(new Error("sku-not-found"), productId));
  }

  const purchaseType = playProductQueryType(productId);

  return new Promise<ValidateReceiptResult>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (!pendingPurchaseResolvers.has(productId)) return;
      pendingPurchaseResolvers.delete(productId);
      reject(new Error("Satın alma yanıtı alınamadı. «Satın Almaları Geri Yükle» deneyin."));
    }, 120_000);

    const settle = (value: ValidateReceiptResult) => {
      clearTimeout(timeoutId);
      pendingPurchaseResolvers.delete(productId);
      resolve(value);
    };
    const fail = (err: unknown) => {
      clearTimeout(timeoutId);
      pendingPurchaseResolvers.delete(productId);
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    pendingPurchaseResolvers.set(productId, {
      resolve: settle,
      reject: fail,
      packageId: options.packageId,
      actionType: options.actionType,
      referenceId: options.referenceId,
      description: options.description,
    });

    const androidRequest =
      purchaseType === "subs" && catalog?.offerToken
        ? {
            skus: [productId],
            subscriptionOffers: [{ sku: productId, offerToken: catalog.offerToken }],
          }
        : { skus: [productId] };

    iap
      .requestPurchase({
        type: purchaseType,
        request: {
          android: androidRequest,
          google: androidRequest,
        },
      })
      .catch((err) => fail(formatPlayPurchaseErrorMessage(err instanceof Error ? err : new Error(String(err)), productId)));
  });
}

export async function restorePlayPurchases(): Promise<ValidateReceiptResult[]> {
  if (!IS_ANDROID) return [];
  await initializeGooglePlayIAP();
  const iap = await getIap();
  if (!iap) return [];

  const purchases = await iap.getAvailablePurchases();
  const results: ValidateReceiptResult[] = [];

  for (const purchase of purchases) {
    const txId = purchaseKey(purchase);
    if (processedTransactionIds.has(txId)) continue;
    try {
      const result = await validateReceipt({
        product_id: purchase.productId,
        transaction_id: txId,
        purchase_token: purchase.purchaseToken ?? undefined,
      });
      if (result.success) {
        processedTransactionIds.add(txId);
        await iap.finishTransaction({
          purchase,
          isConsumable: isConsumableForFinish(purchase.productId),
        });
      }
      results.push(result);
    } catch (e) {
      results.push({
        success: false,
        error: e instanceof Error ? e.message : String(e),
        transaction_id: txId,
      });
    }
  }

  return results;
}

export function findPlayStorePrice(products: PlayProductInfo[], productId: string): string | null {
  return products.find((p) => p.productId === productId)?.localizedPrice ?? null;
}
