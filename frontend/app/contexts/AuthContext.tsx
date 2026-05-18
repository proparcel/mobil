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
  RegisterRequest,
  User,
} from "../../src/types/auth";

// Default context value
const defaultContextValue: AuthContextValue = {
  user: null,
  tokens: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => false,
  loginWithOTP: async () => false,
  register: async () => false,
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
          setState({
            user,
            tokens,
            isLoading: false,
            isAuthenticated: true,
          });
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
   * Updates full_name (if missing) and always syncs role/vip_started_at
   * so that admin-side VIP assignments are reflected without re-login.
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
        if (!profile && !serverUser) return;

        const derivedFullName =
          String(serverUser?.full_name || "").trim() ||
          [profile?.first_name, profile?.last_name]
            .map((v) => (v == null ? "" : String(v)).trim())
            .filter(Boolean)
            .join(" ")
            .trim();

        // Determine what changed
        const serverRole = serverUser?.role || currentUser.role;
        const serverVipStartedAt = serverUser?.vip_started_at ?? currentUser.vip_started_at;
        const nameChanged = derivedFullName && derivedFullName !== (currentUser.full_name || "").trim();
        const roleChanged = serverRole !== currentUser.role;
        const vipChanged = serverVipStartedAt !== currentUser.vip_started_at;

        if (!nameChanged && !roleChanged && !vipChanged) return;

        const updatedUser: User = {
          ...currentUser,
          ...(nameChanged ? { full_name: derivedFullName } : {}),
          ...(roleChanged ? { role: serverRole } : {}),
          ...(vipChanged ? { vip_started_at: serverVipStartedAt } : {}),
        };

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
  const login = useCallback(async (identifier: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const response = await authService.login({ identifier, password });

    if (response.success && response.data) {
      setState({
        user: response.data.user,
        tokens: { access: response.data.access, refresh: response.data.refresh },
        isLoading: false,
        isAuthenticated: true,
      });
      return true;
    }

    setState((prev) => ({ ...prev, isLoading: false }));
    return false;
  }, []);

  /**
   * OTP ile giriş
   */
  const loginWithOTP = useCallback(async (phone_number: string, otp: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const response = await authService.loginWithOTP({ phone_number, otp });

    if (response.success && response.data) {
      setState({
        user: response.data.user,
        tokens: { access: response.data.access, refresh: response.data.refresh },
        isLoading: false,
        isAuthenticated: true,
      });
      return true;
    }

    setState((prev) => ({ ...prev, isLoading: false }));
    return false;
  }, []);

  /**
   * Kayıt ol
   */
  const register = useCallback(async (data: RegisterRequest): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const response = await authService.register(data);

    if (response.success && response.data) {
      setState({
        user: response.data.user,
        tokens: { access: response.data.access, refresh: response.data.refresh },
        isLoading: false,
        isAuthenticated: true,
      });
      return true;
    }

    setState((prev) => ({ ...prev, isLoading: false }));
    return false;
  }, []);

  /**
   * Çıkış yap
   */
  const logout = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));
    
    await authService.logout();
    
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
    return response.success;
  }, []);

  // Context value
  const contextValue = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      loginWithOTP,
      register,
      logout,
      refreshToken,
      sendOTP,
      verifyOTP,
      resetPassword,
      updateProfile,
    }),
    [state, login, loginWithOTP, register, logout, refreshToken, sendOTP, verifyOTP, resetPassword, updateProfile]
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
