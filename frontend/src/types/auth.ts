/**
 * ProParcel Authentication Type Definitions
 * 
 * Kullanıcı kimlik doğrulama ve profil tipleri.
 */

// Kullanıcı rolleri
export type UserRole = "admin" | "user" | "consultant" | "broker" | "vip" | "vip_limited";

// Kullanıcı temel bilgileri
export interface User {
  id: number;
  email: string;
  phone_number?: string;
  role: UserRole;
  member_type?: 'individual' | 'consultant' | 'corporate' | 'expert';
  consultant_type?: 'emlak' | 'spk' | 'lihkab' | null;
  corporate_type?: 'emlak' | 'spk' | 'lihkab' | null;
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
  // Admin kontrolü (role == admin || is_staff || is_superuser)
  is_admin?: boolean;
}

// Kullanıcı profili
export interface UserProfile {
  email: string;
  phone_number?: string;
  role: UserRole;
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
  member_type?: 'individual' | 'consultant' | 'corporate' | 'expert';
  company_relation?: CompanyProfile; // Bireysel için bağlı firma
  company_relation_id?: number;
  parent_company?: CompanyProfile; // Hangi firmaya bağlı
  parent_company_id?: number;
  is_company_authority?: boolean; // Kurumsal yetkili mi?
  // Kurumsal üyelik bilgileri
  consultant_type?: 'emlak' | 'spk' | 'lihkab';
  corporate_type?: 'emlak' | 'spk' | 'lihkab';
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
  // Uzmanlık puanı (sadece consultant/broker için anlamlı)
  expert_score_current?: number;
  expert_score_peak?: number;
  expert_score_updated_at?: string;
  expert_level?: "first_experience" | "advisor" | "bronze" | "silver" | "gold" | "platinum" | null;
  // Uzmanlık bölgeleri (consultant/broker/kurumsal için)
  expertise_areas?: UserExpertiseArea[];
  provider_coverages?: ProviderCoverageDistrict[];
  // Bekleyen istekler (bireysel için)
  pending_requests?: CompanyMembershipRequest[];
  // Bekleyen onaylar (kurumsal için)
  pending_membership_requests?: CompanyMembershipRequest[];
  // Alt kullanıcılar (kurumsal yetkili için)
  sub_users?: UserProfile[];
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
  phone_number: string; // artık zorunlu
  password: string;
  password_confirm: string;
  referral_code?: string; // opsiyonel (deferred deep link / manuel)
  // Danışman için zorunlu: bağlanmak istediği firmanın vergi no'su
  company_vergi_no?: string;
  consultant_type?: 'emlak' | 'spk' | 'lihkab';
  consultant_license_no?: string;
  company_name?: string; // kurumsal için zorunlu
  corporate_type?: 'emlak' | 'spk' | 'lihkab'; // Emlak Firması, SPK Lisanslı Değerleme Firması veya Lihkab Büro
  company_license_no?: string; // kurumsal için zorunlu; emlak: 7 haneli TTBS yetki belge no
  city_id?: number; // opsiyonel; kurumsal emlak TTBS sorgusunda il_id
  office_no?: string; // LIHKAB için zorunlu (Büro No)
  spk_tc_no?: string; // SPK seçiliyse zorunlu (TC Kimlik No)
  vergi_no?: string; // kurumsal için zorunlu (10 rakam)
  vergi_dairesi?: string; // kurumsal için zorunlu
  step?: 'validate' | 'send_otp' | 'verify_otp'; // çok adımlı akış için
  otp?: string; // verify_otp adımında
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
  consultant_type?: 'emlak' | 'spk' | 'lihkab' | null;
  corporate_type?: 'emlak' | 'spk' | 'lihkab' | null;
  company_license_no?: string;
  office_no?: string;
  spk_tc_no?: string;
  vergi_no?: string;
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
  vergi_dairesi?: string;
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
  vergi_no: string;
  vergi_dairesi?: string;
  corporate_type?: 'emlak' | 'spk' | 'lihkab' | null;
  company_logo?: string;
  is_company_authority?: boolean;
}

// Firma bağlantı isteği
export interface CompanyMembershipRequest {
  id: number;
  individual_user: User;
  company_vergi_no: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  responded_at?: string;
  responded_by?: User;
  notes?: string;
}
