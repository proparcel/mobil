/**
 * ProParcel Credit Service
 * 
 * Backend credit API ile iletişim.
 */

import { DJANGO_API_URL } from "../config/api";
import { storageService } from "./storageService";
import { authService } from "./authService";
import type { ApiResponse } from "../src/types/auth";

// API Endpoints
const CREDIT_ENDPOINTS = {
  BALANCE: "/api/credit/balance/",
  STATS: "/api/credit/stats/",
  HISTORY: "/api/credit/history/",
  CHECK: "/api/credit/check/",
  USE: "/api/credit/use/",
  COSTS: "/api/credit/costs/",
  PACKAGES: "/api/packages/",
  PURCHASE: "/api/packages/purchase/",
  VALIDATE_COUPON: "/api/credit/validate-coupon/",
  /** GET ?reference_id= — 3D tasarım (parsel) lisansı var mı */
  LICENSE_3D: "/api/credit/3d-design-license/",
  /** GET — Web "3D Tasarımlarım" ile aynı liste (CreditUsage 3d_design) */
  LICENSES_3D_LIST: "/api/credit/3d-design-licenses/",
  /** POST { reference_id } — lisans kaydını sil (kredi iadesi yok) */
  LICENSE_3D_DELETE: "/api/credit/3d-design-license/delete/",
} as const;

/**
 * HTTP request helper with auth header
 */
async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  config: { requireAuth?: boolean } = {}
): Promise<ApiResponse<T>> {
  const url = `${DJANGO_API_URL}${endpoint}`;
  const requiresAuth = config.requireAuth !== false;

  // Önce mevcut token ile dene; refresh sadece 401 alırsak yapılacak
  let accessToken = await storageService.getAccessToken();
  const refreshToken = await storageService.getRefreshToken();
  if (requiresAuth && !accessToken && !refreshToken) {
    return {
      success: false,
      message: "Oturum bulunamadı. Lütfen giriş yapın.",
    } as ApiResponse<T>;
  }
  if (requiresAuth && !accessToken) {
    const refreshed = await authService.refreshToken();
    accessToken = refreshed ? (await storageService.getAccessToken()) : null;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  if (__DEV__ && (endpoint === CREDIT_ENDPOINTS.PURCHASE || endpoint === CREDIT_ENDPOINTS.BALANCE)) {
    console.log(`[creditService] ${endpoint} isteği: token=${accessToken ? "var" : "yok"}, url=${url}`);
  }

  try {
    let response = await fetch(url, {
      ...options,
      headers,
    });

    // 401: Önce bir kez refresh dene, tekrar istek at
    if (response.status === 401 && endpoint !== "/api/auth/token/refresh/" && !!refreshToken) {
      const refreshed = await authService.refreshToken();
      const newToken = refreshed ? await storageService.getAccessToken() : null;
      if (newToken) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        };
        response = await fetch(url, { ...options, headers: retryHeaders });
      }
    }

    // Hata: Gerçek sebebi logla ve kullanıcıya anlamlı mesaj göster
    if (!response.ok) {
      const errorData = await response.text();
      const isHtml = errorData.trim().startsWith('<');
      let errorMessage: string;
      try {
        if (isHtml) {
          errorMessage = `İşlem yapılamadı (HTTP ${response.status}). Sunucu beklenmeyen yanıt verdi. Lütfen tekrar deneyin.`;
          if (__DEV__) {
            console.warn(`[creditService] ${endpoint} HTTP ${response.status} – HTML yanıt (ilk 200 karakter):`, errorData.slice(0, 200));
          }
        } else {
          const parsed = JSON.parse(errorData) as { error?: string; detail?: string; message?: string };
          errorMessage = parsed.error || parsed.detail || parsed.message || `İşlem yapılamadı (HTTP ${response.status}).`;
          if (__DEV__) {
            console.warn(`[creditService] ${endpoint} HTTP ${response.status}:`, parsed);
          }
        }
      } catch {
        errorMessage = `İşlem yapılamadı (HTTP ${response.status}). Lütfen tekrar deneyin.`;
      }
      return {
        success: false,
        message: errorMessage,
      } as ApiResponse<T>;
    }

    // Check content type before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim().startsWith('<')) {
        if (__DEV__) {
          console.warn(`[creditService] ${endpoint} 200 ama HTML yanıt:`, text.slice(0, 200));
        }
        return {
          success: false,
          message: "Sunucu beklenmeyen yanıt verdi. Lütfen tekrar deneyin.",
        } as ApiResponse<T>;
      }
    }

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (error) {
    console.error(`[creditService.ts] API hatası (${endpoint}):`, error);
    return {
      success: false,
      message: "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.",
    };
  }
}

