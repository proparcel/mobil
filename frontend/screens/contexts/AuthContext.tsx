/**
 * ProParcel Auth Context
 * 
 * Global authentication state yönetimi.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { authService, setOnSessionExpired } from "../../services/authService";
import { storageService } from "../../services/storageService";
import type {
  AuthContextValue,
  AuthState,
  AuthTokens,
  ProfileUpdateRequest,
  LoginRequest,
  LoginResult,
  RegisterRequest,
  User,
  UserProfile,
  ProfilePublic,
  LoginResponse,
} from "../../src/types/auth";
import {
  clearStoredHomeMapCityId,
  pickCityIdFromProfilePayload,
  pickCityIdFromUser,
  setStoredHomeMapCityId,
  fetchProfileCityIdAndStore,
} from "../../src/utils/homeMapPreferredCity";
import { parseCustomerFeatureFlags } from "../../src/utils/customerFeatureFlags";
import { normalizeAuthUser } from "../../src/utils/membership";
import {
  clearDeviceSavedQueriesOnLogout,
  ensureDeviceSavedQueriesOwner,
} from "../../src/utils/savedQueriesOwner";

// Default context value
const defaultContextValue: AuthContextValue = {
  user: null,
  tokens: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  loginWithOTP: async () => false,
  register: async () => false,
  syncSessionFromLoginResponse: () => {},
  logout: async () => {},
  refreshToken: async () => false,
  sendOTP: async () => false,
  verifyOTP: async () => false,
  resetPassword: async () => false,
  updateProfile: async () => false,
};

// Context
const AuthContext = createContext<AuthContextValue>(defaultContextValue);

// Provider Props
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Avoid duplicate background hydrations.
  const hydrateFullNameInFlightRef = useRef(false);

  /**
   * Uygulama başladığında storage'dan auth verilerini yükle
   */
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const [tokens, user] = await Promise.all([
          storageService.getTokens(),
          storageService.getUser(),
        ]);

        if (tokens && user) {
          const access = String(tokens.access || "").trim();
          const refresh = String(tokens.refresh || "").trim();
          const hasValidTokens =
            Boolean(access && refresh) &&
            access !== "null" &&
            access !== "undefined" &&
            refresh !== "null" &&
            refresh !== "undefined";

          if (!hasValidTokens) {
            await storageService.clearAll();
            setState({
              user: null,
              tokens: null,
              isLoading: false,
              isAuthenticated: false,
            });
            return;
          }

          setState({
            user: normalizeAuthUser(user as unknown as Record<string, unknown>),
            tokens: { access, refresh },
            isLoading: false,
            isAuthenticated: true,
          });
          void ensureDeviceSavedQueriesOwner(
            normalizeAuthUser(user as unknown as Record<string, unknown>).id,
          );
        } else {
          setState({
            user: null,
            tokens: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        console.error("[AuthContext.tsx:85] Auth data yükleme hatası:", error);
        setState({
          user: null,
          tokens: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    loadAuthData();
  }, []);

  /**
   * Hydrate user data from /api/profile in the background.
   * Syncs member_type, customer_type, features and is_admin without re-login.
   */
  useEffect(() => {
    if (!state.isAuthenticated) return;
    const currentUser = state.user;
    if (!currentUser) return;
    if (hydrateFullNameInFlightRef.current) return;

    hydrateFullNameInFlightRef.current = true;
    (async () => {
      try {
        const response = await authService.getProfile();
        const profile = response.success ? response.data?.profile : null;
        const serverUser = response.success ? response.data?.user : null;
        const publicProfile = response.success
          ? (response.data?.public as ProfilePublic | undefined)
          : undefined;
        if (!profile && !serverUser) return;

        const profileCityId = pickCityIdFromProfilePayload(
          response.success ? response.data : null,
        );
        if (profileCityId) {
          await setStoredHomeMapCityId(profileCityId);
        }

        const derivedFullName =
          String(serverUser?.full_name || "").trim() ||
          [profile?.first_name, profile?.last_name]
            .map((v) => (v == null ? "" : String(v)).trim())
            .filter(Boolean)
            .join(" ")
            .trim();

        const serverVipStartedAt = serverUser?.vip_started_at ?? currentUser.vip_started_at;
        const serverMemberType =
          profile?.member_type || serverUser?.member_type || currentUser.member_type;
        const serverCustomerType = serverUser?.customer_type ?? currentUser.customer_type;
        const serverIsAdmin =
          serverUser?.is_admin ?? currentUser.is_admin;
        const serverMembershipDisplay =
          publicProfile?.membership_display ??
          (profile as UserProfile | null)?.membership_display ??
          serverUser?.membership_display;
        const serverCanAccessProSorgu =
          response.success && response.data?.can_access_prosorgu !== undefined
            ? response.data.can_access_prosorgu
            : publicProfile?.can_access_prosorgu;
        const serverFeatures = parseCustomerFeatureFlags(response.success ? response.data?.features : null);
        const serverIsExpert =
          serverUser?.is_expert ??
          publicProfile?.is_expert ??
          (profile as UserProfile | null)?.is_expert;
        const nameChanged = derivedFullName && derivedFullName !== (currentUser.full_name || "").trim();
        const vipChanged = serverVipStartedAt !== currentUser.vip_started_at;
        const memberTypeChanged =
          Boolean(serverMemberType) && serverMemberType !== currentUser.member_type;
        const customerTypeChanged =
          Boolean(serverCustomerType) && serverCustomerType !== currentUser.customer_type;
        const adminChanged = serverIsAdmin !== currentUser.is_admin;
        const membershipDisplayChanged =
          Boolean(serverMembershipDisplay) &&
          serverMembershipDisplay !== currentUser.membership_display;
        const featuresChanged =
          serverFeatures != null &&
          (serverFeatures.smart_query !== currentUser.features?.smart_query ||
            serverFeatures.quarter_verification !==
              currentUser.features?.quarter_verification);
        const prof = profile as UserProfile | null;
        const cityIdChanged =
          profileCityId != null && profileCityId !== (currentUser.city_id ?? undefined);
        const cityNameChanged =
          Boolean(prof?.city_name) && prof?.city_name !== currentUser.city_name;
        const isExpertChanged =
          serverIsExpert !== undefined && serverIsExpert !== currentUser.is_expert;
        const canAccessProSorguChanged =
          serverCanAccessProSorgu !== undefined &&
          serverCanAccessProSorgu !== currentUser.can_access_prosorgu;

        if (
          !nameChanged &&
          !vipChanged &&
          !memberTypeChanged &&
          !customerTypeChanged &&
          !adminChanged &&
          !membershipDisplayChanged &&
          !featuresChanged &&
          !cityIdChanged &&
          !cityNameChanged &&
          !isExpertChanged &&
          !canAccessProSorguChanged
        ) {
          return;
        }

        const updatedUser: User = normalizeAuthUser({
          ...currentUser,
          ...(nameChanged ? { full_name: derivedFullName } : {}),
          ...(vipChanged ? { vip_started_at: serverVipStartedAt } : {}),
          ...(memberTypeChanged ? { member_type: serverMemberType } : {}),
          ...(customerTypeChanged && serverCustomerType ? { customer_type: serverCustomerType } : {}),
          ...(adminChanged ? { is_admin: serverIsAdmin } : {}),
          ...(membershipDisplayChanged ? { membership_display: serverMembershipDisplay } : {}),
          ...(featuresChanged && serverFeatures
            ? { features: { ...currentUser.features, ...serverFeatures } }
            : {}),
          ...(cityIdChanged && profileCityId
            ? {
                city_id: profileCityId,
                city_name: prof?.city_name ?? currentUser.city_name,
              }
            : {}),
          ...(cityNameChanged && prof?.city_name ? { city_name: prof.city_name } : {}),
          ...(isExpertChanged ? { is_expert: serverIsExpert } : {}),
          ...(canAccessProSorguChanged
            ? { can_access_prosorgu: serverCanAccessProSorgu }
            : {}),
        } as unknown as Record<string, unknown>);

        setState((prev) => {
          if (!prev.user || prev.user.id !== currentUser.id) return prev;
          return { ...prev, user: updatedUser };
        });

        // Persist so next cold start has fresh data.
        storageService.setUser(updatedUser).catch(() => {});
      } catch {
        // best-effort
      } finally {
        hydrateFullNameInFlightRef.current = false;
      }
    })();
  }, [state.isAuthenticated, state.user]);

  /**
   * Oturum sona erdiğinde (refresh fail veya 401) state'i güncelle.
   * creditService.authFetch → authService.refreshToken() veya 401 → bu callback.
   */
  useEffect(() => {
    setOnSessionExpired(() => {
      void clearStoredHomeMapCityId();
      void clearDeviceSavedQueriesOnLogout();
      setState({
        user: null,
        tokens: null,
        isLoading: false,
        isAuthenticated: false,
      });
    });
    return () => setOnSessionExpired(null);
  }, []);

  /**
   * E-posta veya telefon/şifre ile giriş
   */
  const persistHomeMapCityAfterAuth = useCallback(async (user: User | undefined) => {
    const fromUser = pickCityIdFromUser(user);
    if (fromUser) {
      await setStoredHomeMapCityId(fromUser);
      return;
    }
    await fetchProfileCityIdAndStore();
  }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<LoginResult> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const response = await authService.login({ identifier, password });

    if (response.success && response.data?.access && response.data?.refresh && response.data?.user) {
      const normalized = normalizeAuthUser(response.data.user as unknown as Record<string, unknown>);
      void persistHomeMapCityAfterAuth(response.data.user);
      void ensureDeviceSavedQueriesOwner(normalized.id);
      setState({
        user: normalized,
        tokens: { access: response.data.access, refresh: response.data.refresh },
        isLoading: false,
        isAuthenticated: true,
      });
      return { success: true, message: response.message };
    }

    setState((prev) => ({ ...prev, isLoading: false }));
    return {
      success: false,
      message: response.message || "Geçersiz e-posta/telefon veya şifre.",
    };
  }, [persistHomeMapCityAfterAuth]);

  /**
   * OTP ile giriş
   */
  const loginWithOTP = useCallback(async (phone_number: string, otp: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const response = await authService.loginWithOTP({ phone_number, otp });

    if (response.success && response.data) {
      const normalized = normalizeAuthUser(response.data.user as unknown as Record<string, unknown>);
      void persistHomeMapCityAfterAuth(response.data.user);
      void ensureDeviceSavedQueriesOwner(normalized.id);
      setState({
        user: normalized,
        tokens: { access: response.data.access, refresh: response.data.refresh },
        isLoading: false,
        isAuthenticated: true,
      });
      return true;
    }

    setState((prev) => ({ ...prev, isLoading: false }));
    return false;
  }, [persistHomeMapCityAfterAuth]);

  /**
   * Kayıt ol
   */
  const register = useCallback(async (data: RegisterRequest): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const response = await authService.register(data);

    if (response.success && response.data) {
      const normalized = normalizeAuthUser(response.data.user as unknown as Record<string, unknown>);
      void persistHomeMapCityAfterAuth(response.data.user);
      void ensureDeviceSavedQueriesOwner(normalized.id);
      setState({
        user: normalized,
        tokens: { access: response.data.access, refresh: response.data.refresh },
        isLoading: false,
        isAuthenticated: true,
      });
      return true;
    }

    setState((prev) => ({ ...prev, isLoading: false }));
    return false;
  }, [persistHomeMapCityAfterAuth]);

  const syncSessionFromLoginResponse = useCallback(async (data: NonNullable<LoginResponse["data"]>) => {
    const normalized = normalizeAuthUser(data.user as unknown as Record<string, unknown>);
    await storageService.setTokens({
      access: data.access,
      refresh: data.refresh,
    });
    await storageService.setUser(normalized);
    void persistHomeMapCityAfterAuth(data.user);
    void ensureDeviceSavedQueriesOwner(normalized.id);
    setState({
      user: normalized,
      tokens: { access: data.access, refresh: data.refresh },
      isLoading: false,
      isAuthenticated: true,
    });
  }, [persistHomeMapCityAfterAuth]);

  /**
   * Çıkış yap
   */
  const logout = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));
    
    await authService.logout();
    await clearStoredHomeMapCityId();
    await clearDeviceSavedQueriesOnLogout();

    setState({
      user: null,
      tokens: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  /**
   * Token yenile
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const newTokens = await authService.refreshToken();

    if (newTokens) {
      setState((prev) => ({
        ...prev,
        tokens: newTokens,
      }));
      return true;
    }

    // Refresh başarısız - logout
    setState({
      user: null,
      tokens: null,
      isLoading: false,
      isAuthenticated: false,
    });
    return false;
  }, []);

  /**
   * OTP gönder
   */
  const sendOTP = useCallback(async (phone_number: string): Promise<boolean> => {
    const response = await authService.sendOTP({ phone_number });
    return response.success;
  }, []);

  /**
   * OTP doğrula
   */
  const verifyOTP = useCallback(async (phone_number: string, otp: string): Promise<boolean> => {
    const response = await authService.verifyOTP({ phone_number, otp });
    return response.success;
  }, []);

  /**
   * Şifre sıfırlama - Çok adımlı akış
   */
  const resetPassword = useCallback(async (email: string): Promise<boolean> => {
    const response = await authService.requestPasswordReset({ email, step: 'email' });
    return response.success;
  }, []);

  /**
   * Profil güncelle
   */
  const updateProfile = useCallback(async (data: ProfileUpdateRequest): Promise<boolean> => {
    const response = await authService.updateProfile(data);
    if (response.success && data.city_id != null && Number(data.city_id) > 0) {
      await setStoredHomeMapCityId(Number(data.city_id));
    }
    return response.success;
  }, []);

  // Context value
  const contextValue = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      loginWithOTP,
      register,
      syncSessionFromLoginResponse,
      logout,
      refreshToken,
      sendOTP,
      verifyOTP,
      resetPassword,
      updateProfile,
    }),
    [state, login, loginWithOTP, register, syncSessionFromLoginResponse, logout, refreshToken, sendOTP, verifyOTP, resetPassword, updateProfile]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth hook - AuthContext'e erişim
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}

export default AuthContext;
