/**
 * Havale / EFT ödeme API — web BillingCheckoutPage ile aynı uçlar.
 */

import { authFormFetch, authJsonFetch } from "./apiClient";

export interface HavaleBankAccount {
  id: number;
  bank_slug: string;
  bank_name: string;
  display_name: string;
  iban: string;
  account_holder_name: string;
  logo_url?: string;
  qr_image_url?: string;
  sort_order?: number;
}

export interface HavalePaymentRequest {
  id: number;
  payment_reference: string;
  amount: number;
  currency: string;
  payment_status: string;
  package_id?: number;
  package_name?: string;
  package_code?: string;
  bank_account_id?: number;
  ai_review_required?: boolean;
  ai_auto_approved?: boolean;
  ai_confidence_score?: number | null;
  admin_note?: string;
  audit_logs?: Array<{
    action: string;
    old_status: string;
    new_status: string;
    note: string;
    created_at: string;
  }>;
}

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: string };

function unwrap<T>(res: { ok: boolean; data?: ApiEnvelope<T> | T; error?: string }): { value: T | null; error?: string } {
  if (!res.ok) {
    return { value: null, error: res.error || "İstek başarısız." };
  }
  const body = res.data as ApiEnvelope<T> | T | undefined;
  if (body && typeof body === "object" && "success" in (body as object)) {
    const env = body as ApiEnvelope<T>;
    if (env.success === false) {
      return { value: null, error: env.error || "İstek başarısız." };
    }
    if ("data" in env) return { value: env.data ?? null };
  }
  return { value: (body as T) ?? null };
}

export async function listBankAccounts(): Promise<HavaleBankAccount[]> {
  const res = await authJsonFetch<ApiEnvelope<HavaleBankAccount[]>>("/api/bank-accounts/");
  return unwrap(res).value || [];
}

export async function createPaymentRequest(
  packageId: number,
  bankAccountId: number
): Promise<{ data: HavalePaymentRequest | null; error?: string }> {
  const res = await authJsonFetch<ApiEnvelope<HavalePaymentRequest>>("/api/payment-requests/create/", {
    method: "POST",
    json: { package_id: packageId, bank_account_id: bankAccountId },
  });
  return unwrap(res);
}

export async function getPaymentRequest(id: number): Promise<HavalePaymentRequest | null> {
  const res = await authJsonFetch<ApiEnvelope<HavalePaymentRequest>>(`/api/payment-requests/${id}/`);
  return unwrap(res).value;
}

export async function uploadReceipt(
  paymentRequestId: number,
  bankAccountId: number,
  file: { uri: string; name: string; type: string }
): Promise<{ data: HavalePaymentRequest | null; error?: string }> {
  const form = new FormData();
  form.append("receipt", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  form.append("bank_account_id", String(bankAccountId));
  const res = await authFormFetch<ApiEnvelope<HavalePaymentRequest>>(
    `/api/payment-requests/${paymentRequestId}/upload-receipt/`,
    form
  );
  return unwrap(res);
}