// Type definitions
export interface CreditBalance {
  balance: number;
  earned_balance: number;
  purchased_balance: number;
  total_purchased: number;
  total_earned: number;
  total_used: number;
}

export interface CreditStats {
  balance: number;
  earned_balance: number;
  purchased_balance: number;
  total_purchased: number;
  total_earned: number;
  total_used: number;
  usage_last_30_days: number;
  usage_by_type?: Record<string, number>;
  last_30_days?: number; // alias for usage_last_30_days
  last_7_days?: number;
  total_usage?: number;
  average_per_day?: number;
}

export interface CreditHistoryItem {
  id: number;
  action_type: string;
  action_type_display: string;
  credits_used: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

export interface CreditHistory {
  history: CreditHistoryItem[];
  total_count: number;
}

export interface CreditCheck {
  has_enough: boolean;
  required_credit: number;
  current_balance: number;
}

export interface CreditUseResult {
  success: boolean;
  message: string;
  new_balance?: number;
  credits_used?: number;
  balance?: number;
  error?: string;
}

export type PackageType = "bireysel" | "kurumsal";

export interface CreditPackage {
  id: number;
  name: string;
  slug: string;
  credits: number;
  price: number;
  duration_months: number;
  monthly_credits?: number;
  description?: string;
  features?: string[];
  is_popular: boolean;
  monthly_price?: number;
  price_per_credit: number;
  package_type?: PackageType;
  is_ek_package?: boolean;
}

export interface PackagesList {
  packages: CreditPackage[];
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  new_balance?: number;
  package?: {
    id: number;
    name: string;
    credits: number;
    price: number;
  };
  error?: string;
}

export interface CreditCostItem {
  action_type: string;
  display_name: string;
  credits: number;
  icon: string;
  icon_fa: string;
  icon_ion: string;
  description?: string;
}

export interface CreditCosts {
  costs: Record<string, number>;
  action_types: Record<string, string>;
  items?: CreditCostItem[];
}

/** Sunucu build_3d_design_licenses_list ile uyumlu */
export interface Parcel3dLicenseRow {
  reference_id: string;
  mahalle: string;
  ada: string;
  parsel: string;
  display_text: string;
  editor_url: string;
  expires_at: string | null;
  created_at: string | null;
}

/**
 * Credit Service - Credit API işlemleri
 */
class CreditService {
  /**
   * Kredi bakiyesini getir (veritabanından güncel bakiye).
   * Backend doğrudan { balance, total_purchased, total_used } döndürür; ApiResponse formatına normalize ediyoruz.
   */
  async getBalance(): Promise<ApiResponse<CreditBalance>> {
    const raw = await authFetch<CreditBalance>(CREDIT_ENDPOINTS.BALANCE, {
      method: "GET",
    });
    if (!raw) {
      return { success: false, message: "Yanıt alınamadı." };
    }
    if (!raw.success && "message" in raw) {
      return raw as ApiResponse<CreditBalance>;
    }
    const data = raw as unknown as CreditBalance;
    const balRaw = (data as any)?.balance;
    const balance =
      typeof balRaw === "number"
        ? balRaw
        : typeof balRaw === "string"
          ? Number(balRaw)
          : NaN;
    if (Number.isFinite(balance)) {
      const num = (v: unknown) =>
        typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
      return {
        success: true,
        message: "",
        data: {
          balance,
          earned_balance: num(data.earned_balance),
          purchased_balance: num(data.purchased_balance),
          total_purchased: num(data.total_purchased),
          total_earned: num(data.total_earned),
          total_used: num(data.total_used),
        },
      };
    }
    return { success: false, message: (raw as any).message || "Bakiye alınamadı." };
  }

