/**
 * ProParcel Auth Service
 * 
 * Backend auth API ile iletişim.
 */

import { API_URL, AUTH_API_URL } from "../config/api";
import { storageService } from "./storageService";
import type {
  ApiResponse,
  AuthTokens,
  LoginRequest,
  LoginResponse,
  OTPLoginRequest,
  OTPSendRequest,
  OTPVerifyRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  ProfileUpdateRequest,
  RegisterRequest,
  User,
  UserProfile,
  Subscription,
  CompanyProfile,
  CompanyMembershipRequest,
  RegistrationCompanyItem,
  UserExpertiseArea,
  ProviderCoverageDistrict,
  UserBadge,
  CustomerFeatureFlags,
  ProfilePublic,
} from "../src/types/auth";
import type {
  BadgeCelebrationPayload,
  BadgeOverviewPayload,
} from "../src/types/badges";
import { normalizeAuthUser } from "../src/utils/membership";

async function persistAuthUser(raw: User): Promise<User> {
  const user = normalizeAuthUser(raw as unknown as Record<string, unknown>);
  await storageService.setUser(user);
  return user;
}

function hasValidLoginPayload(
  data: LoginResponse["data"] | undefined,
): data is NonNullable<LoginResponse["data"]> {
  if (!data) return false;
  const access = String(data.access || "").trim();
  const refresh = String(data.refresh || "").trim();
  return Boolean(access && refresh && data.user);
}

/**
 * Ngrok ücretsiz katmanı: bu header olmadan bazı istekler uyarı/HTML veya beklenmeyen HTTP kodları döndürebilir.
 * Diğer servislerle (paymentService, creditService) aynı davranış.
 */
function ngrokHeadersForAuthBase(): Record<string, string> {
  const base = AUTH_API_URL || "";
  if (/ngrok(-free)?\.dev|ngrok\.(io|app)/i.test(base)) {
    return { "ngrok-skip-browser-warning": "true" };
  }
  return {};
}

