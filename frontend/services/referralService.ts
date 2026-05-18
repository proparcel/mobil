import { authJsonFetch } from "./apiClient";

export async function getReferralCode(): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ code: string; is_active: boolean }>("/api/referral/code/", { method: "GET" });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, code: res.data.code };
}

export async function claimReferral(code: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success: boolean; message?: string; error?: string }>("/api/referral/claim/", {
    method: "POST",
    json: { code },
  });
  if (!res.ok) return { ok: false, error: res.error };
  if (res.data?.success) return { ok: true, message: res.data.message || "OK" };
  return { ok: false, error: res.data?.error || "İşlem başarısız" };
}

export async function activateReferral(): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success: boolean; message?: string; error?: string }>("/api/referral/activate/", {
    method: "POST",
    json: {},
  });
  if (!res.ok) return { ok: false, error: res.error };
  if (res.data?.success) return { ok: true, message: res.data.message || "OK" };
  return { ok: false, error: res.data?.error || "İşlem başarısız" };
}

