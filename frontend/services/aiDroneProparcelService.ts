/**
 * AI Drone ProParcel — sizin yerinize üretim talebi API
 */

import { DJANGO_API_URL } from "../config/api";
import { storageService } from "./storageService";
import { authService } from "./authService";

export type AiDroneParcelPayload = {
  mahalleTkgmValue: number | string;
  mahalle: string;
  ada: string;
  parsel: string;
  city?: string;
  town?: string;
  proparcelValue?: number | string | null;
};

export type CreateAiDroneRequestBody = {
  parcel: AiDroneParcelPayload;
  tkgmSummary: string;
  userNote: string;
  showUserCard: boolean;
  idempotencyKey: string;
};

export type CreateAiDroneRequestResult = {
  success: boolean;
  requestId?: number;
  status?: string;
  creditsUsed?: number;
  newBalance?: number;
  showUserCard?: boolean;
  error?: string;
  required?: number;
  balance?: number;
};

async function authPostJson<T>(endpoint: string, body: object): Promise<T & { success?: boolean }> {
  const url = `${DJANGO_API_URL}${endpoint}`;
  let accessToken = await storageService.getAccessToken();
  if (!accessToken) {
    const refreshed = await authService.refreshToken();
    accessToken = refreshed ? await storageService.getAccessToken() : null;
  }
  if (!accessToken) {
    return { success: false, error: "Oturum bulunamadı. Lütfen giriş yapın." } as T & { success?: boolean };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(body),
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    return {
      success: false,
      error: String(data.error || data.message || `HTTP ${res.status}`),
      required: data.required as number | undefined,
      balance: data.balance as number | undefined,
    } as T & { success?: boolean };
  }

  return data as T & { success?: boolean };
}

export const aiDroneProparcelService = {
  async createRequest(body: CreateAiDroneRequestBody): Promise<CreateAiDroneRequestResult> {
    const result = await authPostJson<CreateAiDroneRequestResult>(
      "/api/ai-drone-proparcel/requests/",
      body,
    );
    if (result.success === undefined && result.requestId) {
      return { ...result, success: true };
    }
    return result;
  },
};