function maskIdentifier(raw?: string): string {
  const value = String(raw || "").trim();
  if (!value) return "(empty)";
  if (value.includes("@")) {
    const parts = value.split("@");
    const local = parts[0] || "";
    const domain = parts[1] || "";
    const safeLocal = local.length <= 2 ? `${local[0] || ""}*` : `${local.slice(0, 2)}***`;
    return `${safeLocal}@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  if (!digits) return "***";
  if (digits.length <= 4) return `${digits[0] || ""}***`;
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
}

/** Oturum sona erdiğinde (refresh fail / 401) AuthContext'in güncellenmesi için callback */
let _onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(callback: (() => void) | null): void {
  _onSessionExpired = callback;
}

export function notifySessionExpired(): void {
  _onSessionExpired?.();
}

export type RegisterVerifyMediaFiles = {
  avatarUri?: string | null;
  companyLogoUri?: string | null;
};

function appendRegisterFormFields(formData: FormData, data: RegisterRequest) {
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    formData.append(key, String(value));
  });
}

async function registerVerifyMultipart(
  data: RegisterRequest,
  files: RegisterVerifyMediaFiles
): Promise<LoginResponse> {
  const url = `${AUTH_API_URL}${AUTH_ENDPOINTS.REGISTER}`;
  const formData = new FormData();
  appendRegisterFormFields(formData, { ...data, step: "verify_otp" });

  if (files.avatarUri) {
    formData.append("avatar", {
      uri: files.avatarUri,
      type: "image/jpeg",
      name: "avatar.jpg",
    } as any);
  }
  if (files.companyLogoUri) {
    formData.append("company_logo", {
      uri: files.companyLogoUri,
      type: "image/jpeg",
      name: "company_logo.jpg",
    } as any);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...ngrokHeadersForAuthBase(),
      },
      body: formData,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : { success: false, message: "Kayıt doğrulaması başarısız." };

    if (payload.success && hasValidLoginPayload(payload.data)) {
      await storageService.setTokens({
        access: payload.data.access,
        refresh: payload.data.refresh,
      });
      await persistAuthUser(payload.data.user);
    }

    return payload as LoginResponse;
  } catch (error) {
    return {
      success: false,
      message: "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.",
    };
  }
}

// API Endpoints
const AUTH_ENDPOINTS = {
  REGISTER: "/api/auth/register/",
  CHECK_COMPANY_VKN: "/api/auth/company/exists/",
  COMPANY_LIST: "/api/auth/company/list/",
  LOGIN: "/api/auth/login/",
  LOGOUT: "/api/auth/logout/",
  TOKEN_REFRESH: "/api/auth/token/refresh/",
  OTP_SEND: "/api/auth/otp/send/",
  OTP_VERIFY: "/api/auth/otp/verify/",
  OTP_LOGIN: "/api/auth/otp/login/",
  PASSWORD_RESET: "/api/auth/password/reset/",
  PASSWORD_RESET_CONFIRM: "/api/auth/password/reset/confirm/",
  PASSWORD_CHANGE: "/api/auth/password/change/",
  PASSWORD_CHANGE_SEND_OTP: "/api/auth/password/change/send-otp/",
  DELETE_ACCOUNT: "/api/profile/delete/",
  DELETE_ACCOUNT_SEND_OTP: "/api/profile/delete/send-otp/",
  GOOGLE: "/api/auth/google/",
  APPLE: "/api/auth/apple/",
  PROFILE: "/api/profile/",
  EXPERTISE_AREAS: "/api/profile/expertise-areas/",
  PROVIDER_COVERAGE: "/api/profile/provider-coverage/",
  PROFILE_BADGES: "/api/profile/badges/",
  PROFILE_BADGES_OVERVIEW: "/api/profile/badges/overview/",
  PROFILE_BADGES_CELEBRATION_PENDING: "/api/profile/badges/celebration-pending/",
  NOTIFICATION_READ: (id: number) => `/api/notifications/${id}/read/`,
  AVATAR: "/api/profile/avatar/",
  SUBSCRIPTION: "/api/subscription/",
  DISMISS_WELCOME: "/api/auth/dismiss-welcome/",
  DISMISS_APP_TOUR: "/api/auth/dismiss-app-tour/",
} as const;

function normalizeRegistrationCompanies(raw: unknown): RegistrationCompanyItem[] {
  const root = raw as Record<string, unknown> | unknown[] | null | undefined;
  const arr = Array.isArray(root)
    ? root
    : Array.isArray((root as Record<string, unknown>)?.companies)
      ? ((root as Record<string, unknown>).companies as unknown[])
      : Array.isArray((root as Record<string, unknown>)?.results)
        ? ((root as Record<string, unknown>).results as unknown[])
        : [];

  const items: RegistrationCompanyItem[] = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const companyProfileId = Number(row.company_profile_id ?? row.id);
    const companyName = String(
      row.company_name ?? row.name ?? row.title ?? "",
    ).trim();
    if (!Number.isFinite(companyProfileId) || companyProfileId <= 0 || !companyName) {
      continue;
    }
    items.push({
      company_profile_id: companyProfileId,
      company_name: companyName,
      corporate_type:
        (row.corporate_type as RegistrationCompanyItem["corporate_type"]) ?? null,
      vergi_no:
        row.vergi_no != null && String(row.vergi_no).trim()
          ? String(row.vergi_no).trim()
          : null,
    });
  }
  return items;
}

/**
 * HTTP request helper with auth header
 */
async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${AUTH_API_URL}${endpoint}`;
  const isLoginEndpoint = endpoint === AUTH_ENDPOINTS.LOGIN;
  const authOptionalEndpoints = new Set<string>([
    AUTH_ENDPOINTS.REGISTER,
    AUTH_ENDPOINTS.CHECK_COMPANY_VKN,
    AUTH_ENDPOINTS.COMPANY_LIST,
    AUTH_ENDPOINTS.LOGIN,
    AUTH_ENDPOINTS.LOGOUT,
    AUTH_ENDPOINTS.TOKEN_REFRESH,
    AUTH_ENDPOINTS.OTP_SEND,
    AUTH_ENDPOINTS.OTP_VERIFY,
    AUTH_ENDPOINTS.OTP_LOGIN,
    AUTH_ENDPOINTS.PASSWORD_RESET,
    AUTH_ENDPOINTS.PASSWORD_RESET_CONFIRM,
    AUTH_ENDPOINTS.GOOGLE,
    AUTH_ENDPOINTS.APPLE,
  ]);
  const requiresAuth = !Array.from(authOptionalEndpoints).some(
    (optionalEndpoint) => endpoint === optionalEndpoint || endpoint.startsWith(`${optionalEndpoint}?`)
  );
 
  const normalizeToken = (t: string | null): string | null => {
    if (!t) return null;
    if (t === "null" || t === "undefined") return null;
    return t;
  };

  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...ngrokHeadersForAuthBase(),
    ...((options.headers as Record<string, string>) || {}),
  };

  const doRequest = async (token: string | null) => {
    const headers: Record<string, string> = { ...baseHeaders };
    if (requiresAuth) {
      const t = normalizeToken(token);
      if (t) headers.Authorization = `Bearer ${t}`;
    }
    return fetch(url, { ...options, headers });
  };

  try {
    if (__DEV__ && isLoginEndpoint) {
      let masked = "(unknown)";
      let hasPassword = false;
      try {
        const body = typeof options.body === "string" ? JSON.parse(options.body) : {};
        masked = maskIdentifier(body?.identifier || body?.email || body?.phone_number);
        hasPassword = !!body?.password;
      } catch {
      }
      console.log("[auth/login] Request", {
        apiUrl: API_URL,
        authApiUrl: AUTH_API_URL,
        endpoint,
        fullUrl: url,
        identifier: masked,
        hasPassword,
      });
    }

    // First try with existing access token
    let accessToken = normalizeToken(await storageService.getAccessToken());
    const refreshToken = normalizeToken(await storageService.getRefreshToken());

    if (requiresAuth && !accessToken && !refreshToken) {
      return {
        success: false,
        message: "Oturum bulunamadı. Lütfen giriş yapın.",
      } as ApiResponse<T>;
    }

    let response = await doRequest(accessToken);

    // If unauthorized, try refresh and retry once
    if (
      response.status === 401 &&
      endpoint !== AUTH_ENDPOINTS.TOKEN_REFRESH &&
      !!refreshToken
    ) {
      const refreshed = await authService.refreshToken();
      accessToken = normalizeToken(refreshed?.access ?? (await storageService.getAccessToken()));
      if (accessToken) {
        response = await doRequest(accessToken);
      }
    }

    // Check if response is OK
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.text();
        const isHtml = errorData.trim().startsWith("<");
        if (isHtml) {
          // HTML often means a login page / reverse-proxy error page
          if (response.status === 401 || response.status === 403) {
            errorMessage = "Authentication failed. Please login again.";
          } else {
            errorMessage = `Sunucu beklenmeyen bir HTML yanıtı döndürdü (HTTP ${response.status}).`;
          }
        } else {
          const parsed = JSON.parse(errorData);
          const nfe = parsed.errors?.['non_field_errors'];
          const idErr = parsed.errors?.identifier;
          const errValues = parsed.errors && typeof parsed.errors === 'object'
            ? Object.values(parsed.errors).flat().find((v) => typeof v === 'string' || (Array.isArray(v) && v.length))
            : null;
          const flatErr = Array.isArray(errValues)
            ? errValues[0]
            : typeof errValues === 'string'
              ? errValues
              : null;
          const firstErr = Array.isArray(nfe)
            ? nfe[0]
            : Array.isArray(idErr)
              ? idErr[0]
              : flatErr;
          errorMessage = parsed.error || parsed.detail || firstErr || parsed.message || errorMessage;
          if (__DEV__ && isLoginEndpoint) {
            console.warn("[auth/login] Backend rejected login", {
              status: response.status,
              statusText: response.statusText,
              parsedError: parsed,
              resolvedMessage: errorMessage,
            });
          }
        }
        if (__DEV__ && isLoginEndpoint && isHtml) {
          console.warn("[auth/login] Non-JSON response", {
            status: response.status,
            statusText: response.statusText,
            preview: errorData.slice(0, 180),
          });
        }
      } catch {
        // Ignore parse errors
      }

      // Oturum gerektiren uçlarda 401 → çıkış; giriş/kayıt denemelerinde storage'ı silme.
      if (response.status === 401 && requiresAuth) {
        await storageService.clearAll();
        notifySessionExpired();
        errorMessage = "Oturum süreniz doldu. Lütfen tekrar giriş yapın.";
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
      const isHtml = text.trim().startsWith("<");
      if (isHtml) {
        if (response.status === 401 || response.status === 403) {
          await storageService.clearAll();
          notifySessionExpired();
          return {
            success: false,
            message: "Oturum süreniz doldu. Lütfen tekrar giriş yapın.",
          } as ApiResponse<T>;
        }
        return {
          success: false,
          message: `Sunucu beklenmeyen bir HTML yanıtı döndürdü (HTTP ${response.status}).`,
        } as ApiResponse<T>;
      }
      // Try to parse as JSON anyway
    }

    const data = await response.json();
    if (__DEV__ && isLoginEndpoint) {
      console.log("[auth/login] Login success", {
        status: response.status,
        hasAccess: !!(data as any)?.data?.access,
        hasRefresh: !!(data as any)?.data?.refresh,
        userEmail: (data as any)?.data?.user?.email || null,
      });
    }
    return data as ApiResponse<T>;
  } catch (error: unknown) {
    const err = error as { message?: string; name?: string };
    const isNetworkError =
      err?.message === "Network request failed" ||
      err?.message?.includes("Failed to fetch") ||
      err?.name === "TypeError";
    console.error(`[authService.ts] API hatası (${endpoint}):`, error);
    if (__DEV__ && isLoginEndpoint) {
      console.error("[auth/login] Network/transport error", {
        apiUrl: API_URL,
        authApiUrl: AUTH_API_URL,
        endpoint,
        error: err?.message || String(error),
      });
    }
    return {
      success: false,
      message: isNetworkError
        ? `Sunucuya ulaşılamıyor. API: ${AUTH_API_URL} — İnternet ve .env (EXPO_PUBLIC_API_URL / EXPO_PUBLIC_AUTH_API_URL) kontrol edin.`
        : "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.",
    };
  }
}

