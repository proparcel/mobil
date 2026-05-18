/**
 * Model Purchase Service
 * 
 * Handles API calls related to model purchases:
 * - Fetching credit balance
 * - Purchasing models
 */

import { API_URL } from "../../config/api";
import { storageService } from "../../services/storageService";
import { authService } from "../../services/authService";

const API_BASE = API_URL.replace(/\/$/, ""); // Remove trailing slash

/**
 * Ensure access token is fresh (refresh if we have refresh token).
 */
async function ensureFreshToken(): Promise<void> {
  await authService.refreshToken();
}

/**
 * Headers for API requests. Adds Authorization Bearer when token exists.
 */
async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  const token = await storageService.getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Credit balance response type
 */
export type CreditBalanceResponse = {
  balance: number;
};

/**
 * Purchase model response type
 */
export type PurchaseModelResponse = {
  success: boolean;
  message?: string;
  error?: string;
  remaining_uses?: number | null;
};

/**
 * Fetch current credit balance
 * 
 * @returns Promise with credit balance
 */
export async function fetchCreditBalance(): Promise<CreditBalanceResponse> {
  await ensureFreshToken();
  const url = `${API_BASE}/api/credit/balance/`;
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: await getHeaders(),
    });

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.text();
        // Check if it's HTML (likely a login page)
        if (errorData.trim().startsWith('<')) {
          errorMessage = "Authentication failed. Please login again.";
        } else {
          const parsed = JSON.parse(errorData);
          errorMessage = parsed.error || parsed.detail || errorMessage;
        }
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data !== "object") {
      throw new Error("Invalid API response format");
    }

    // Response format: { balance, total_purchased, total_used }
    // We only need balance for the modal
    return {
      balance: data.balance || 0,
    } as CreditBalanceResponse;
  } catch (error) {
    console.error("[modelPurchaseService] fetchCreditBalance error:", error);
    throw error;
  }
}

/**
 * Purchase a model
 * 
 * @param modelId - Model ID to purchase
 * @returns Promise with purchase result
 */
export async function purchaseModel(modelId: number): Promise<PurchaseModelResponse> {
  await ensureFreshToken();
  const url = `${API_BASE}/api/3d-models/purchase/`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({ model_id: modelId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data !== "object") {
      throw new Error("Invalid API response format");
    }

    return data as PurchaseModelResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[modelPurchaseService] purchaseModel error:", error);
    
    // Handle abort/timeout
    if (error?.name === "AbortError") {
      throw new Error("Satın alma işlemi zaman aşımına uğradı. Lütfen tekrar deneyin.");
    }
    
    throw error;
  }
}
