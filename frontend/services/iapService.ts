/**
 * Apple In-App Purchase servis katmanı (iOS only).
 * Android bu modülü kullanmaz; tüm fonksiyonlar Platform.OS !== 'ios' iken no-op döner.
 */

import { Platform } from "react-native";
import { authJsonFetch } from "./apiClient";
import {
  ALL_IAP_SKUS,
  IAP_SUBSCRIPTION_SKUS,
  IAP_EK_CONSUMABLE_SKUS,
  isKnownIapProductId,
  isConsumableProductId,
} from "../config/iapProducts";

type IapModule = typeof import("react-native-iap");
type Product = import("react-native-iap").Product;
type Purchase = import("react-native-iap").Purchase;
type PurchaseError = import("react-native-iap").PurchaseError;

export interface IapProductInfo {
  productId: string;
  title: string;
  description: string;
  localizedPrice: string;
  price?: number;
  type: "subs" | "in-app";
}

export interface ValidateReceiptPayload {
  product_id: string;
  transaction_id: string;
  package_id?: number;
  receipt_data?: string;
  purchase_token?: string;
  original_transaction_id?: string;
  environment?: string;
}

export interface ValidateReceiptResult {
  success: boolean;
  message?: string;
  error?: string;
  transaction_id?: string;
  purchase_id?: number;
  new_balance?: number;
  already_processed?: boolean;
}

export interface PurchaseProductOptions {
  packageId?: number;
  onSuccess?: (result: ValidateReceiptResult) => void;
  onError?: (message: string) => void;
}

const IS_IOS = Platform.OS === "ios";

let iapModule: IapModule | null = null;
let connected = false;
let initPromise: Promise<boolean> | null = null;

const processedTransactionIds = new Set<string>();
const pendingPurchaseResolvers = new Map<
  string,
  { resolve: (r: ValidateReceiptResult) => void; reject: (e: Error) => void; packageId?: number }
>();

let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;

async function getIap(): Promise<IapModule | null> {
  if (!IS_IOS) return null;
  if (!iapModule) {
    iapModule = await import("react-native-iap");
  }
  return iapModule;
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
  const iosPurchase = purchase as Purchase & { transactionId?: string };
  return String(iosPurchase.transactionId || purchase.id || purchase.productId);
}

function mapProduct(p: Product, type: "subs" | "in-app"): IapProductInfo {
  const anyP = p as Product & {
    localizedPrice?: string;
    displayPrice?: string;
    price?: number;
  };
  return {
    productId: p.id,
    title: p.title,
    description: p.description,
    localizedPrice: anyP.localizedPrice || anyP.displayPrice || "",
    price: anyP.price ?? undefined,
    type,
  };
}

async function handlePurchaseUpdate(purchase: Purchase): Promise<void> {
  const iap = await getIap();
  if (!iap) return;

  const txId = purchaseKey(purchase);
  if (processedTransactionIds.has(txId)) {
    try {
      await iap.finishTransaction({
        purchase,
        isConsumable: isConsumableProductId(purchase.productId),
      });
    } catch {
      /* already finished */
    }
    return;
  }

  const waiter = pendingPurchaseResolvers.get(purchase.productId);
  const packageId = waiter?.packageId;

  try {
    const result = await validateReceipt({
      product_id: purchase.productId,
      transaction_id: txId,
      package_id: packageId,
      purchase_token: purchase.purchaseToken ?? undefined,
      original_transaction_id:
        (purchase as Purchase & { originalTransactionIdentifierIOS?: string }).originalTransactionIdentifierIOS ??
        undefined,
      environment: (purchase as Purchase & { environmentIOS?: string }).environmentIOS ?? undefined,
    });

    if (result.success) {
      processedTransactionIds.add(txId);
      await iap.finishTransaction({
        purchase,
        isConsumable: isConsumableProductId(purchase.productId),
      });
      waiter?.resolve(result);
      pendingPurchaseResolvers.delete(purchase.productId);
    } else {
      const err = new Error(result.error || result.message || "Sunucu doğrulaması başarısız.");
      waiter?.reject(err);
      pendingPurchaseResolvers.delete(purchase.productId);
    }
  } catch (err) {
    waiter?.reject(err instanceof Error ? err : new Error(String(err)));
    pendingPurchaseResolvers.delete(purchase.productId);
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
    pendingPurchaseResolvers.forEach(({ reject }) =>
      reject(new Error(error.message || "Satın alma başarısız."))
    );
    pendingPurchaseResolvers.clear();
  });
}

async function processPendingTransactions(): Promise<void> {
  const iap = await getIap();
  if (!iap?.getPendingTransactionsIOS) return;
  try {
    const pending = await iap.getPendingTransactionsIOS();
    for (const purchase of pending) {
      await handlePurchaseUpdate(purchase);
    }
  } catch (e) {
    console.warn("[iapService] pending transactions", e);
  }
}