/**
 * Auth Service - Authentication API işlemleri
 */
class AuthService {
  /**
   * Yeni kullanıcı kaydı - Çok adımlı OTP akışı
   */
  async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await authFetch<LoginResponse["data"]>(
      AUTH_ENDPOINTS.REGISTER,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );

    if (response.success && hasValidLoginPayload(response.data)) {
      // Token ve user'ı kaydet (sadece verify_otp adımında)
      if (data.step === 'verify_otp') {
        await storageService.setTokens({
          access: response.data.access,
          refresh: response.data.refresh,
        });
        await persistAuthUser(response.data.user);
      }
    }

    return response as LoginResponse;
  }

  /**
   * Kayıt - Önce bilgi varlığı kontrolü (validate). E-posta/telefon kayıtlıysa errors döner.
   */
  async registerValidate(data: RegisterRequest): Promise<ApiResponse<{ step: string }>> {
    return authFetch(AUTH_ENDPOINTS.REGISTER, {
      method: "POST",
      body: JSON.stringify({ ...data, step: 'validate' }),
    });
  }

  /**
   * Kayıt - OTP gönder
   */
  async registerSendOTP(data: RegisterRequest): Promise<ApiResponse<{ step: string; expires_in: number }>> {
    return authFetch(AUTH_ENDPOINTS.REGISTER, {
      method: "POST",
      body: JSON.stringify({ ...data, step: 'send_otp' }),
    });
  }

  /**
   * Kayıt - OTP doğrula ve kullanıcı oluştur
   */
  async registerVerifyOTP(
    data: RegisterRequest,
    otp?: string,
    files?: RegisterVerifyMediaFiles
  ): Promise<LoginResponse> {
    const verifyPayload: RegisterRequest = {
      ...data,
      step: "verify_otp",
      ...(otp ? { otp } : {}),
    };
    if (files?.avatarUri || files?.companyLogoUri) {
      return registerVerifyMultipart(verifyPayload, files);
    }
    return this.register(verifyPayload);
  }

  /**
   * Danışman kayıt: firma adı ile arama — GET /api/auth/company/list/
   */
  async listCompaniesForRegistration(
    q = "",
    limit = 20,
  ): Promise<ApiResponse<RegistrationCompanyItem[]>> {
    const query = encodeURIComponent((q || "").trim());
    const safeLimit = Math.max(1, Math.min(50, Number.isFinite(limit) ? limit : 20));
    const response = await authFetch<unknown>(
      `${AUTH_ENDPOINTS.COMPANY_LIST}?q=${query}&limit=${safeLimit}`,
      { method: "GET" },
    );

    if (!response.success) {
      return response as ApiResponse<RegistrationCompanyItem[]>;
    }

    const layer = (response.data as Record<string, unknown> | undefined)?.data ?? response.data;
    return {
      ...response,
      data: normalizeRegistrationCompanies(layer),
    };
  }

  /** @deprecated listCompaniesForRegistration kullanın */
  async listCompanies(
    query: string,
    limit = 20,
  ): Promise<ApiResponse<RegistrationCompanyItem[]>> {
    return this.listCompaniesForRegistration(query, limit);
  }

  /**
   * Danışman kayıt: kurumsal profil id ile firma doğrula
   * GET /api/auth/company/exists/?company_profile_id=...
   */
  async checkCompanyByProfileId(
    company_profile_id: number,
  ): Promise<
    ApiResponse<{
      exists: boolean;
      company_profile_id: number;
      company_name?: string;
      corporate_type?: "emlak" | "spk" | "lihkab" | null;
    }>
  > {
    const id = Number(company_profile_id);
    if (!Number.isFinite(id) || id <= 0) {
      return { success: false, message: "Geçerli bir firma seçin." };
    }
    return authFetch(
      `${AUTH_ENDPOINTS.CHECK_COMPANY_VKN}?company_profile_id=${id}`,
      { method: "GET" },
    );
  }

  /**
   * @deprecated checkCompanyByProfileId kullanın
   */
  async checkCompanyVergiNo(
    vergi_no: string,
  ): Promise<ApiResponse<{ exists: boolean; vergi_no: string; company_name?: string; corporate_type?: "emlak" | "spk" | "lihkab" | null }>> {
    const q = encodeURIComponent((vergi_no || "").trim());
    return authFetch(`${AUTH_ENDPOINTS.CHECK_COMPANY_VKN}?vergi_no=${q}`, {
      method: "GET",
    });
  }

  /**
   * E-posta veya telefon/şifre ile giriş
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await authFetch<LoginResponse["data"]>(
      AUTH_ENDPOINTS.LOGIN,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );

    if (response.success && hasValidLoginPayload(response.data)) {
      await storageService.setTokens({
        access: response.data.access,
        refresh: response.data.refresh,
      });
      await persistAuthUser(response.data.user);
      return response as LoginResponse;
    }

    if (response.success) {
      return {
        success: false,
        message: "Giriş yanıtı eksik. Lütfen tekrar deneyin.",
      };
    }

    return response as LoginResponse;
  }

  /**
   * Çıkış yap
   */
  async logout(): Promise<ApiResponse> {
    const refreshToken = await storageService.getRefreshToken();
    
    const response = await authFetch(AUTH_ENDPOINTS.LOGOUT, {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
    });

    // Her durumda local storage'ı temizle
    await storageService.clearAll();

    return response;
  }

  /**
   * Token yenile
   * Seri çalıştırma: Aynı anda yalnızca bir refresh. Paralel çağrılar aynı promise'i bekler.
   */
  async refreshToken(): Promise<AuthTokens | null> {
    if (AuthService._refreshPromise) {
      return AuthService._refreshPromise;
    }

    AuthService._refreshPromise = this._doRefreshToken();
    try {
      const result = await AuthService._refreshPromise;
      return result;
    } finally {
      AuthService._refreshPromise = null;
    }
  }

  private static _refreshPromise: Promise<AuthTokens | null> | null = null;

  private async _doRefreshToken(): Promise<AuthTokens | null> {
    const refreshToken = await storageService.getRefreshToken();

    if (!refreshToken) {
      console.log("[authService] refreshToken: refresh token yok, atlanıyor");
      return null;
    }

    // Bearer gönderme: /token/refresh/ yalnızca body.refresh kullanır; süresi dolmuş access 401 verebilir.
    const url = `${AUTH_API_URL}${AUTH_ENDPOINTS.TOKEN_REFRESH}`;
    let ok = false;
    let access: string | undefined;
    let failMsg = "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ngrokHeadersForAuthBase() },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      const data = (await res.json()) as { access?: string; detail?: string; message?: string };
      ok = res.ok && typeof data?.access === "string";
      access = data?.access;
      if (!ok) {
        failMsg = data?.detail || data?.message || `HTTP ${res.status}`;
      }
    } catch (e) {
      console.warn("[authService] refreshToken: ağ hatası", e);
      failMsg = "Bağlantı hatası";
    }

    if (ok && access) {
      const newTokens: AuthTokens = { access, refresh: refreshToken };
      await storageService.setTokens(newTokens);
      console.log("[authService] refreshToken: başarılı, yeni access token kaydedildi");
      return newTokens;
    }

    // Refresh başarısız: storage'ı temizleme. Oturum stratejisi: kullanıcı bir kere giriş yaptıysa
    // oturum sürekli açık kalır; sadece çıkış yapınca temizlenir.
    console.warn("[authService] refreshToken: başarısız, mevcut token ile devam", failMsg || "");
    return null;
  }

  /**
   * SMS OTP gönder
   */
  async sendOTP(data: OTPSendRequest): Promise<ApiResponse<{ expires_in: number }>> {
    return authFetch(AUTH_ENDPOINTS.OTP_SEND, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * OTP doğrula (telefon doğrulama)
   */
  async verifyOTP(data: OTPVerifyRequest): Promise<ApiResponse<{ verified: boolean }>> {
    return authFetch(AUTH_ENDPOINTS.OTP_VERIFY, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * OTP ile giriş
   */
  async loginWithOTP(data: OTPLoginRequest): Promise<LoginResponse> {
    const response = await authFetch<LoginResponse["data"] & { is_new_user: boolean }>(
      AUTH_ENDPOINTS.OTP_LOGIN,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );

    if (response.success && hasValidLoginPayload(response.data)) {
      await storageService.setTokens({
        access: response.data.access,
        refresh: response.data.refresh,
      });
      await persistAuthUser(response.data.user);
      return response as LoginResponse;
    }

    if (response.success) {
      return {
        success: false,
        message: "Giriş yanıtı eksik. Lütfen tekrar deneyin.",
      };
    }

    return response as LoginResponse;
  }

  /**
   * Şifre sıfırlama - Çok adımlı OTP akışı
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<ApiResponse> {
    return authFetch(AUTH_ENDPOINTS.PASSWORD_RESET, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Şifre sıfırlama - Adım 1: E-posta doğrulama
   */
  async requestPasswordResetStep1(email: string): Promise<ApiResponse<{ step: string }>> {
    return authFetch(AUTH_ENDPOINTS.PASSWORD_RESET, {
      method: "POST",
      body: JSON.stringify({ email, step: 'email' }),
    });
  }

  /**
   * Şifre sıfırlama - Adım 2: Telefon doğrulama ve OTP gönderimi
   */
  async requestPasswordResetStep2(email: string, phone_number: string): Promise<ApiResponse<{ step: string; expires_in: number }>> {
    return authFetch(AUTH_ENDPOINTS.PASSWORD_RESET, {
      method: "POST",
      body: JSON.stringify({ email, phone_number, step: 'phone' }),
    });
  }

  /**
   * Şifre sıfırlama - Adım 3: OTP doğrulama ve token alma
   */
  async requestPasswordResetStep3(email: string, phone_number: string, otp: string): Promise<ApiResponse<{ step: string; token: string }>> {
    return authFetch(AUTH_ENDPOINTS.PASSWORD_RESET, {
      method: "POST",
      body: JSON.stringify({ email, phone_number, otp, step: 'verify_otp' }),
    });
  }

  /**
   * Yeni şifre belirle
   */
  async confirmPasswordReset(data: PasswordResetConfirmRequest): Promise<ApiResponse> {
    return authFetch(AUTH_ENDPOINTS.PASSWORD_RESET_CONFIRM, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Şifre değiştirme için OTP gönder (telefona)
   */
  async requestPasswordChangeOtp(): Promise<ApiResponse<{ expires_in?: number }>> {
    return authFetch(AUTH_ENDPOINTS.PASSWORD_CHANGE_SEND_OTP, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  /**
   * Şifre değiştirme - OTP + yeni şifre ile onayla
   */
  async confirmPasswordChange(
    otp: string,
    newPassword: string,
    newPasswordConfirm: string
  ): Promise<ApiResponse> {
    return authFetch(AUTH_ENDPOINTS.PASSWORD_CHANGE, {
      method: "POST",
      body: JSON.stringify({
        otp: otp.trim(),
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      }),
    });
  }

  /**
   * Hesap silme için OTP gönder (şifre doğrulandıktan sonra)
   */
  async requestDeleteAccountOtp(password: string): Promise<ApiResponse<{ expires_in?: number }>> {
    return authFetch(AUTH_ENDPOINTS.DELETE_ACCOUNT_SEND_OTP, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }

  /**
   * Profil bilgilerini getir
   */
  async getProfile(): Promise<ApiResponse<{
    user: User;
    profile: UserProfile;
    public?: ProfilePublic;
    subscription: Subscription | null;
    features?: CustomerFeatureFlags;
    company_relation?: CompanyProfile | null;
    pending_requests?: CompanyMembershipRequest[];
    pending_membership_requests?: CompanyMembershipRequest[];
    sub_users?: UserProfile[];
    expertise_areas?: UserExpertiseArea[];
    provider_coverages?: ProviderCoverageDistrict[];
    badges?: UserBadge[];
    can_access_prosorgu?: boolean;
  }>> {
    return authFetch(AUTH_ENDPOINTS.PROFILE, {
      method: "GET",
    });
  }

  /**
   * Profil güncelle
   */
  async updateProfile(data: ProfileUpdateRequest): Promise<ApiResponse<UserProfile>> {
    return authFetch(AUTH_ENDPOINTS.PROFILE, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Uzmanlık bölgelerini güncelle (listeyi replace eder)
   */
  async updateExpertiseAreas(quarterValues: number[]): Promise<ApiResponse<{ expertise_areas: UserExpertiseArea[] }>> {
    return authFetch(AUTH_ENDPOINTS.EXPERTISE_AREAS, {
      method: "PUT",
      body: JSON.stringify({ expertise_quarters: quarterValues }),
    });
  }

  /**
   * Provider ilçe coverage kayıtlarını getir
   */
  async getProviderCoverage(): Promise<ApiResponse<{ provider_coverages: ProviderCoverageDistrict[] }>> {
    return authFetch(AUTH_ENDPOINTS.PROVIDER_COVERAGE, {
      method: "GET",
    });
  }

  /**
   * Provider ilçe coverage kayıtlarını replace eder
   */
  async updateProviderCoverage(
    districts: Array<{ city_id: number; district_id: number; is_primary?: boolean }>
  ): Promise<ApiResponse<{ provider_coverages: ProviderCoverageDistrict[] }>> {
    return authFetch(AUTH_ENDPOINTS.PROVIDER_COVERAGE, {
      method: "PUT",
      body: JSON.stringify({ districts }),
    });
  }

  /**
   * Kullanıcının rozetlerini getir (uzman üyeler)
   */
  async getMyBadges(): Promise<ApiResponse<{ badges: UserBadge[] }>> {
    return authFetch(AUTH_ENDPOINTS.PROFILE_BADGES, {
      method: "GET",
    });
  }

  /**
   * Rozet özeti (ana kartlar + kategoriler + page_summary)
   * @param userId Başka kullanıcı (GET ?user_id=) — web ziyaret profili ile uyumlu
   */
  async getBadgeOverview(userId?: number): Promise<ApiResponse<BadgeOverviewPayload>> {
    const q =
      userId != null && Number.isFinite(Number(userId))
        ? `?user_id=${encodeURIComponent(String(userId))}`
        : "";
    return authFetch(`${AUTH_ENDPOINTS.PROFILE_BADGES_OVERVIEW}${q}`, {
      method: "GET",
    });
  }

  /**
   * İlk görev etkileşim rozeti tebrik bildirimi (okunmamış).
   * Backend düz JSON döner: { success, celebration } (data sarmalayıcısı yok).
   */
  async getBadgeCelebrationPending(): Promise<{
    success: boolean;
    celebration?: BadgeCelebrationPayload | null;
    error?: string;
  }> {
    const r = (await authFetch<Record<string, unknown>>(AUTH_ENDPOINTS.PROFILE_BADGES_CELEBRATION_PENDING, {
      method: "GET",
    })) as ApiResponse<Record<string, unknown>> & { celebration?: BadgeCelebrationPayload | null };
    const celebration = (r as { celebration?: BadgeCelebrationPayload | null }).celebration;
    return {
      success: !!r.success,
      celebration: celebration ?? null,
      error: r.message || (r as { error?: string }).error,
    };
  }

  /**
   * Bildirimi okundu işaretle (rozet tebriği kapatma)
   */
  async markNotificationRead(notificationId: number): Promise<ApiResponse<{ success?: boolean }>> {
    return authFetch(AUTH_ENDPOINTS.NOTIFICATION_READ(notificationId), {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  /**
   * Avatar yükle (token yoksa veya 401'de refresh deneyip bir kez daha dener).
   * remove_background: true ise arka plan temizlenir, false ise sadece boyut/tür optimize edilir.
   */
  async uploadAvatar(imageUri: string, options?: { remove_background?: boolean }): Promise<ApiResponse<{ 
    avatar_url?: string;
    pending_avatar_url?: string;
    avatar_approved?: boolean;
    has_pending_avatar?: boolean;
  }>> {
    let accessToken = await storageService.getAccessToken();
    if (!accessToken || accessToken === "null" || accessToken === "undefined") {
      const refreshed = await this.refreshToken();
      accessToken = refreshed?.access ?? (await storageService.getAccessToken());
    }
    if (!accessToken) {
      return {
        success: false,
        message: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
      };
    }

    const formData = new FormData();
    formData.append("avatar", {
      uri: imageUri,
      type: "image/jpeg",
      name: "avatar.jpg",
    } as any);
    formData.append("remove_background", options?.remove_background !== false ? "true" : "false");

    const doUpload = async (token: string) => {
      const response = await fetch(`${AUTH_API_URL}${AUTH_ENDPOINTS.AVATAR}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...ngrokHeadersForAuthBase(),
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.text();
          if (errorData.trim().startsWith('<')) {
            errorMessage = "Avatar yüklenemedi. (HTML response)";
          } else {
            const parsed = JSON.parse(errorData);
            errorMessage = parsed.error ?? parsed.detail ?? parsed.message ?? errorMessage;
          }
        } catch {
          // Ignore parse errors
        }
        return { ok: false as const, status: response.status, errorMessage };
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        if (text.trim().startsWith('<')) {
          return { ok: false as const, status: response.status, errorMessage: "Avatar yüklenemedi. (HTML response)" };
        }
      }

      const data = await response.json();
      return { ok: true as const, data };
    };

    try {
      let result = await doUpload(accessToken);

      if (!result.ok && result.status === 401) {
        const refreshed = await this.refreshToken();
        const newToken = refreshed?.access ?? (await storageService.getAccessToken());
        if (newToken) {
          const formDataRetry = new FormData();
          formDataRetry.append("avatar", {
            uri: imageUri,
            type: "image/jpeg",
            name: "avatar.jpg",
          } as any);
          formDataRetry.append("remove_background", options?.remove_background !== false ? "true" : "false");
          const responseRetry = await fetch(`${AUTH_API_URL}${AUTH_ENDPOINTS.AVATAR}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${newToken}`, ...ngrokHeadersForAuthBase() },
            body: formDataRetry,
          });
          if (responseRetry.ok) {
            const data = await responseRetry.json();
            return data;
          }
          try {
            const errText = await responseRetry.text();
            const parsed = errText.trim().startsWith('<') ? {} : JSON.parse(errText);
            result = { ok: false, status: responseRetry.status, errorMessage: (parsed as any)?.detail ?? (parsed as any)?.message ?? "Token geçersiz. Lütfen tekrar giriş yapın." };
          } catch {
            result = { ok: false, status: responseRetry.status, errorMessage: "Token geçersiz. Lütfen tekrar giriş yapın." };
          }
        }
      }

      if (result.ok) {
        return result.data;
      }
      return {
        success: false,
        message: result.errorMessage,
      };
    } catch (error) {
      return {
        success: false,
        message: "Avatar yüklenemedi",
      };
    }
  }

  /**
   * Avatar sil
   */
  async deleteAvatar(): Promise<ApiResponse> {
    return authFetch(AUTH_ENDPOINTS.AVATAR, {
      method: "DELETE",
    });
  }

  /**
   * Hesap sil (şifre + OTP)
   */
  async deleteAccount(password: string, otp: string): Promise<ApiResponse> {
    const response = await authFetch(AUTH_ENDPOINTS.DELETE_ACCOUNT, {
      method: "DELETE",
      body: JSON.stringify({ password, otp: otp.trim(), confirm: true }),
    });

    if (response.success) {
      await storageService.clearAll();
    }

    return response;
  }

  /**
   * İlk üyelik hoşgeldin modalını kapat (sunucuda has_seen_welcome = true)
   */
  async dismissWelcome(): Promise<ApiResponse> {
    return authFetch(AUTH_ENDPOINTS.DISMISS_WELCOME, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  /**
   * İlk giriş tour overlay'ini kapat (sunucuda has_seen_app_tour = true)
   */
  async dismissAppTour(): Promise<ApiResponse> {
    return authFetch(AUTH_ENDPOINTS.DISMISS_APP_TOUR, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  /**
   * Abonelik bilgisi getir
   */
  async getSubscription(): Promise<ApiResponse<{
    active_subscription: Subscription | null;
    subscription_history: Subscription[];
  }>> {
    return authFetch(AUTH_ENDPOINTS.SUBSCRIPTION, {
      method: "GET",
    });
  }

  /**
   * Google ile giriş
   */
  async loginWithGoogle(idToken: string): Promise<LoginResponse> {
    const response = await authFetch<LoginResponse["data"] & { is_new_user: boolean }>(
      AUTH_ENDPOINTS.GOOGLE,
      {
        method: "POST",
        body: JSON.stringify({ id_token: idToken }),
      }
    );

    if (response.success && hasValidLoginPayload(response.data)) {
      await storageService.setTokens({
        access: response.data.access,
        refresh: response.data.refresh,
      });
      await persistAuthUser(response.data.user);
      return response as LoginResponse;
    }

    if (response.success) {
      return {
        success: false,
        message: "Giriş yanıtı eksik. Lütfen tekrar deneyin.",
      };
    }

    return response as LoginResponse;
  }

  /**
   * Apple ile giriş
   */
  async loginWithApple(
    idToken: string,
    user?: { email?: string; name?: { firstName?: string; lastName?: string } }
  ): Promise<LoginResponse> {
    const response = await authFetch<LoginResponse["data"] & { is_new_user: boolean }>(
      AUTH_ENDPOINTS.APPLE,
      {
        method: "POST",
        body: JSON.stringify({ id_token: idToken, user }),
      }
    );

    if (response.success && hasValidLoginPayload(response.data)) {
      await storageService.setTokens({
        access: response.data.access,
        refresh: response.data.refresh,
      });
      await persistAuthUser(response.data.user);
      return response as LoginResponse;
    }

    if (response.success) {
      return {
        success: false,
        message: "Giriş yanıtı eksik. Lütfen tekrar deneyin.",
      };
    }

    return response as LoginResponse;
  }
}

// Singleton instance
export const authService = new AuthService();
export default authService;