  /**
   * Kredi istatistiklerini getir
   */
  async getStats(): Promise<ApiResponse<CreditStats>> {
    return authFetch<CreditStats>(CREDIT_ENDPOINTS.STATS, {
      method: "GET",
    });
  }

  /**
   * Kredi geçmişini getir
   */
  async getHistory(limit: number = 50): Promise<ApiResponse<CreditHistory>> {
    const limitParam = Math.min(limit, 100); // Maksimum 100
    return authFetch<CreditHistory>(
      `${CREDIT_ENDPOINTS.HISTORY}?limit=${limitParam}`,
      {
        method: "GET",
      }
    );
  }

  /**
   * Belirli bir işlem için yeterli kredi var mı kontrol et
   */
  async checkCredit(actionType: string): Promise<ApiResponse<CreditCheck>> {
    return authFetch<CreditCheck>(
      `${CREDIT_ENDPOINTS.CHECK}?action_type=${actionType}`,
      {
        method: "GET",
      }
    );
  }

  /**
   * Kredi kullan
   */
  async useCredit(
    actionType: string,
    description: string = "",
    referenceId?: string
  ): Promise<ApiResponse<CreditUseResult>> {
    return authFetch<CreditUseResult>(CREDIT_ENDPOINTS.USE, {
      method: "POST",
      body: JSON.stringify({
        action_type: actionType,
        description,
        reference_id: referenceId,
      }),
    });
  }

  /**
   * Kredi maliyetlerini getir
   */
  async getCreditCosts(): Promise<ApiResponse<CreditCosts>> {
    return authFetch<CreditCosts>(CREDIT_ENDPOINTS.COSTS, {
      method: "GET",
    }, { requireAuth: false });
  }

