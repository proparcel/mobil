import type { CustomerType, ProfilePublic, User, UserProfile } from '../types/auth';
import { parseCustomerFeatureFlags } from './customerFeatureGates';

export type MemberType = 'individual' | 'consultant' | 'corporate' | 'admin' | 'expert';
export type CorporateType = 'emlak' | 'lihkab' | 'spk' | 'editor' | 'none';

const VIP_CUSTOMER_TYPES = new Set<CustomerType>(['vip', 'vip_limited', 'premium']);

function lower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function readProfileMemberType(profile?: UserProfile | null): string {
  return lower(profile?.member_type);
}

function readUserMemberType(user?: User | null, profile?: UserProfile | null): string {
  return readProfileMemberType(profile) || lower(user?.member_type);
}

export function normalizeAuthUser(raw: Record<string, unknown> | User): User {
  const obj = { ...(raw as Record<string, unknown>) };
  // Legacy AsyncStorage — role artık okunmaz / persist edilmez
  delete obj.role;
  const customerType = (lower(obj.customer_type) || 'basic') as CustomerType;
  const memberTypeRaw = lower(obj.member_type);
  const features = parseCustomerFeatureFlags(obj.features);
  const isAdmin =
    obj.is_admin === true || obj.is_staff === true || obj.is_superuser === true;

  const isExpert =
    obj.is_expert === true
      ? true
      : obj.is_expert === false
        ? false
        : undefined;

  return {
    ...(obj as unknown as User),
    customer_type: customerType,
    ...(memberTypeRaw ? { member_type: memberTypeRaw as User['member_type'] } : {}),
    is_admin: isAdmin,
    ...(features ? { features } : {}),
    ...(isExpert !== undefined ? { is_expert: isExpert } : {}),
  };
}

function readIsExpertFlag(
  user?: User | null,
  profile?: UserProfile | null,
  publicProfile?: ProfilePublic | null,
): boolean | undefined {
  for (const value of [user?.is_expert, profile?.is_expert, publicProfile?.is_expert]) {
    if (value === true) return true;
    if (value === false) return false;
  }
  return undefined;
}

/** Uzman rozeti, uzman görüşü ve maliyet satırı — stored is_expert bayrağı */
export function isExpertUser(
  user?: User | null,
  profile?: UserProfile | null,
  publicProfile?: ProfilePublic | null,
): boolean {
  return readIsExpertFlag(user, profile, publicProfile) === true;
}

export function isIndividualMember(
  user?: User | null,
  profile?: UserProfile | null,
): boolean {
  const memberType = readUserMemberType(user, profile);
  if (memberType === 'consultant' || memberType === 'corporate' || memberType === 'expert') {
    return false;
  }
  if (memberType === 'individual') return true;
  if (memberType === 'admin') return false;
  return true;
}

export function isConsultantMember(profile?: UserProfile | null, user?: User | null): boolean {
  return readUserMemberType(user, profile) === 'consultant';
}

export function isCorporateMember(profile?: UserProfile | null, user?: User | null): boolean {
  const memberType = readUserMemberType(user, profile);
  return memberType === 'corporate' || memberType === 'expert';
}

/** Danışman veya kurumsal üye — ProSorgu / sandık erişimi (is_expert ile karıştırma) */
export function isExpertMember(user?: User | null, profile?: UserProfile | null): boolean {
  return isConsultantMember(profile, user) || isCorporateMember(profile, user);
}

export function isVipCustomer(user?: User | null): boolean {
  if (!user) return false;
  const ct = (user.customer_type || 'basic') as CustomerType;
  return VIP_CUSTOMER_TYPES.has(ct);
}

export function isPlatformAdmin(user?: User | null): boolean {
  if (!user) return false;
  if (user.is_admin === true) return true;
  if (user.is_staff === true || user.is_superuser === true) return true;
  return lower(user.member_type) === 'admin';
}

export function effectiveCorporateType(profile?: UserProfile | null): CorporateType | null {
  if (!profile) return null;

  const memberType = readProfileMemberType(profile);
  if (memberType === 'consultant') {
    const fromParent =
      lower(profile.parent_company?.corporate_type) ||
      lower(profile.company_relation?.corporate_type) ||
      lower(profile.company_meta?.corporate_type) ||
      lower(profile.effective_corporate_type);
    return (fromParent || null) as CorporateType | null;
  }

  const own = lower(profile.corporate_type) || lower(profile.effective_corporate_type);
  return (own || null) as CorporateType | null;
}

export function canAccessProSorgu(
  user?: User | null,
  profile?: UserProfile | null,
  apiFlag?: boolean | null,
): boolean {
  if (apiFlag === true) return true;
  if (apiFlag === false) return false;
  if (!user) return true;
  if (isPlatformAdmin(user)) return true;
  if (user.can_access_prosorgu === true) return true;
  if (user.can_access_prosorgu === false) return false;
  if (isIndividualMember(user, profile)) return false;
  return true;
}

export function membershipDisplayLabel(
  user?: User | null,
  profile?: UserProfile | null,
  publicProfile?: ProfilePublic | null,
): string | null {
  const label =
    publicProfile?.membership_display?.trim() ||
    profile?.membership_display?.trim() ||
    user?.membership_display?.trim();
  return label || null;
}

export function canUseSmartQueryFromMembership(user?: User | null): boolean {
  if (!user) return false;
  if (user.features?.smart_query === true) return true;
  const ct = lower(user.customer_type || 'basic');
  return ['business', 'silver', 'gold', 'premium', 'vip', 'vip_limited'].includes(ct);
}

export function canViewExpertScore(user?: User | null, profile?: UserProfile | null): boolean {
  return isExpertUser(user, profile);
}

export function canSeeEmsalSalesReportMenu(
  user?: User | null,
  profile?: UserProfile | null,
): boolean {
  if (isPlatformAdmin(user)) return true;
  return isExpertUser(user, profile);
}

export function isLihkabSubtype(profile?: UserProfile | null): boolean {
  return effectiveCorporateType(profile) === 'lihkab';
}