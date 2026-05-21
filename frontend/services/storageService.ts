/**
 * ProParcel Storage Service
 * 
 * Token ve kullanıcı verilerinin güvenli saklanması.
 * AsyncStorage kullanarak veri saklama işlemlerini yönetir.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthTokens, User } from "../src/types/auth";

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: "proparcel_access_token",
  REFRESH_TOKEN: "proparcel_refresh_token",
  USER: "proparcel_user",
  REDIRECT_AFTER_LOGIN: "proparcel_redirect_after_login",
  DEFERRED_REFERRAL_CODE: "proparcel_deferred_referral_code",
  /** İlk açılış cinematic intro tamamlandı — sonraki cold start doğrudan haritaya */
  SKIP_LANDING_INTRO: "proparcel_skip_landing_intro",
} as const;

/** Redirect-after-login target. Use "model-editor" to open ShapeDrawingModal after login/register. */
export const REDIRECT_TARGET_MODEL_EDITOR = "model-editor" as const;

/**
 * Storage Service - Token ve kullanıcı verilerini yönetir
 */
class StorageService {
  /**
   * Access token kaydet
   */
  async setAccessToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    } catch (error) {
      console.error("[storageService.ts:28] Access token kaydetme hatası:", error);
    }
  }

  /**
   * Access token al
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error("[storageService.ts:39] Access token okuma hatası:", error);
      return null;
    }
  }

  /**
   * Refresh token kaydet
   */
  async setRefreshToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
    } catch (error) {
      console.error("[storageService.ts:51] Refresh token kaydetme hatası:", error);
    }
  }

  /**
   * Refresh token al
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error("[storageService.ts:62] Refresh token okuma hatası:", error);
      return null;
    }
  }

  /**
   * Her iki token'ı kaydet
   */
  async setTokens(tokens: AuthTokens): Promise<void> {
    await Promise.all([
      this.setAccessToken(tokens.access),
      this.setRefreshToken(tokens.refresh),
    ]);
  }

  /**
   * Her iki token'ı al
   */
  async getTokens(): Promise<AuthTokens | null> {
    const [access, refresh] = await Promise.all([
      this.getAccessToken(),
      this.getRefreshToken(),
    ]);

    if (access && refresh) {
      return { access, refresh };
    }
    return null;
  }

  /**
   * Kullanıcı bilgisini kaydet
   */
  async setUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error("[storageService.ts:99] User kaydetme hatası:", error);
    }
  }

  /**
   * Kullanıcı bilgisini al
   */
  async getUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (userJson) {
        return JSON.parse(userJson) as User;
      }
      return null;
    } catch (error) {
      console.error("[storageService.ts:114] User okuma hatası:", error);
      return null;
    }
  }

  /**
   * Tüm auth verilerini temizle (logout)
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.REDIRECT_AFTER_LOGIN,
        STORAGE_KEYS.DEFERRED_REFERRAL_CODE,
      ]);
    } catch (error) {
      console.error("[storageService.ts:130] Storage temizleme hatası:", error);
    }
  }

  /**
   * Auth verisi var mı kontrol et
   */
  async hasAuthData(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null;
  }

  /**
   * Redirect-after-login intent: giriş/kayıt sonrası nereye dönüleceği.
   * Örn. "model-editor" → index mount'ta ShapeDrawingModal açılır.
   */
  async setRedirectAfterLogin(value: string | null): Promise<void> {
    try {
      if (value == null) {
        await AsyncStorage.removeItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN, value);
      }
    } catch (error) {
      console.error("[storageService] setRedirectAfterLogin error:", error);
    }
  }

  async getRedirectAfterLogin(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN);
    } catch (error) {
      console.error("[storageService] getRedirectAfterLogin error:", error);
      return null;
    }
  }

  async clearRedirectAfterLogin(): Promise<void> {
    await this.setRedirectAfterLogin(null);
  }

  /**
   * Deferred referral code (Branch / deep link param) - register ekranında otomatik doldurulur.
   */
  async setDeferredReferralCode(code: string | null): Promise<void> {
    try {
      if (!code) {
        await AsyncStorage.removeItem(STORAGE_KEYS.DEFERRED_REFERRAL_CODE);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.DEFERRED_REFERRAL_CODE, code);
      }
    } catch (error) {
      console.error("[storageService] setDeferredReferralCode error:", error);
    }
  }

  async getDeferredReferralCode(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.DEFERRED_REFERRAL_CODE);
    } catch (error) {
      console.error("[storageService] getDeferredReferralCode error:", error);
      return null;
    }
  }

  async clearDeferredReferralCode(): Promise<void> {
    await this.setDeferredReferralCode(null);
  }

  /**
   * Landing cinematic intro bir kez gösterildi mi (App cold start route seçimi).
   */
  async getSkipLandingIntro(): Promise<boolean> {
    try {
      const v = await AsyncStorage.getItem(STORAGE_KEYS.SKIP_LANDING_INTRO);
      return v === "1";
    } catch (error) {
      console.error("[storageService] getSkipLandingIntro error:", error);
      return false;
    }
  }

  async setSkipLandingIntro(skip: boolean): Promise<void> {
    try {
      if (skip) {
        await AsyncStorage.setItem(STORAGE_KEYS.SKIP_LANDING_INTRO, "1");
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.SKIP_LANDING_INTRO);
      }
    } catch (error) {
      console.error("[storageService] setSkipLandingIntro error:", error);
    }
  }
}

// Singleton instance
export const storageService = new StorageService();
export default storageService;
