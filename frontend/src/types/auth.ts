/**
 * ProParcel Authentication Type Definitions
 * 
 * Kullanıcı kimlik doğrulama ve profil tipleri.
 */

/** @deprecated Legacy — API artık role döndürmez; member_type + customer_type kullanın. */
export type UserRole = "admin" | "user" | "consultant" | "broker" | "vip" | "vip_limited";

/** Abonelik paketi — GET /api/profile/read/ → data.user.customer_type */
export type CustomerType =
  | 'basic'
  | 'business'
  | 'silver'
  | 'gold'
  | 'vip'
  | 'vip_limited'
  | 'premium';

export type MemberType = 'individual' | 'consultant' | 'corporate' | 'admin' | 'expert';

export type CorporateType = 'emlak' | 'lihkab' | 'spk' | 'editor' | 'none';

/** Özellik kapıları — GET /api/profile/read/ → data.features */
export interface CustomerFeatureFlags {
  smart_query?: boolean;
}

// Kullanıcı temel bilgileri
export interface User {
  id: number;
  email: string;
  phone_number?: string;
  /** @deprecated Kanonik: member_type + customer_type */
  role?: UserRole;
  member_type?: MemberType;
  corporate_type?: CorporateType | null;
  is_phone_verified: boolean;
  is_email_verified: boolean;
  social_provider?: "google" | "apple" | null;
  full_name?: string;
  created_at: string;
  // VIP üyelik
  vip_started_at?: string | null;
  // İlk üyelik hoşgeldin modalı
  has_seen_welcome?: boolean;
  // İlk giriş tour overlay (ekran görüntüsü + Pro Sorgu)
  has_seen_app_tour?: boolean;
  /** Admin — is_admin || is_staff || is_superuser || member_type=admin */
  is_admin?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  /** GET /api/profile/read/ → data.public.membership_display */
  membership_display?: string;
  /** Profil adresi — ana harita hızlı il odaklama (yerel önbellek) */
  city_id?: number;
  city_name?: string;
  /** Abonelik seviyesi (varsayılan: basic) */
  customer_type?: CustomerType;
  /** Lookup catalog ID (API read-only, gelecek) */
  customer_type_id?: number;
  /** Sunucu özellik kapıları */
  features?: CustomerFeatureFlags;
  /** Uzman üyelik bayrağı — login/JWT ve profil read ile senkron */
  is_expert?: boolean;
  /** GET /api/profile/ → data.can_access_prosorgu */
  can_access_prosorgu?: boolean;
}

/** GET /api/profile/ → data.public (mongo-first read model) */
export interface ProfilePublic {
  is_expert?: boolean;
  membership_display?: string;
  member_type?: MemberType;
  member_type_id?: number;
  customer_type?: CustomerType;
  customer_type_id?: number;
  effective_corporate_type?: CorporateType | null;
  can_access_prosorgu?: boolean;
  /** Backend henüz profile read'e eklemediyse opsiyonel */
  can_access_vault?: boolean;
  expert_score_current?: number;
  expert_score_peak?: number;
  expert_level?: UserProfile["expert_level"];
}

