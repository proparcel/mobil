/**
 * 3D Model Usage Count API Service
 * 
 * Handles all API calls related to model usage tracking:
 * - Fetching models with usage counts
 * - Decrementing usage when model is used
 * - Fetching owned models
 */

import { API_URL } from "../../config/api";
import { storageService } from "../../services/storageService";
import { authService } from "../../services/authService";
import type {
  ModelsListResponse,
  ModelWithUsage,
  DecrementUsageResponse,
  OwnedModelsResponse,
  OwnedModel,
} from "../types/models";

const API_BASE = API_URL.replace(/\/$/, ""); // Remove trailing slash

/**
 * Ensure access token is fresh (refresh if we have refresh token).
 * Call before model API requests to avoid ExpiredTokenError.
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

function hasAuthHeader(h: Record<string, string>): boolean {
  return !!(h["Authorization"] && String(h["Authorization"]).startsWith("Bearer "));
}

/**
 * Fetch models list with usage counts from backend
 * 
 * @returns Promise with models grouped by category
 */
export async function fetchModelsWithUsage(): Promise<ModelsListResponse> {
  const url = `${API_BASE}/api/3d-models-list/?platform=mobil`;
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data !== "object") {
      throw new Error("Invalid API response format");
    }

    return data as ModelsListResponse;
  } catch (error) {
    console.error("[modelUsageService] fetchModelsWithUsage error:", error);
    throw error;
  }
}

/**
 * Decrement usage count for a model
 * 
 * @param modelId - Model ID to decrement usage for
 * @returns Promise with updated remaining_uses count
 */
export async function decrementModelUsage(modelId: number): Promise<DecrementUsageResponse> {
  await ensureFreshToken();
  const url = `${API_BASE}/api/3d-models/decrement-usage/`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({ model_id: modelId }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `API request failed: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Validate response structure
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid API response format");
    }

    return {
      success: data.success === true,
      remaining_uses: data.remaining_uses ?? null,
      error: data.error,
    } as DecrementUsageResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Handle different error types
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      console.warn("[modelUsageService] decrementModelUsage timeout:", error);
      throw new Error("İstek zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.");
    }
    
    if (error?.message?.includes("Network request failed") || error?.message?.includes("Failed to fetch")) {
      console.warn("[modelUsageService] decrementModelUsage network error:", error);
      throw new Error("Backend'e bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.");
    }
    
    console.error("[modelUsageService] decrementModelUsage error:", error);
    throw error;
  }
}

/**
 * Fetch owned models for current user
 * 
 * @returns Promise with list of owned models
 */
export async function fetchOwnedModels(): Promise<OwnedModel[]> {
  await ensureFreshToken();
  const token = await storageService.getAccessToken();
  const url = `${API_BASE}/api/3d-models/owned/`;
  const headers = await getHeaders();
  const withAuth = hasAuthHeader(headers);

  console.log("[fetchOwnedModels] Başlıyor:", {
    url,
    bearer: withAuth,
    tokenAfterRefresh: !!token,
    tokenLen: token ? token.length : 0,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
    const raw = await response.text();

    console.log("[fetchOwnedModels] Yanıt:", {
      status: response.status,
      ok: response.ok,
      contentType: contentType.slice(0, 50),
      rawLen: raw.length,
      rawStart: raw.trimStart().slice(0, 120),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}${raw ? ` - ${raw.slice(0, 100)}` : ""}`);
    }

    if (!raw.trim() || contentType.includes("text/html") || raw.trimStart().startsWith("<")) {
      console.warn("[fetchOwnedModels] HTML/boş yanıt (auth redirect?), boş liste dönülüyor");
      return [];
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn("[fetchOwnedModels] Geçersiz JSON, boş liste dönülüyor. rawStart:", raw.slice(0, 150));
      return [];
    }

    if (!data || typeof data !== "object") {
      console.warn("[fetchOwnedModels] data obje değil, boş liste");
      return [];
    }

    const responseData = data as OwnedModelsResponse;
    const list = responseData.owned_models || [];
    console.log("[fetchOwnedModels] owned_models sayısı:", list.length, list.length ? "örnek:" : "", list.length ? JSON.stringify(list.slice(0, 2)) : "");
    return list;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      console.warn("[modelUsageService] fetchOwnedModels timeout:", error);
      throw new Error("İstek zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.");
    }
    
    if (error?.message?.includes("Network request failed") || error?.message?.includes("Failed to fetch")) {
      console.warn("[modelUsageService] fetchOwnedModels network error:", error);
      throw new Error("Backend'e bağlanılamadı. Lütfen internet bağlantınızı ve backend sunucusunun çalıştığını kontrol edin.");
    }
    
    console.error("[modelUsageService] fetchOwnedModels error:", error);
    throw error;
  }
}

/**
 * Helper function to check if a model is usable
 * 
 * @param remainingUses - Remaining uses count (null = unlimited)
 * @returns true if model can be used
 */
export function isModelUsable(remainingUses: number | null): boolean {
  if (remainingUses === null) return true; // Unlimited
  return remainingUses > 0;
}

/**
 * Helper function to format usage count for display
 * 
 * @param remainingUses - Remaining uses count (null = unlimited)
 * @returns Formatted string for display
 */
export function formatUsageCount(remainingUses: number | null): string {
  if (remainingUses === null) return "Sınırsız";
  if (remainingUses === 0) return "0";
  return `Kalan: ${remainingUses}`;
}
