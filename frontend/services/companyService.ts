/**
 * ProParcel Company Service
 * 
 * Firma bağlantı işlemleri için API servisi.
 */

import { DJANGO_API_URL } from "../config/api";
import { storageService } from "./storageService";
import { authService } from "./authService";
import type {
  ApiResponse,
  CompanyProfile,
  CompanyMembershipRequest,
  CompanyCreditAllocationsData,
} from "../src/types/auth";

// API Endpoints (Tümü JWT destekli)
const COMPANY_ENDPOINTS = {
  SEARCH: "/api/auth/company/exists/",
  REQUEST: "/api/profile/company/request/",
  APPROVE: (requestId: number) => `/api/profile/company/approve/${requestId}/`,
  REJECT: (requestId: number) => `/api/profile/company/reject/${requestId}/`,
  REMOVE_MEMBER: (userId: number) => `/api/profile/company/remove-member/${userId}/`,
  LEAVE: "/api/profile/company/leave/",
  CREDIT_ALLOCATIONS: "/api/profile/company/credit-allocations/",
  CREDIT_ALLOCATION: (userId: number) =>
    `/api/profile/company/credit-allocations/${userId}/`,
} as const;

function isCreditAllocationsPayload(value: unknown): value is CompanyCreditAllocationsData {
  if (!value || typeof value !== "object") return false;
  const o = value as CompanyCreditAllocationsData;
  return Array.isArray(o.items) || typeof o.company_balance === "number";
}

/** Fetch Response gövdesini yalnızca bir kez oku (json + text çift okuma → Already read). */
async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function messageFromErrorBody(text: string, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("<")) {
    return fallback;
  }
  try {
    const errorData = JSON.parse(trimmed) as Record<string, unknown>;
    return String(
      errorData.message || errorData.error || errorData.detail || fallback,
    );
  } catch {
    return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed;
  }
}

/** Web `normalizeApiData` + `data?.data || data` ile aynı ayrıştırma */
export function parseCreditAllocationsEnvelope(
  body: unknown,
): ApiResponse<CompanyCreditAllocationsData> {
  if (!body || typeof body !== "object") {
    return { success: false, message: "Geçersiz sunucu yanıtı." };
  }
  const root = body as Record<string, unknown>;
  if (root.success === false) {
    return {
      success: false,
      message: String(root.message || root.error || "Kredi payları alınamadı."),
    };
  }
  const layer = root.data ?? root;
  const payload =
    isCreditAllocationsPayload(layer)
      ? layer
      : isCreditAllocationsPayload((layer as Record<string, unknown>)?.data)
        ? ((layer as Record<string, unknown>).data as CompanyCreditAllocationsData)
        : null;
  if (!payload) {
    return {
      success: false,
      message: String(root.message || "Kredi payları yanıtı okunamadı."),
    };
  }
  return {
    success: true,
    message: String(root.message || ""),
    data: {
      items: Array.isArray(payload.items) ? payload.items : [],
      company_balance: Number(payload.company_balance ?? 0),
    },
  };
}

/**
 * HTTP request helper with auth header
 */
async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${DJANGO_API_URL}${endpoint}`;
  let accessToken = await storageService.getAccessToken();
  const refreshToken = await storageService.getRefreshToken();
  if (!accessToken && refreshToken) {
    const refreshed = await authService.refreshToken();
    accessToken = refreshed ? await storageService.getAccessToken() : null;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    let response = await fetch(url, { ...options, headers });

    if (response.status === 401 && endpoint !== "/api/auth/token/refresh/" && refreshToken) {
      const refreshed = await authService.refreshToken();
      const newToken = refreshed ? await storageService.getAccessToken() : null;
      if (newToken) {
        response = await fetch(url, {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
        });
      }
    }

    const text = await readResponseBody(response);

    if (!response.ok) {
      const errorMessage = messageFromErrorBody(
        text,
        `API request failed: ${response.status} ${response.statusText}`,
      );
      return { success: false, message: errorMessage } as ApiResponse<T>;
    }

    if (!text.trim()) {
      return { success: false, message: "Boş sunucu yanıtı." } as ApiResponse<T>;
    }
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json") && text.trim().startsWith("<")) {
      return {
        success: false,
        message: "Beklenmeyen yanıt formatı. Lütfen tekrar deneyin.",
      } as ApiResponse<T>;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { success: false, message: "JSON yanıt okunamadı." } as ApiResponse<T>;
    }
    return parsed as ApiResponse<T>;
  } catch (error) {
    console.error(`[companyService.ts] API hatası (${endpoint}):`, error);
    return {
      success: false,
      message: "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.",
    };
  }
}

/**
 * Form data ile POST request (CSRF token için)
 */
async function authFormPost<T>(
  endpoint: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  await authService.refreshToken();
  const url = `${DJANGO_API_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };

  const accessToken = await storageService.getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    const text = await readResponseBody(response);

    if (!response.ok) {
      const errorMessage = messageFromErrorBody(
        text,
        `API request failed: ${response.status} ${response.statusText}`,
      );
      return { success: false, message: errorMessage } as ApiResponse<T>;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json") && text.trim()) {
      try {
        return JSON.parse(text) as ApiResponse<T>;
      } catch {
        return { success: false, message: "JSON yanıt okunamadı." } as ApiResponse<T>;
      }
    }

    // Redirect döndürüyorsa başarılı sayılabilir
    return {
      success: true,
      message: "İşlem başarıyla tamamlandı.",
    } as ApiResponse<T>;
  } catch (error) {
    console.error(`[companyService.ts] API hatası (${endpoint}):`, error);
    return {
      success: false,
      message: "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.",
    };
  }
}