  /**
   * Kupon kodunu doğrula
   * POST /api/credit/validate-coupon/
   */
  async validateCoupon(code: string): Promise<ApiResponse<{
    coupon?: { code: string; discount_percent: number };
  }>> {
    return authFetch(CREDIT_ENDPOINTS.VALIDATE_COUPON, {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  /**
   * Bu parsel reference_id için 3D tasarım lisansı var mı (sunucu CreditUsage).
   */
  async check3dDesignLicense(referenceId: string): Promise<boolean> {
    const raw = await authFetch<{ allowed?: boolean; success?: boolean; data?: { allowed?: boolean } }>(
      `${CREDIT_ENDPOINTS.LICENSE_3D}?reference_id=${encodeURIComponent(referenceId)}`,
      { method: "GET" }
    );
    const anyRaw = raw as Record<string, unknown>;
    if (anyRaw && typeof anyRaw.allowed === "boolean") return anyRaw.allowed;
    const d = anyRaw?.data as { allowed?: boolean } | undefined;
    if (d && typeof d.allowed === "boolean") return d.allowed;
    return false;
  }

  /**
   * 3D Tasarımlarım — web /accounts/3d-designs/ ile aynı veri (GET JSON).
   */
  async list3dDesignLicenses(): Promise<{
    ok: boolean;
    licenses: Parcel3dLicenseRow[];
    message?: string;
  }> {
    const raw = await authFetch<unknown>(CREDIT_ENDPOINTS.LICENSES_3D_LIST, { method: "GET" });
    const r = raw as Record<string, unknown> | null;
    const licenses = r && Array.isArray(r["licenses"]) ? (r["licenses"] as Parcel3dLicenseRow[]) : [];
    if (r && r["success"] === true && Array.isArray(r["licenses"])) {
      return { ok: true, licenses };
    }
    if (licenses.length > 0) {
      return { ok: true, licenses };
    }
    return {
      ok: false,
      licenses: [],
      message: typeof r?.["message"] === "string" ? (r["message"] as string) : "3D tasarım listesi alınamadı.",
    };
  }

  /**
   * 3D parsel lisansını kaldır (sunucudaki 3d_design kullanım kaydı). Kredi iadesi yapılmaz.
   */
  async delete3dDesignLicense(referenceId: string): Promise<{ ok: boolean; message?: string }> {
    const raw = await authFetch<{ success?: boolean; message?: string; error?: string }>(
      CREDIT_ENDPOINTS.LICENSE_3D_DELETE,
      {
        method: "POST",
        body: JSON.stringify({ reference_id: referenceId }),
      }
    );
    const r = raw as Record<string, unknown> | null;
    if (r && r["success"] === true) {
      return { ok: true, message: typeof r["message"] === "string" ? (r["message"] as string) : undefined };
    }
    const err =
      (r && (r["error"] as string)) ||
      (r && (r["message"] as string)) ||
      "Lisans kaldırılamadı.";
    return { ok: false, message: err };
  }

  /**
   * Aktif kredi paketlerini listele
   * Not: Authentication gerektirmez - paketler herkese gösterilmeli (ana projedeki gibi)
   */
  async listPackages(): Promise<ApiResponse<PackagesList>> {
    // Paketler authentication gerektirmez, bu yüzden normal fetch kullan
    const url = `${DJANGO_API_URL}${CREDIT_ENDPOINTS.PACKAGES}`;
    
    console.log(`[creditService] listPackages çağrıldı: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });

      console.log(`[creditService] listPackages response:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
      });

      if (!response.ok) {
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.text();
          console.log(`[creditService] listPackages error data:`, errorData.substring(0, 200));
          if (errorData.trim().startsWith('<')) {
            errorMessage = "Paketler yüklenemedi. (HTML response)";
          } else {
            const parsed = JSON.parse(errorData);
            errorMessage = parsed.error || parsed.detail || parsed.message || errorMessage;
          }
        } catch (e) {
          console.error(`[creditService] listPackages error parse hatası:`, e);
        }
        return {
          success: false,
          message: errorMessage,
        } as ApiResponse<PackagesList>;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.log(`[creditService] listPackages non-JSON response:`, text.substring(0, 200));
        if (text.trim().startsWith('<')) {
          return {
            success: false,
            message: "Paketler yüklenemedi. (HTML response)",
          } as ApiResponse<PackagesList>;
        }
        // JSON değilse ama HTML de değilse, parse etmeyi dene
      }

      const data = await response.json();
      console.log(`[creditService] listPackages success:`, {
        success: data.success,
        hasData: !!data.data,
        packagesCount: data.data?.packages?.length || 0,
      });
      
      // Response formatını kontrol et ve düzelt
      if (data.success && data.data && Array.isArray(data.data.packages)) {
        return data as ApiResponse<PackagesList>;
      } else if (data.packages && Array.isArray(data.packages)) {
        // Eğer direkt packages array'i döndüyse, formatı düzelt
        return {
          success: true,
          data: {
            packages: data.packages
          }
        } as ApiResponse<PackagesList>;
      } else {
        console.warn(`[creditService] listPackages beklenmeyen format:`, data);
        return {
          success: false,
          message: "Paketler yüklenemedi. (Beklenmeyen response formatı)",
        } as ApiResponse<PackagesList>;
      }
    } catch (error) {
      console.error(`[creditService.ts] API hatası (${CREDIT_ENDPOINTS.PACKAGES}):`, error);
      return {
        success: false,
        message: "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.",
      };
    }
  }

  /**
   * Paket satın al
   * Backend düz yanıt döndürüyor (success, message, new_balance, package); mobil data sarmalayıcısı bekliyor.
   */
  async purchasePackage(packageId: number): Promise<ApiResponse<PurchaseResult>> {
    const r = await authFetch<PurchaseResult>(CREDIT_ENDPOINTS.PURCHASE, {
      method: "POST",
      body: JSON.stringify({
        package_id: packageId,
      }),
    });
    // Backend bazen { success, message, new_balance, package } döndürüyor (data yok)
    if (r.success && !r.data && "message" in r && "new_balance" in r) {
      const flat = r as unknown as { message: string; new_balance: number; package?: PurchaseResult["package"] };
      return {
        success: true,
        data: {
          success: true,
          message: flat.message,
          new_balance: flat.new_balance,
          package: flat.package,
        },
      } as ApiResponse<PurchaseResult>;
    }
    return r;
  }
}

// Singleton instance
export const creditService = new CreditService();
export default creditService;