/** StoreKit bağlantısını başlatır ve dinleyicileri kaydeder. */
export async function initializeIAP(): Promise<boolean> {
  if (!IS_IOS) return false;
  if (connected) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const iap = await getIap();
    if (!iap) return false;
    try {
      const ok = await iap.initConnection();
      connected = ok;
      if (ok) {
        attachListeners(iap);
        await processPendingTransactions();
      }
      return ok;
    } catch (e) {
      console.error("[iapService] initConnection failed", e);
      connected = false;
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/** Bağlantıyı kapatır. */
export async function teardownIAP(): Promise<void> {
  if (!IS_IOS || !connected) return;
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

/** App Store ürünlerini yükler (abonelik + ek paket consumable). */
export async function loadProducts(): Promise<IapProductInfo[]> {
  if (!IS_IOS) return [];
  await initializeIAP();
  const iap = await getIap();
  if (!iap) return [];

  const [subs, consumables] = await Promise.all([
    iap.fetchProducts({ skus: [...IAP_SUBSCRIPTION_SKUS], type: "subs" }),
    IAP_EK_CONSUMABLE_SKUS.length
      ? iap.fetchProducts({ skus: [...IAP_EK_CONSUMABLE_SKUS], type: "in-app" })
      : Promise.resolve([]),
  ]);

  const subRows = (subs ?? []).map((p) => mapProduct(p, "subs"));
  const consumableRows = (consumables ?? []).map((p) => mapProduct(p, "in-app"));
  return [...subRows, ...consumableRows];
}

/** Belirli bir ürünü satın alır; sonuç backend doğrulamasından sonra döner. */
export async function purchaseProduct(
  productId: string,
  options: PurchaseProductOptions = {}
): Promise<ValidateReceiptResult> {
  if (!IS_IOS) {
    throw new Error("In-App Purchase yalnızca iOS'ta kullanılabilir.");
  }

  await initializeIAP();
  const iap = await getIap();
  if (!iap) throw new Error("IAP modülü yüklenemedi.");

  if (!isKnownIapProductId(productId)) {
    throw new Error(`Geçersiz App Store ürün kimliği: ${productId}`);
  }

  const purchaseType = isConsumableProductId(productId) ? "in-app" : "subs";

  return new Promise<ValidateReceiptResult>((resolve, reject) => {
    pendingPurchaseResolvers.set(productId, {
      resolve,
      reject,
      packageId: options.packageId,
    });

    iap
      .requestPurchase({
        type: purchaseType,
        request: {
          apple: { sku: productId },
        },
      })
      .catch((err) => {
        pendingPurchaseResolvers.delete(productId);
        reject(err instanceof Error ? err : new Error(String(err)));
      });

    // purchaseUpdatedListener sonucu resolve eder
    setTimeout(() => {
      if (pendingPurchaseResolvers.has(productId)) {
        // kullanıcı iptal etmiş olabilir — listener halleder
      }
    }, 120_000);
  });
}

/** Satın almaları geri yükler (abonelikler + tamamlanmamış işlemler). */
export async function restorePurchases(): Promise<ValidateReceiptResult[]> {
  if (!IS_IOS) return [];
  await initializeIAP();
  const iap = await getIap();
  if (!iap) return [];

  await iap.restorePurchases();
  const purchases = await iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  const results: ValidateReceiptResult[] = [];

  for (const purchase of purchases) {
    const txId = purchaseKey(purchase);
    if (processedTransactionIds.has(txId)) continue;
    try {
      const result = await withNetworkRetry(() =>
        validateReceipt({
          product_id: purchase.productId,
          transaction_id: txId,
          purchase_token: purchase.purchaseToken ?? undefined,
          original_transaction_id:
            (purchase as Purchase & { originalTransactionIdentifierIOS?: string }).originalTransactionIdentifierIOS ??
            undefined,
        })
      );
      if (result.success) {
        processedTransactionIds.add(txId);
        await iap.finishTransaction({
          purchase,
          isConsumable: isConsumableProductId(purchase.productId),
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

/** Backend'e transaction gönderir; kredi yalnızca sunucu tarafında yüklenir. */
export async function validateReceipt(payload: ValidateReceiptPayload): Promise<ValidateReceiptResult> {
  if (!IS_IOS) {
    return { success: false, error: "IAP yalnızca iOS'ta desteklenir." };
  }

  const txId = payload.transaction_id?.trim();
  if (!txId) {
    return { success: false, error: "transaction_id gerekli." };
  }
  if (processedTransactionIds.has(txId)) {
    return { success: true, already_processed: true, transaction_id: txId, message: "İşlem zaten işlendi." };
  }

  const res = await withNetworkRetry(() =>
    authJsonFetch<{
      success?: boolean;
      message?: string;
      error?: string;
      transaction_id?: string;
      purchase_id?: number;
      new_balance?: number;
      already_processed?: boolean;
    }>("/api/payments/apple/verify/", {
      method: "POST",
      json: {
        product_id: payload.product_id,
        transaction_id: txId,
        package_id: payload.package_id,
        receipt_data: payload.receipt_data,
        purchase_token: payload.purchase_token,
        original_transaction_id: payload.original_transaction_id,
        environment: payload.environment,
      },
    })
  );

  if (!res.ok) {
    return { success: false, error: res.error || "Doğrulama isteği başarısız." };
  }

  const body = res.data ?? {};
  const success = body.success === true;
  if (success) {
    processedTransactionIds.add(txId);
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

/** Yüklenen ürün listesinde productId ile fiyat metnini bul. */
export function findStorePrice(products: IapProductInfo[], productId: string): string | null {
  return products.find((p) => p.productId === productId)?.localizedPrice ?? null;
}

export { ALL_IAP_SKUS };