/**
 * Company Service - Firma bağlantı işlemleri
 */
class CompanyService {
  /**
   * Vergi numarasına göre firma ara
   */
  async searchCompanyByVergiNo(
    vergiNo: string
  ): Promise<ApiResponse<{ company: CompanyProfile }>> {
    // Vergi numarasını normalize et (sadece rakamlar)
    const normalized = vergiNo.replace(/\D/g, "");

    if (normalized.length !== 10) {
      return {
        success: false,
        message: "Geçerli bir vergi numarası girin (10 haneli).",
      };
    }

    // /api/auth/company/exists/ endpoint'i farklı format döndürüyor
    // { success, message, data: { exists, vergi_no, company_name } }
    const response = await authFetch<{ exists: boolean; vergi_no: string; company_name?: string; corporate_type?: "emlak" | "spk" | "lihkab" | null }>(
      `${COMPANY_ENDPOINTS.SEARCH}?vergi_no=${normalized}`,
      {
        method: "GET",
      }
    );

    // Response'u CompanyProfile formatına dönüştür
    if (response.success && response.data?.exists) {
      return {
        success: true,
        message: response.message || "Firma bulundu",
        data: {
          company: {
            id: 0, // API bu bilgiyi döndürmüyor, profil sayfasında kullanılmıyor
            company_name: response.data.company_name || "Firma adı belirtilmemiş",
            vergi_no: response.data.vergi_no,
              corporate_type: response.data.corporate_type || null,
          } as CompanyProfile,
        },
      };
    }

    // Firma bulunamadı veya hata
    return {
      success: false,
      message: response.message || "Bu vergi numarasına sahip bir firma bulunamadı.",
    };
  }

  /**
   * Firma bağlantı isteği gönder
   */
  async requestCompanyMembership(
    vergiNo: string
  ): Promise<ApiResponse<{ message: string }>> {
    const normalized = vergiNo.replace(/\D/g, "");

    if (normalized.length !== 10) {
      return {
        success: false,
        message: "Geçerli bir vergi numarası girin (10 haneli).",
      };
    }

    // JSON API ile gönder
    return authFetch<{ message: string }>(
      COMPANY_ENDPOINTS.REQUEST,
      {
        method: "POST",
        body: JSON.stringify({ vergi_no: normalized }),
      }
    );
  }

  /**
   * Firma bağlantı isteğini onayla (kurumsal kullanıcı için)
   */
  async approveCompanyMembership(
    requestId: number
  ): Promise<ApiResponse<{ message: string }>> {
    return authFetch<{ message: string }>(
      COMPANY_ENDPOINTS.APPROVE(requestId),
      {
        method: "POST",
      }
    );
  }

  /**
   * Firma bağlantı isteğini reddet (kurumsal kullanıcı için)
   */
  async rejectCompanyMembership(
    requestId: number
  ): Promise<ApiResponse<{ message: string }>> {
    return authFetch<{ message: string }>(
      COMPANY_ENDPOINTS.REJECT(requestId),
      {
        method: "POST",
      }
    );
  }

  /**
   * Alt kullanıcıyı firmadan çıkar (kurumsal yetkili için)
   */
  async removeCompanyMember(
    userId: number
  ): Promise<ApiResponse<{ message: string }>> {
    return authFetch<{ message: string }>(
      COMPANY_ENDPOINTS.REMOVE_MEMBER(userId),
      {
        method: "POST",
      }
    );
  }

  /**
   * Firmadan çık (bireysel kullanıcı için)
   */
  async leaveCompany(): Promise<ApiResponse<{ message: string }>> {
    return authFetch<{ message: string }>(
      COMPANY_ENDPOINTS.LEAVE,
      {
        method: "POST",
      }
    );
  }

  /** Firma havuzu ve alt kullanıcı aylık kredi payları */
  async getCompanyCreditAllocations(): Promise<ApiResponse<CompanyCreditAllocationsData>> {
    if (__DEV__) {
      console.log(
        "[companyService] GET credit-allocations",
        `${DJANGO_API_URL}${COMPANY_ENDPOINTS.CREDIT_ALLOCATIONS}`,
      );
    }
    const res = await authFetch<unknown>(COMPANY_ENDPOINTS.CREDIT_ALLOCATIONS, {
      method: "GET",
    });
    const parsed = parseCreditAllocationsEnvelope(res);
    if (__DEV__) {
      if (parsed.success) {
        console.log("[companyService] credit-allocations OK", {
          members: parsed.data?.items?.length ?? 0,
          company_balance: parsed.data?.company_balance ?? 0,
        });
      } else {
        console.warn("[companyService] credit-allocations FAIL:", parsed.message, res);
      }
    }
    return parsed;
  }

  /** Alt kullanıcı aylık pay güncelle */
  async updateCompanyCreditAllocation(
    userId: number,
    monthlyLimit: number,
  ): Promise<ApiResponse<{ message?: string; data?: CompanyCreditAllocationsData }>> {
    const res = await authFetch<unknown>(COMPANY_ENDPOINTS.CREDIT_ALLOCATION(userId), {
      method: "POST",
      body: JSON.stringify({ monthly_limit: monthlyLimit }),
    });
    const parsed = parseCreditAllocationsEnvelope(res);
    if (!parsed.success) {
      return { success: false, message: parsed.message || "Pay kaydedilemedi." };
    }
    return {
      success: true,
      message: String((res as { message?: string })?.message || "Pay güncellendi."),
      data: parsed.data,
    };
  }
}

// Singleton instance
export const companyService = new CompanyService();
export default companyService;