// Kullanıcı profili
export interface UserProfile {
  email: string;
  phone_number?: string;
  /** @deprecated Kanonik: member_type */
  role?: UserRole;
  first_name: string;
  last_name: string;
  avatar?: string;
  avatar_url?: string;
  pending_avatar?: string;
  pending_avatar_url?: string;
  avatar_approved?: boolean;
  pending_avatar_uploaded_at?: string;
  avatar_rejection_reason?: string;
  avatar_rejected_at?: string;
  company_name?: string;
  address_line1?: string;
  city?: string;
  district?: string;
  postal_code?: string;
  street_and_number?: string;
  created_at: string;
  updated_at: string;
  // Üye tipi ve firma bilgileri
  // `expert` legacy veriler için tutulur; yeni kayıtlarda kanonik kurumsal tip `corporate`tır.
  member_type?: MemberType;
  member_type_id?: number;
  customer_type?: CustomerType;
  customer_type_id?: number;
  /** Danışman için parent firma alt tipi (runtime) */
  effective_corporate_type?: CorporateType | null;
  membership_display?: string;
  company_relation?: CompanyProfile; // Bireysel için bağlı firma
  company_relation_id?: number;
  parent_company?: CompanyProfile; // Hangi firmaya bağlı
  parent_company_id?: number;
  is_company_authority?: boolean; // Kurumsal yetkili mi?
  // Kurumsal üyelik bilgileri
  corporate_type?: CorporateType | null;
  company_meta?: {
    corporate_type?: CorporateType | null;
    corporate_type_label?: string | null;
    effective_corporate_type?: CorporateType | null;
  };
  company_license_no?: string;
  office_no?: string;
  spk_tc_no?: string;
  emlak_yetki_belge_no?: string;
  vergi_no?: string;
  vergi_dairesi?: string;
  company_logo?: string;
  company_logo_url?: string;
  pending_logo?: string;
  pending_logo_url?: string;
  logo_approved?: boolean;
  pending_logo_uploaded_at?: string;
  logo_rejection_reason?: string;
  logo_rejected_at?: string;
  // Adres detayları
  city_id?: number;
  city_name?: string;
  district_id?: number;
  district_name?: string;
  quarter_id?: number;
  quarter_name?: string;
  quarter_value?: number;
  // Uzmanlık puanı (is_expert üyeler için anlamlı)
  expert_score_current?: number;
  expert_score_peak?: number;
  expert_score_updated_at?: string;
  expert_level?: "first_experience" | "advisor" | "bronze" | "silver" | "gold" | "platinum" | null;
  // Uzmanlık bölgeleri (danışman/kurumsal için)
  expertise_areas?: UserExpertiseArea[];
  provider_coverages?: ProviderCoverageDistrict[];
  // Bekleyen istekler (bireysel için)
  pending_requests?: CompanyMembershipRequest[];
  // Bekleyen onaylar (kurumsal için)
  pending_membership_requests?: CompanyMembershipRequest[];
  // Alt kullanıcılar (kurumsal yetkili için)
  sub_users?: ProfileSubUser[];
  /** GET /api/profile/read/ → data.public.is_expert */
  is_expert?: boolean;
}

/** Kurumsal firma alt kullanıcısı — GET /api/profile/ */
export interface ProfileSubUser {
  id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  user?: { id: number; email: string };
}

/** GET /api/profile/company/credit-allocations/ */
export interface CompanyCreditAllocationItem {
  consultant_user_id: number;
  consultant_profile_id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  monthly_limit: number;
  current_period?: string;
  period_allocated?: number;
  period_returned?: number;
  period_net_allocated?: number;
  consultant_balance?: number;
  updated_at?: string | null;
}

export interface CompanyCreditAllocationsData {
  items: CompanyCreditAllocationItem[];
  company_balance: number;
}

