/**
 * ProParcel Company Service
 * 
 * Firma bağlantı işlemleri için API servisi.
 */

import { API_URL } from "../config/api";
import { storageService } from "./storageService";
import { authService } from "./authService";
import type {
  ApiResponse,
  CompanyProfile,
  CompanyMembershipRequest,
} from "../src/types/auth";

// API Endpoints (Tümü JWT destekli)
const COMPANY_ENDPOINTS = {
  SEARCH: "/api/auth/company/exists/",
  REQUEST: "/api/profile/company/request/",
  APPROVE: (requestId: number) => `/api/profile/company/approve/${requestId}/`,
  REJECT: (requestId: number) => `/api/profile/company/reject/${requestId}/`,
  REMOVE_MEMBER: (userId: number) => `/api/profile/company/remove-member/${userId}/`,
  LEAVE: "/api/profile/company/leave/",
} as const;

/**
 * HTTP request helper with auth header
 */
async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  await authService.refreshToken(); // Ensure token is fresh
  const url = `${API_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add auth token
  const accessToken = await storageService.getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        const text = await response.text();
        if (text) {
          errorMessage = text.substring(0, 200);
        }
      }
      return { success: false, message: errorMessage } as ApiResponse<T>;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // Web view redirect döndürüyor olabilir, JSON bekliyoruz
      return {
        success: false,
        message: "Beklenmeyen yanıt formatı. Lütfen tekrar deneyin.",
      } as ApiResponse<T>;
    }

    const data = await response.json();
    return data as ApiResponse<T>;
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
  const url = `${API_URL}${endpoint}`;
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

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        const text = await response.text();
        if (text) {
          errorMessage = text.substring(0, 200);
        }
      }
      return { success: false, message: errorMessage } as ApiResponse<T>;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return data as ApiResponse<T>;
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
}

// Singleton instance
export const companyService = new CompanyService();
export default companyService;
