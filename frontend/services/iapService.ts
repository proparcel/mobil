/**
 * Apple In-App Purchase servis katmanı (iOS only).
 * Android bu modülü kullanmaz; tüm fonksiyonlar Platform.OS !== 'ios' iken no-op döner.
 */

import { Platform } from "react-native";
import { authJsonFetch } from "./apiClient";
import {
  ALL_IAP_SKUS,
  IAP_IOS_SUBSCRIPTION_SKUS,
  IAP_IOS_CONSUMABLE_SKUS,
  isKnownIapProductId,
  isConsumableProductId,
  isLicenseProductId,
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
  currency?: string;
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
  /** Apple'ın çektiği tutar (JWS veya mağaza fiyatından) */
  amount_paid?: number;
  currency?: string;
  /** Apple'ın formatladığı fiyat metni, örn. ₺499,99 */
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

const IS_IOS = Platform.OS === "ios";

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
let cachedStoreProducts: IapProductInfo[] = [];

async function getIap(): Promise<IapModule | null> {
  if (!IS_IOS) return null;
  if (iapModule) return iapModule;
  try {
    // dynamic import() Metro async chunk'ta Nitro alt modüllerini kırıyor (unknown module "2428")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-iap") as IapModule;
    if (typeof mod.initConnection !== "function") {
      console.error(
        "[iapService] react-native-iap initConnection yok — Metro cache temizleyip uygulamayı yeniden yükleyin"
      );
      return null;
    }
    iapModule = mod;
    return iapModule;
  } catch (e) {
    console.error("[iapService] react-native-iap yüklenemedi", e);
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
  const iosPurchase = purchase as Purchase & { transactionId?: string };
  if (iosPurchase.transactionId) {
    return String(iosPurchase.transactionId);
  }
  if (purchase.purchaseToken) {
    const payload = decodeJwsPayload(purchase.purchaseToken);
    const fromJws = payload.transactionId ?? payload.originalTransactionId;
    if (fromJws) {
      return String(fromJws);
    }
  }
  if (purchase.id) {
    return String(purchase.id);
  }
  return String(purchase.productId);
}

function mapProduct(p: Product, type: "subs" | "in-app"): IapProductInfo {
  const anyP = p as Product & {
    localizedPrice?: string;
    displayPrice?: string;
    price?: number;
    currency?: string;
  };
  return {
    productId: p.id,
    title: p.title,
    description: p.description,
    localizedPrice: anyP.localizedPrice || anyP.displayPrice || "",
    price: anyP.price ?? undefined,
    currency: anyP.currency || undefined,
    type,
  };
}

function decodeJwsPayload(signed: string): Record<string, unknown> {
  if (!signed || !signed.includes(".")) return {};
  try {
    const payloadB64 = signed.split(".")[1];
    if (!payloadB64) return {};
    const padding = 4 - (payloadB64.length % 4);
    const normalized = payloadB64 + (padding !== 4 ? "=".repeat(padding) : "");
    const raw = globalThis.atob
      ? globalThis.atob(normalized.replace(/-/g, "+").replace(/_/g, "/"))
      : "";
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatAppleAmount(price: number, currency?: string): string {
  const cur = (currency || "").trim().toUpperCase();
  const formatted = price.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (cur === "TRY") return `₺${formatted}`;
  if (cur) return `${formatted} ${cur}`;
  return formatted;
}

/** StoreKit Purchase nesnesinde fiyat yok; JWS (purchaseToken) veya katalogdan okunur. */
function extractPurchaseAmount(purchase: Purchase): Pick<ValidateReceiptResult, "amount_paid" | "currency" | "display_price"> {
  const anyPurchase = purchase as Purchase & {
    displayPrice?: string;
    price?: number;
    currency?: string;
  };

  if (anyPurchase.displayPrice) {
    return {
      display_price: anyPurchase.displayPrice,
      amount_paid: typeof anyPurchase.price === "number" ? anyPurchase.price : undefined,
      currency: anyPurchase.currency || undefined,
    };
  }

  const token = purchase.purchaseToken;
  if (token) {
    const payload = decodeJwsPayload(token);
    const rawPrice = payload.price;
    const currency = String(payload.currency || "").trim() || undefined;
    if (typeof rawPrice === "number" && rawPrice > 0) {
      const amountPaid = rawPrice / 1000;
      return {
        amount_paid: amountPaid,
        currency,
        display_price: formatAppleAmount(amountPaid, currency),
      };
    }
  }

  const catalog = cachedStoreProducts.find((p) => p.productId === purchase.productId);
  if (catalog?.localizedPrice) {
    return {
      display_price: catalog.localizedPrice,
      amount_paid: catalog.price,
      currency: catalog.currency,
    };
  }

  return {};
}

function enrichReceiptResult(result: ValidateReceiptResult, purchase: Purchase): ValidateReceiptResult {
  const amount = extractPurchaseAmount(purchase);
  console.log("[IAP] PURCHASE AMOUNT", JSON.stringify({ ...amount, productId: purchase.productId }, null, 2));
  return {
    ...result,
    amount_paid: result.amount_paid ?? amount.amount_paid,
    currency: result.currency ?? amount.currency,
    display_price: result.display_price ?? amount.display_price,
  };
}

async function handlePurchaseUpdate(purchase: Purchase): Promise<void> {
  const iap = await getIap();
  if (!iap) return;

  const txId = purchaseKey(purchase);
  if (validatingTransactionIds.has(txId)) {
    return;
  }
  const waiter = pendingPurchaseResolvers.get(purchase.productId);

  if (processedTransactionIds.has(txId)) {
    try {
      await iap.finishTransaction({
        purchase,
        isConsumable: isConsumableProductId(purchase.productId),
      });
    } catch {
      /* already finished */
    }
    if (waiter) {
      waiter.resolve(
        enrichReceiptResult(
          {
            success: true,
            already_processed: true,
            transaction_id: txId,
            message: "Satın almanız daha önce işlenmişti. Bakiyeniz güncellendi.",
          },
          purchase
        )
      );
    }
    return;
  }

  const packageId = waiter?.packageId;

  validatingTransactionIds.add(txId);
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
      action_type: waiter?.actionType,
      reference_id: waiter?.referenceId,
      description: waiter?.description,
    });

    if (result.success) {
      processedTransactionIds.add(txId);
      await iap.finishTransaction({
        purchase,
        isConsumable: isConsumableProductId(purchase.productId),
      });
      waiter?.resolve(enrichReceiptResult(result, purchase));
    } else {
      const err = new Error(result.error || result.message || "Sunucu doğrulaması başarısız.");
      waiter?.reject(err);
    }
  } catch (err) {
    waiter?.reject(err instanceof Error ? err : new Error(String(err)));
  } finally {
    validatingTransactionIds.delete(txId);
  }
}

function attachListeners(iap: IapModule): void {
  if (purchaseUpdateSub) purchaseUpdateSub.remove();
  if (purchaseErrorSub) purchaseErrorSub.remove();

  purchaseUpdateSub = iap.purchaseUpdatedListener((purchase) => {
    console.log("[IAP] PURCHASE UPDATED", JSON.stringify(purchase, null, 2));
    void handlePurchaseUpdate(purchase);
  });

  purchaseErrorSub = iap.purchaseErrorListener((error: PurchaseError) => {
    console.error("[IAP] PURCHASE LISTENER ERROR", JSON.stringify(error, null, 2));
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

async function processPendingTransactions(productId?: string): Promise<void> {
  const iap = await getIap();
  if (!iap?.getPendingTransactionsIOS) return;
  try {
    const pending = await iap.getPendingTransactionsIOS();
    for (const purchase of pending) {
      if (productId && purchase.productId !== productId) continue;
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

  console.log("[IAP] SUB SKUS", IAP_IOS_SUBSCRIPTION_SKUS);

  const subs = await iap.fetchProducts({
    skus: [...IAP_IOS_SUBSCRIPTION_SKUS],
    type: "subs",
  });

  console.log("[IAP] SUB PRODUCTS", JSON.stringify(subs, null, 2));

  const consumables = IAP_IOS_CONSUMABLE_SKUS.length
    ? await iap.fetchProducts({
        skus: [...IAP_IOS_CONSUMABLE_SKUS],
        type: "in-app",
      })
    : [];

  console.log("[IAP] CONSUMABLE PRODUCTS", JSON.stringify(consumables, null, 2));

  const subRows = (subs ?? []).map((p) => mapProduct(p, "subs"));
  const consumableRows = (consumables ?? []).map((p) => mapProduct(p, "in-app"));
  cachedStoreProducts = [...subRows, ...consumableRows];
  return cachedStoreProducts;
}

/** Belirli bir ürünü satın alır; sonuç backend doğrulamasından sonra döner. */
export async function purchaseProduct(
  productId: string,
  options: PurchaseProductOptions = {}
): Promise<ValidateReceiptResult> {
  if (!IS_IOS) {
    throw new Error("Uygulama içi ödeme yalnızca iOS'ta kullanılabilir.");
  }

  await initializeIAP();
  const iap = await getIap();
  if (!iap) throw new Error("Ödeme modülü yüklenemedi.");

  if (!isKnownIapProductId(productId) && !isLicenseProductId(productId)) {
    throw new Error(`Geçersiz ürün kimliği: ${productId}`);
  }

  const purchaseType = isConsumableProductId(productId) ? "in-app" : "subs";

  return new Promise<ValidateReceiptResult>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (!pendingPurchaseResolvers.has(productId)) return;
      pendingPurchaseResolvers.delete(productId);
      reject(
        new Error(
          "Satın alma yanıtı alınamadı. Ödeme tamamlandıysa «Satın Almaları Geri Yükle» deneyin."
        )
      );
    }, 120_000);

    const settle = (
      fn: (value: ValidateReceiptResult | PromiseLike<ValidateReceiptResult>) => void,
      value: ValidateReceiptResult
    ) => {
      clearTimeout(timeoutId);
      pendingPurchaseResolvers.delete(productId);
      fn(value);
    };

    const fail = (err: unknown) => {
      clearTimeout(timeoutId);
      pendingPurchaseResolvers.delete(productId);
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    pendingPurchaseResolvers.set(productId, {
      resolve: (result) => settle(resolve, result),
      reject: (err) => fail(err),
      packageId: options.packageId,
      actionType: options.actionType,
      referenceId: options.referenceId,
      description: options.description,
    });

    console.log("[IAP] PURCHASE START", {
      productId,
      purchaseType,
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
        console.error("[IAP] PURCHASE ERROR", JSON.stringify(err, null, 2));
        fail(err);
      });

    // Sandbox'ta listener bazen geç gelir — kuyruktaki işlemi yokla
    [2000, 6000].forEach((delayMs) => {
      setTimeout(() => {
        if (pendingPurchaseResolvers.has(productId)) {
          void processPendingTransactions(productId);
        }
      }, delayMs);
    });
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
    return { success: false, error: "Uygulama içi ödeme yalnızca iOS'ta desteklenir." };
  }

  const txId = payload.transaction_id?.trim();
  if (!txId) {
    return { success: false, error: "transaction_id gerekli." };
  }
  if (txId.startsWith("com.proparcel.")) {
    return {
      success: false,
      error: "StoreKit işlem kimliği alınamadı. Uygulamayı yeniden başlatıp tekrar deneyin.",
    };
  }
  if (processedTransactionIds.has(txId)) {
    return { success: true, already_processed: true, transaction_id: txId, message: "İşlem zaten işlendi." };
  }

  console.log("[IAP] VALIDATE RECEIPT START", {
    product_id: payload.product_id,
    transaction_id: txId,
    has_jws: Boolean(payload.purchase_token),
    environment: payload.environment,
  });

  try {
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
      }>("/api/payments/apple/verify/", {
        method: "POST",
        json: {
          product_id: payload.product_id,
          transaction_id: txId,
          package_id: payload.package_id,
          receipt_data: payload.receipt_data,
          purchase_token: payload.purchase_token,
          signed_transaction: payload.purchase_token,
          original_transaction_id: payload.original_transaction_id,
          environment: payload.environment,
          action_type: payload.action_type,
          reference_id: payload.reference_id,
          description: payload.description,
        },
      })
    );

    if (!res.ok) {
      const code = res.payload?.error_code;
      return {
        success: false,
        error: res.error || "Doğrulama isteği başarısız.",
        message: typeof res.payload?.message === "string" ? res.payload.message : undefined,
        ...(typeof code === "string" ? { error_code: code } : {}),
      };
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
  } catch (error) {
    console.error("[IAP] VALIDATE RECEIPT ERROR", JSON.stringify(error, null, 2));
    throw error;
  }
}

/** Yüklenen ürün listesinde productId ile fiyat metnini bul. */
export function findStorePrice(products: IapProductInfo[], productId: string): string | null {
  return products.find((p) => p.productId === productId)?.localizedPrice ?? null;
}

export { ALL_IAP_SKUS };