export interface ProviderCoverageDistrict {
  id: number;
  city_id: number;
  city_name?: string | null;
  district_id: number;
  district_name?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Abonelik bilgisi
export interface Subscription {
  id: number;
  plan_type: "free" | "basic" | "premium" | "enterprise";
  plan_type_display: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  is_expired: boolean;
  created_at: string;
}

// JWT Token'lar
export interface AuthTokens {
  access: string;
  refresh: string;
}

// Login Response
export interface LoginResponse {
  success: boolean;
  message: string;
  data?: AuthTokens & {
    user: User;
  };
  errors?: Record<string, string[]>;
}

// Register Request
export interface RegisterRequest {
  member_type: 'individual' | 'consultant' | 'corporate';
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string; // opsiyonel; girilirse SMS OTP akışı uygulanır
  password: string;
  password_confirm: string;
  referral_code?: string; // opsiyonel (deferred deep link / manuel)
  /** Danışman kayıt — bağlanılacak kurumsal UserProfile.id (zorunlu) */
  company_profile_id?: number;
  /** @deprecated legacy — danışman kayıtta kullanılmaz */
  company_vergi_no?: string;
  emlak_yetki_belge_no?: string;
  consultant_license_no?: string;
  company_name?: string; // kurumsal için opsiyonel; boşsa ad+soyad kullanılır
  corporate_type?: CorporateType; // Emlak Firması, SPK Lisanslı Değerleme Firması veya Lihkab Büro
  company_license_no?: string; // kurumsal için zorunlu; emlak: 7 haneli TTBS yetki belge no
  city_id?: number; // opsiyonel; kurumsal emlak TTBS sorgusunda il_id
  district_id?: number;
  quarter_id?: number;
  quarter_value?: number;
  city_name?: string;
  district_name?: string;
  quarter_name?: string;
  street_and_number?: string;
  postal_code?: string;
  office_no?: string; // LIHKAB için zorunlu (Büro No)
  spk_tc_no?: string; // SPK seçiliyse zorunlu (TC Kimlik No)
  education_level?: number;
  university_id?: number;
  department_id?: number;
  custom_department?: string;
  step?: 'validate' | 'send_otp' | 'verify_otp'; // çok adımlı akış için
  otp?: string; // verify_otp adımında
  expertise_quarters?: string; // virgülle ayrılmış quarter_value listesi
  expertise_cities?: string; // virgülle ayrılmış city_id listesi (SPK)
  /** Kurumsal emlak/lihkab için isteğe bağlı; SPK kayıtta backend otomatik true yapar */
  is_expert?: boolean;
}

// Login Request
export interface LoginRequest {
  identifier: string; // email veya phone
  password: string;
}

// OTP Send Request
export interface OTPSendRequest {
  phone_number: string;
}

// OTP Verify Request
export interface OTPVerifyRequest {
  phone_number: string;
  otp: string;
}

// OTP Login Request
export interface OTPLoginRequest {
  phone_number: string;
  otp: string;
}

// Password Reset Request
export interface PasswordResetRequest {
  email: string;
  phone_number?: string; // phone ve verify_otp adımlarında
  step?: 'email' | 'phone' | 'verify_otp'; // çok adımlı akış için
  otp?: string; // verify_otp adımında
}

// Password Reset Confirm Request
export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
  password_confirm: string;
}

// Profile Update Request
export interface ProfileUpdateRequest {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  corporate_type?: CorporateType | null;
  company_license_no?: string;
  office_no?: string;
  spk_tc_no?: string;
  address_line1?: string;
  city?: string;
  district?: string;
  street_and_number?: string;
  city_id?: number;
  city_name?: string;
  district_id?: number;
  district_name?: string;
  quarter_id?: number;
  quarter_name?: string;
  quarter_value?: number;
  emlak_yetki_belge_no?: string;
}

export interface UserExpertiseArea {
  quarter_value: number;
  is_prime: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserBadge {
  code: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  awarded_at: string;
  meta_json?: string | null;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

// Auth Context State
export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Auth Context Actions
export interface LoginResult {
  success: boolean;
  message?: string;
}

export interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<LoginResult>; // identifier: email veya phone
  loginWithOTP: (phone_number: string, otp: string) => Promise<boolean>;
  register: (data: RegisterRequest) => Promise<boolean>;
  syncSessionFromLoginResponse: (data: NonNullable<LoginResponse["data"]>) => void | Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  sendOTP: (phone_number: string) => Promise<boolean>;
  verifyOTP: (phone_number: string, otp: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (data: ProfileUpdateRequest) => Promise<boolean>;
}

// Firma profili
export interface CompanyProfile {
  id: number;
  company_name: string;
  vergi_no?: string | null;
  vergi_dairesi?: string;
  corporate_type?: CorporateType | null;
  company_logo?: string;
  is_company_authority?: boolean;
}

/** Danışman kayıt / firma bağlantı listesi — GET /api/auth/company/list/ */
export interface RegistrationCompanyItem {
  company_profile_id: number;
  company_name: string;
  corporate_type?: 'emlak' | 'spk' | 'lihkab' | null;
  vergi_no?: string | null;
}

// Firma bağlantı isteği
export interface CompanyMembershipRequest {
  id: number;
  individual_user: User;
  company_profile_id?: number;
  company_name?: string;
  /** @deprecated legacy */
  company_vergi_no?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  responded_at?: string;
  responded_by?: User;
  notes?: string;
}
