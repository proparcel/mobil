/**
 * ProParcel Profile Screen
 * 
 * Kullanıcı profili görüntüleme ve düzenleme - Bireysel ve Kurumsal ayrımı ile.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  FlatList,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { StatusBar } from "react-native";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../../services/authService";
import { companyService } from "../../services/companyService";
import { creditService } from "../../services/creditService";
import type { UserProfile, CompanyProfile, CompanyMembershipRequest, UserExpertiseArea, ProviderCoverageDistrict } from "../../src/types/auth";
import { launchImageLibrary } from "react-native-image-picker";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { SvgUri } from "react-native-svg";
import type { BadgeOverviewItem } from "../../src/types/badges";
import type { CreditBalance, CreditHistoryItem, CreditStats } from "../../services/creditService";
import locationsJson from "../../src/data/locations.json";
import { API_URL } from "../../config/api";
import { AddressPickerModal, type AddressValue } from "../../components/app/AddressPickerModal";
import ProfileMenuSheet from "../../components/app/ProfileMenuSheet";
import ProfileGenelOverview from "../../components/app/ProfileGenelOverview";
import ProfileRatingsComments from "../../components/app/ProfileRatingsComments";
import { PROFILE_SECTION_LABELS, type ProfileSectionId } from "../../components/app/profileSectionTypes";
import { deactivateListing, getMyListings } from "../../services/listingService";
import { getPortalRecentQueries, getPortalUserAgentRatings } from "../../services/portalService";
import type { MineListingRow } from "../../src/types/listing";
import type { PortalQueryListItem } from "../../src/types/portal";

// İl / İlçe / Mahalle seçim tipi (locations.json yapısı)
type QuarterItem = { Id: number; Tkgm_text?: string; Proparcel_text: string; Proparcel_value?: number | string };
type TownItem = { Id: number; Proparcel_text: string; Quarters: QuarterItem[] };
type CityItem = { Id: number; Proparcel_text: string; Towns: TownItem[] };
type LocationsData = { cities: CityItem[] };
const locationsData = locationsJson as unknown as LocationsData;

/** API'den gelen avatar/logo URL'i göreli ise mutlak URL'e çevir (mobilde resim yüklenmesi için) */
function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_URL.replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

/** İsim/soyisim baş harfini büyük yapar */
function capitalizeName(s: string | null | undefined): string {
  if (!s || !s.trim()) return "";
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, isAuthenticated } = useAuth();

  // State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  // Edit form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [streetAndNumber, setStreetAndNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [cityId, setCityId] = useState<number | null>(null);
  const [cityName, setCityName] = useState("");
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [districtName, setDistrictName] = useState("");
  const [quarterId, setQuarterId] = useState<number | null>(null);
  const [quarterName, setQuarterName] = useState("");
  const [quarterValue, setQuarterValue] = useState<number | null>(null);
  const [emlakYetkiBelgeNo, setEmlakYetkiBelgeNo] = useState("");
  // Modal state'leri
  const [showPersonalInfoModal, setShowPersonalInfoModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showCompanyInfoModal, setShowCompanyInfoModal] = useState(false);

  // Uzmanlık bölgeleri (max 5 mahalle)
  const [expertiseEditing, setExpertiseEditing] = useState(false);
  const [expertiseDraft, setExpertiseDraft] = useState<
    Array<{ quarter_value: number; label: string; is_prime?: boolean }>
  >([]);
  const [savingExpertiseAreas, setSavingExpertiseAreas] = useState(false);
  const [providerCoverageEditing, setProviderCoverageEditing] = useState(false);
  const [providerCoverageDraft, setProviderCoverageDraft] = useState<
    Array<{ city_id: number; district_id: number; label: string; is_primary?: boolean }>
  >([]);
  const [savingProviderCoverage, setSavingProviderCoverage] = useState(false);

  // Expertise picker modal state
  const [expertisePickerMode, setExpertisePickerMode] = useState<"city" | "town" | "quarter" | null>(null);
  const [expertisePickerSearch, setExpertisePickerSearch] = useState("");
  const [expCityId, setExpCityId] = useState<number | null>(null);
  const [expCityName, setExpCityName] = useState("");
  const [expTownId, setExpTownId] = useState<number | null>(null);
  const [expTownName, setExpTownName] = useState("");
  const [coveragePickerMode, setCoveragePickerMode] = useState<"city" | "town" | null>(null);
  const [coveragePickerSearch, setCoveragePickerSearch] = useState("");
  const [covCityId, setCovCityId] = useState<number | null>(null);
  const [covCityName, setCovCityName] = useState("");

  // Firma işlemleri state (bireysel için)
  const [vergiNo, setVergiNo] = useState("");
  const [searchingCompany, setSearchingCompany] = useState(false);
  const [foundCompany, setFoundCompany] = useState<CompanyProfile | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);

  // Şifre değiştirme state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordChangeStep, setPasswordChangeStep] = useState<"request_otp" | "enter_otp">("request_otp");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingPasswordOtp, setSendingPasswordOtp] = useState(false);

  // Hesap silme OTP state
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteStep, setDeleteStep] = useState<"password" | "otp">("password");
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Avatar: arka plan temizlensin mi? modal
  const [showRemoveBgModal, setShowRemoveBgModal] = useState(false);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  /** Rozet özeti (profil şeridi) */
  const [badgeStrip, setBadgeStrip] = useState<BadgeOverviewItem[]>([]);
  const [badgeEarnedCount, setBadgeEarnedCount] = useState<number | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileSection, setProfileSection] = useState<ProfileSectionId>("genel");
  const [mineListings, setMineListings] = useState<MineListingRow[]>([]);
  const [mineListingsLoading, setMineListingsLoading] = useState(false);
  const [proQueryRows, setProQueryRows] = useState<PortalQueryListItem[]>([]);
  const [proQueriesLoading, setProQueriesLoading] = useState(false);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [history, setHistory] = useState<CreditHistoryItem[]>([]);
  /** Genel Bakış: portal agent puanı (hero) */
  const [profileHeroRating, setProfileHeroRating] = useState<{
    avg: number | null;
    count: number;
  } | null>(null);
  const [profileHeroRatingLoading, setProfileHeroRatingLoading] = useState(false);
  const [usageSectionBusy, setUsageSectionBusy] = useState(false);

  /**
   * Profil bilgilerini yükle
   */
  const loadProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await authService.getProfile();
      
      if (response.success && response.data) {
        const data = response.data;
        const profileData = data.profile;
        const addressData = (data as any).address;
        // Backend payload: { profile, address, company_relation, pending_requests, ... }
        // UI expects these fields on the profile object, so we merge them in.
        // Address verisi ayrı geliyor - city_name, district_name, quarter_name içeriyor
        const mergedProfile: UserProfile = {
          ...profileData,
          // Address verilerini profile'a merge et (isim alanları address'den gelir)
          city_id: addressData?.city_id ?? (profileData as any).city_id,
          city_name: addressData?.city_name ?? (profileData as any).city_name,
          district_id: addressData?.district_id ?? (profileData as any).district_id,
          district_name: addressData?.district_name ?? (profileData as any).district_name,
          quarter_id: addressData?.quarter_id ?? (profileData as any).quarter_id,
          quarter_name: addressData?.quarter_name ?? (profileData as any).quarter_name,
          quarter_value: addressData?.quarter_value ?? (profileData as any).quarter_value,
          street_and_number: addressData?.street_and_number ?? (profileData as any).street_and_number,
          company_relation: (data as any).company_relation ?? (profileData as any).company_relation,
          pending_requests: (data as any).pending_requests ?? (profileData as any).pending_requests,
          pending_membership_requests:
            (data as any).pending_membership_requests ?? (profileData as any).pending_membership_requests,
          sub_users: (data as any).sub_users ?? (profileData as any).sub_users,
          expertise_areas: (data as any).expertise_areas ?? (profileData as any).expertise_areas,
          provider_coverages: (data as any).provider_coverages ?? (profileData as any).provider_coverages,
        };
        console.log("[Profile] Profil yüklendi:", {
          hasAvatarUrl: !!mergedProfile.avatar_url,
          hasPendingAvatarUrl: !!mergedProfile.pending_avatar_url,
          avatarApproved: mergedProfile.avatar_approved,
          firstName: mergedProfile.first_name,
          lastName: mergedProfile.last_name,
          hasCompanyRelation: !!mergedProfile.company_relation,
          pendingRequestsCount: (mergedProfile.pending_requests || []).length,
          pendingMembershipRequestsCount: (mergedProfile.pending_membership_requests || []).length,
          subUsersCount: (mergedProfile.sub_users || []).length,
          fullProfile: mergedProfile,
        });
        setProfile(mergedProfile);
        setFirstName(mergedProfile.first_name || "");
        setLastName(mergedProfile.last_name || "");
        setCompanyName(mergedProfile.company_name || "");
        setCity(mergedProfile.city || "");
        setDistrict(mergedProfile.district || "");
        setStreetAndNumber(mergedProfile.street_and_number || "");
        setAddressLine1(mergedProfile.address_line1 || "");
        setCityId(mergedProfile.city_id || null);
        setCityName(mergedProfile.city_name || "");
        setDistrictId(mergedProfile.district_id || null);
        setDistrictName(mergedProfile.district_name || "");
        setQuarterId(mergedProfile.quarter_id || null);
        setQuarterName(mergedProfile.quarter_name || "");
        setQuarterValue((mergedProfile as any).quarter_value || null);
        setEmlakYetkiBelgeNo(mergedProfile.emlak_yetki_belge_no || "");
      }
    } catch (error) {
      console.error("[Profile] Veri yükleme hatası:", error);
      Alert.alert("Hata", "Profil bilgileri yüklenemedi.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  const loadBadgeStrip = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authService.getBadgeOverview();
      if (!res.success || !res.data) {
        setBadgeStrip([]);
        setBadgeEarnedCount(null);
        return;
      }
      const earned: BadgeOverviewItem[] = [];
      const mb = res.data.main_badges || {};
      for (const key of Object.keys(mb)) {
        const g = mb[key as keyof typeof mb];
        if (!g?.items) continue;
        for (const it of g.items) {
          if (it.is_earned) earned.push(it);
        }
      }
      setBadgeStrip(earned.slice(0, 12));
      setBadgeEarnedCount(
        res.data.page_summary?.earned_badge_count ?? earned.length
      );
    } catch {
      setBadgeStrip([]);
      setBadgeEarnedCount(null);
    }
  }, [isAuthenticated]);

  const loadUsageData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [balanceRes, statsRes, historyRes] = await Promise.all([
        creditService.getBalance(),
        creditService.getStats(),
        creditService.getHistory(10),
      ]);
      if (balanceRes.success && balanceRes.data) setBalance(balanceRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (historyRes.success && historyRes.data) setHistory(historyRes.data.history || []);
    } catch (error) {
      console.error("[Profile] Kullanım verisi yükleme hatası:", error);
    }
  }, [isAuthenticated]);

  const quarterLabelByValue = useMemo(() => {
    const map = new Map<number, string>();
    const cities = locationsData?.cities ?? [];
    for (const c of cities) {
      for (const t of c.Towns ?? []) {
        for (const q of t.Quarters ?? []) {
          const raw = (q as any).Proparcel_value;
          const qv = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
          if (!Number.isFinite(qv)) continue;
          if (!map.has(qv)) {
            map.set(qv, q.Proparcel_text || q.Tkgm_text || String(qv));
          }
        }
      }
    }
    return map;
  }, []);

  const districtLabelByIds = useMemo(() => {
    const map = new Map<string, string>();
    const cities = locationsData?.cities ?? [];
    for (const c of cities) {
      for (const t of c.Towns ?? []) {
        map.set(`${c.Id}:${t.Id}`, `${c.Proparcel_text} / ${t.Proparcel_text}`);
      }
    }
    return map;
  }, []);

  const resetExpertiseDraftFromProfile = useCallback(
    (p: UserProfile | null) => {
      const areas = (p?.expertise_areas ?? []) as UserExpertiseArea[];
      const primeQv = p?.quarter_value ?? null;
      const next = (areas || [])
        .slice(0, 5)
        .map((a) => {
          const qv = Number((a as any).quarter_value);
          if (!Number.isFinite(qv)) return null;
          return {
            quarter_value: qv,
            label: quarterLabelByValue.get(qv) ?? String(qv),
            is_prime: Boolean((a as any).is_prime) || (primeQv !== null && Number(primeQv) === qv),
          };
        })
        .filter(Boolean) as Array<{ quarter_value: number; label: string; is_prime?: boolean }>;
      setExpertiseDraft(next);
    },
    [quarterLabelByValue]
  );

  const resetProviderCoverageDraftFromProfile = useCallback(
    (p: UserProfile | null) => {
      const rows = ((p?.provider_coverages ?? []) as ProviderCoverageDistrict[])
        .slice(0, 20)
        .map((row) => {
          const cityId = Number((row as any).city_id);
          const districtId = Number((row as any).district_id);
          if (!Number.isFinite(cityId) || !Number.isFinite(districtId)) return null;
          return {
            city_id: cityId,
            district_id: districtId,
            label:
              row.district_name && row.city_name
                ? `${row.city_name} / ${row.district_name}`
                : districtLabelByIds.get(`${cityId}:${districtId}`) ?? `${cityId}/${districtId}`,
            is_primary: Boolean((row as any).is_primary),
          };
        })
        .filter(Boolean) as Array<{ city_id: number; district_id: number; label: string; is_primary?: boolean }>;
      setProviderCoverageDraft(rows);
    },
    [districtLabelByIds]
  );

  // Profil yüklendiğinde (edit modunda değilken) uzmanlık bölgelerini senkronla
  useEffect(() => {
    if (!profile) return;
    if (expertiseEditing) return;
    resetExpertiseDraftFromProfile(profile);
  }, [profile, expertiseEditing, resetExpertiseDraftFromProfile]);

  useEffect(() => {
    if (!profile) return;
    if (providerCoverageEditing) return;
    resetProviderCoverageDraftFromProfile(profile);
  }, [profile, providerCoverageEditing, resetProviderCoverageDraftFromProfile]);

  const expertiseListData = useMemo(() => {
    const q = (expertisePickerSearch || "").trim().toLowerCase();
    if (expertisePickerMode === "city") {
      const list = locationsData?.cities ?? [];
      return q ? list.filter((c) => (c.Proparcel_text || "").toLowerCase().includes(q)) : list;
    }
    const currentCity = locationsData?.cities?.find((c) => c.Id === expCityId);
    if (expertisePickerMode === "town") {
      const list = currentCity?.Towns ?? [];
      return q ? list.filter((t) => (t.Proparcel_text || "").toLowerCase().includes(q)) : list;
    }
    if (expertisePickerMode === "quarter") {
      const currentTown = currentCity?.Towns?.find((t) => t.Id === expTownId);
      const list = currentTown?.Quarters ?? [];
      return q ? list.filter((qu) => ((qu.Proparcel_text || qu.Tkgm_text) || "").toLowerCase().includes(q)) : list;
    }
    return [];
  }, [expertisePickerMode, expertisePickerSearch, expCityId, expTownId]);

  const coverageListData = useMemo(() => {
    const q = (coveragePickerSearch || "").trim().toLowerCase();
    if (coveragePickerMode === "city") {
      const list = locationsData?.cities ?? [];
      return q ? list.filter((c) => (c.Proparcel_text || "").toLowerCase().includes(q)) : list;
    }
    const currentCity = locationsData?.cities?.find((c) => c.Id === covCityId);
    const towns = currentCity?.Towns ?? [];
    return q ? towns.filter((t) => (t.Proparcel_text || "").toLowerCase().includes(q)) : towns;
  }, [coveragePickerMode, coveragePickerSearch, covCityId]);

  /**
   * Pull to refresh
   */
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadProfile();
    loadBadgeStrip();
    loadUsageData();
  }, [loadProfile, loadBadgeStrip, loadUsageData]);

  /**
   * Sayfa odaklandığında verileri yükle
   */
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        setIsLoading(true);
        loadProfile();
        loadBadgeStrip();
        loadUsageData();
      }
    }, [isAuthenticated, loadProfile, loadBadgeStrip, loadUsageData])
  );

  useEffect(() => {
    if (!isAuthenticated || profileSection !== "ilanlar") return;
    let ignore = false;
    setMineListingsLoading(true);
    void getMyListings().then((res) => {
      if (ignore) return;
      if (res.ok && res.data?.items) setMineListings(res.data.items);
      else setMineListings([]);
      setMineListingsLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, profileSection]);

  useEffect(() => {
    if (!isAuthenticated || profileSection !== "prosorgular") return;
    let ignore = false;
    setProQueriesLoading(true);
    void getPortalRecentQueries({ mine: true, page: 1, page_size: 12 }).then((res) => {
      if (ignore) return;
      if (res.ok && res.data?.results) setProQueryRows(res.data.results);
      else setProQueryRows([]);
      setProQueriesLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, profileSection]);

  useEffect(() => {
    if (profileSection !== "genel" || !user?.id) {
      return;
    }
    let ignore = false;
    setProfileHeroRatingLoading(true);
    void getPortalUserAgentRatings(Number(user.id)).then((res) => {
      if (ignore) return;
      if (res.ok && res.data?.aggregate) {
        const a = res.data.aggregate;
        setProfileHeroRating({
          count: Number(a.count) || 0,
          avg: a.avg_overall != null ? Number(a.avg_overall) : null,
        });
      } else {
        setProfileHeroRating({ count: 0, avg: null });
      }
      setProfileHeroRatingLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [profileSection, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || profileSection !== "kullanimlarim") return;
    let ignore = false;
    setUsageSectionBusy(true);
    void loadUsageData().finally(() => {
      if (!ignore) setUsageSectionBusy(false);
    });
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, profileSection, loadUsageData]);

  const openListingEditor = useCallback(
    (listingId: string) => {
      router.push("portal-webview", {
        path: `/portal/ilan/${encodeURIComponent(listingId)}/duzenle/`,
        title: "İlan düzenle",
      });
    },
    [router],
  );

  const onDeactivateListingPress = useCallback((row: MineListingRow) => {
    const pub = String(row.publication_status || "").toLowerCase();
    if (pub !== "published") {
      Alert.alert("Bilgi", "Sadece yayında olan ilanlar pasife alınabilir.");
      return;
    }
    const v = row.version != null ? Number(row.version) : 0;
    Alert.alert("İlanı pasife al", "Yayındaki ilan vitrinden kaldırılır. Devam edilsin mi?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Pasife al",
        style: "destructive",
        onPress: async () => {
          const res = await deactivateListing(row.listing_id, v);
          if (!res.ok) {
            Alert.alert(
              "Hata",
              typeof res.error === "string" ? res.error : "İşlem tamamlanamadı.",
            );
            return;
          }
          const mine = await getMyListings();
          if (mine.ok && mine.data?.items) setMineListings(mine.data.items);
          Alert.alert("Tamam", "İlan pasife alındı.");
        },
      },
    ]);
  }, []);

  /**
   * Kişisel bilgileri güncelle
   */
  const handleUpdatePersonalInfo = async () => {
    setIsSaving(true);
    
    const response = await authService.updateProfile({
      first_name: firstName,
      last_name: lastName,
    });

    if (response.success) {
      await loadProfile();
      setShowPersonalInfoModal(false);
      Alert.alert("Başarılı", "Kişisel bilgiler güncellendi");
    } else {
      Alert.alert("Hata", response.message || "Güncelleme başarısız");
    }

    setIsSaving(false);
  };

  /**
   * Adres bilgilerini güncelle
   */
  const handleUpdateAddress = async (addr?: AddressValue) => {
    setIsSaving(true);
    const cityIdToSend = addr?.cityId ?? cityId;
    const cityNameToSend = addr?.cityName ?? cityName;
    const districtIdToSend = addr?.districtId ?? districtId;
    const districtNameToSend = addr?.districtName ?? districtName;
    const quarterIdToSend = addr?.quarterId ?? quarterId;
    const quarterNameToSend = addr?.quarterName ?? quarterName;
    const quarterValueToSend = addr?.quarterValue ?? quarterValue;
    const streetToSend = addr?.streetAndNumber ?? streetAndNumber;
    const response = await authService.updateProfile({
      address_line1: streetToSend || addressLine1,
      city: cityNameToSend || city,
      district: districtNameToSend || district,
      city_id: cityIdToSend || undefined,
      city_name: cityNameToSend,
      district_id: districtIdToSend || undefined,
      district_name: districtNameToSend,
      quarter_id: quarterIdToSend || undefined,
      quarter_name: quarterNameToSend,
      quarter_value: quarterValueToSend || undefined,
      street_and_number: streetToSend,
    });

    if (response.success) {
      await loadProfile();
      setShowAddressModal(false);
      Alert.alert("Başarılı", "Adres bilgileri güncellendi");
    } else {
      Alert.alert("Hata", response.message || "Güncelleme başarısız");
    }

    setIsSaving(false);
  };

  /**
   * Firma bilgilerini güncelle (kurumsal için)
   */
  const handleUpdateCompanyInfo = async () => {
    setIsSaving(true);
    
    const response = await authService.updateProfile({
      company_name: companyName,
      consultant_type: profile?.consultant_type ?? null,
      corporate_type: profile?.corporate_type ?? null,
      company_license_no: profile?.company_license_no || "",
      office_no: profile?.office_no || "",
      spk_tc_no: profile?.spk_tc_no || "",
      vergi_no: profile?.vergi_no || "",
      vergi_dairesi: profile?.vergi_dairesi || "",
      emlak_yetki_belge_no: emlakYetkiBelgeNo,
    });

    if (response.success) {
      await loadProfile();
      setShowCompanyInfoModal(false);
      Alert.alert("Başarılı", "Firma bilgileri güncellendi");
    } else {
      Alert.alert("Hata", response.message || "Güncelleme başarısız");
    }

    setIsSaving(false);
  };

  const addExpertiseQuarterToDraft = (qu: QuarterItem) => {
    const raw = (qu as any).Proparcel_value;
    const qv = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(qv)) return;
    const label = qu.Proparcel_text || qu.Tkgm_text || String(qv);
    setExpertiseDraft((prev) => {
      if (prev.some((x) => x.quarter_value === qv)) return prev;
      if (prev.length >= 5) return prev;
      const isPrime = profile?.quarter_value !== null && profile?.quarter_value !== undefined && Number(profile.quarter_value) === qv;
      return [...prev, { quarter_value: qv, label, is_prime: isPrime }];
    });
  };

  const removeExpertiseQuarterFromDraft = (qv: number) => {
    setExpertiseDraft((prev) => prev.filter((x) => x.quarter_value !== qv));
  };

  const handleCancelExpertiseEdit = () => {
    setExpertiseEditing(false);
    setExpertisePickerMode(null);
    setExpertisePickerSearch("");
    setExpCityId(null);
    setExpCityName("");
    setExpTownId(null);
    setExpTownName("");
    resetExpertiseDraftFromProfile(profile);
  };

  const handleSaveExpertiseAreas = async () => {
    setSavingExpertiseAreas(true);
    try {
      const quarterValues = expertiseDraft.map((x) => x.quarter_value);
      const res = await authService.updateExpertiseAreas(quarterValues);
      if (res.success) {
        await loadProfile();
        setExpertiseEditing(false);
        setExpertisePickerMode(null);
        setExpertisePickerSearch("");
        Alert.alert("Başarılı", "Uzmanlık bölgeleri güncellendi");
      } else {
        Alert.alert("Hata", res.message || "Uzmanlık bölgeleri güncellenemedi");
      }
    } catch (e) {
      console.error("[Profile] Uzmanlık bölgeleri kaydetme hatası:", e);
      Alert.alert("Hata", "Uzmanlık bölgeleri güncellenemedi");
    } finally {
      setSavingExpertiseAreas(false);
    }
  };

  const addProviderCoverageToDraft = (city: CityItem, town: TownItem) => {
    setProviderCoverageDraft((prev) => {
      if (prev.some((x) => x.district_id === town.Id)) return prev;
      if (prev.length >= 20) return prev;
      return [
        ...prev,
        {
          city_id: city.Id,
          district_id: town.Id,
          label: `${city.Proparcel_text} / ${town.Proparcel_text}`,
          is_primary: prev.length === 0,
        },
      ];
    });
  };

  const removeProviderCoverageFromDraft = (districtId: number) => {
    setProviderCoverageDraft((prev) => {
      const next = prev.filter((x) => x.district_id !== districtId);
      if (next.length > 0 && !next.some((x) => x.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  };

  const setPrimaryProviderCoverage = (districtId: number) => {
    setProviderCoverageDraft((prev) =>
      prev.map((x) => ({ ...x, is_primary: x.district_id === districtId }))
    );
  };

  const handleCancelProviderCoverageEdit = () => {
    setProviderCoverageEditing(false);
    setCoveragePickerMode(null);
    setCoveragePickerSearch("");
    setCovCityId(null);
    setCovCityName("");
    resetProviderCoverageDraftFromProfile(profile);
  };

  const handleSaveProviderCoverage = async () => {
    setSavingProviderCoverage(true);
    try {
      const districts = providerCoverageDraft.map((x) => ({
        city_id: x.city_id,
        district_id: x.district_id,
        is_primary: !!x.is_primary,
      }));
      const res = await authService.updateProviderCoverage(districts);
      if (res.success) {
        await loadProfile();
        setProviderCoverageEditing(false);
        setCoveragePickerMode(null);
        setCoveragePickerSearch("");
        setCovCityId(null);
        setCovCityName("");
        Alert.alert("Başarılı", "Talep coverage bölgeleri güncellendi");
      } else {
        Alert.alert("Hata", res.message || "Coverage bölgeleri güncellenemedi");
      }
    } catch (e) {
      console.error("[Profile] Provider coverage kaydetme hatası:", e);
      Alert.alert("Hata", "Coverage bölgeleri güncellenemedi");
    } finally {
      setSavingProviderCoverage(false);
    }
  };

  /**
   * Avatar seç → "Arka plan temizlensin mi?" modalını göster; Evet/Hayır sonrası yükle
   */
  const handleAvatarPick = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.assets && result.assets[0] && result.assets[0].uri) {
      setPendingAvatarUri(result.assets[0].uri);
      setShowRemoveBgModal(true);
    }
  };

  const handleAvatarRemoveBgChoice = async (removeBackground: boolean) => {
    if (!pendingAvatarUri) return;
    setUploadingAvatar(true);
    setShowRemoveBgModal(false);
    const uri = pendingAvatarUri;
    setPendingAvatarUri(null);
    try {
      const response = await authService.uploadAvatar(uri, { remove_background: removeBackground });
      if (response.success && response.data) {
        await loadProfile();
        const hasPending = response.data.has_pending_avatar || response.data.pending_avatar_url;
        if (hasPending) {
          Alert.alert("Başarılı", "Profil fotoğrafınız yüklendi ve admin onayına gönderildi.");
        } else {
          Alert.alert("Başarılı", "Profil fotoğrafı güncellendi");
        }
      } else {
        Alert.alert("Hata", response.message || "Fotoğraf yüklenemedi");
      }
    } catch (error) {
      console.error("[Profile] Avatar yükleme hatası:", error);
      Alert.alert("Hata", "Fotoğraf yüklenirken bir hata oluştu");
    } finally {
      setUploadingAvatar(false);
    }
  };

  /**
   * Şifre değiştirme: Telefona OTP gönder
   */
  const handleSendPasswordOtp = async () => {
    setSendingPasswordOtp(true);
    const response = await authService.requestPasswordChangeOtp();
    setSendingPasswordOtp(false);
    if (response.success) {
      setPasswordChangeStep("enter_otp");
      Alert.alert("Bilgi", "Doğrulama kodu telefonunuza gönderildi.");
    } else {
      Alert.alert("Hata", response.message || "Kod gönderilemedi.");
    }
  };

  /**
   * Şifre değiştir (OTP + yeni şifre ile)
   */
  const handleChangePassword = async () => {
    if (passwordChangeStep === "request_otp") {
      await handleSendPasswordOtp();
      return;
    }
    if (!otp.trim() || otp.trim().length !== 6) {
      Alert.alert("Hata", "6 haneli doğrulama kodunu girin");
      return;
    }
    if (!newPassword || !newPasswordConfirm) {
      Alert.alert("Hata", "Lütfen yeni şifre alanlarını doldurun");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Hata", "Yeni şifre en az 8 karakter olmalıdır");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      Alert.alert("Hata", "Şifreler eşleşmiyor");
      return;
    }
    setChangingPassword(true);
    const response = await authService.confirmPasswordChange(otp, newPassword, newPasswordConfirm);
    setChangingPassword(false);
    if (response.success) {
      setShowPasswordModal(false);
      setPasswordChangeStep("request_otp");
      setOtp("");
      setNewPassword("");
      setNewPasswordConfirm("");
      Alert.alert("Başarılı", "Şifreniz başarıyla değiştirildi.");
    } else {
      Alert.alert("Hata", response.message || "Şifre değiştirilemedi.");
    }
  };

  /**
   * Firma ara (bireysel için)
   */
  const handleSearchCompany = async () => {
    if (!vergiNo.trim()) {
      Alert.alert("Hata", "Lütfen vergi numarası girin");
      return;
    }

    setSearchingCompany(true);
    setFoundCompany(null);

    const response = await companyService.searchCompanyByVergiNo(vergiNo);

    if (response.success && response.data) {
      setFoundCompany(response.data.company);
    } else {
      Alert.alert("Hata", response.message || "Firma bulunamadı");
    }

    setSearchingCompany(false);
  };

  /**
   * Firma bağlantı isteği gönder (bireysel için)
   */
  const handleRequestMembership = async () => {
    if (!foundCompany) return;

    setSendingRequest(true);

    const response = await companyService.requestCompanyMembership(vergiNo);

    if (response.success) {
      Alert.alert("Başarılı", "Firma bağlantı isteği gönderildi");
      setVergiNo("");
      setFoundCompany(null);
      await loadProfile();
    } else {
      Alert.alert("Hata", response.message || "İstek gönderilemedi");
    }

    setSendingRequest(false);
  };

  /**
   * Firmadan çık (bireysel için)
   */
  const handleLeaveCompany = async () => {
    Alert.alert(
      "Firmadan Çık",
      "Firmadan çıkmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Çık",
          style: "destructive",
          onPress: async () => {
            const response = await companyService.leaveCompany();
            if (response.success) {
              Alert.alert("Başarılı", "Firmadan çıktınız");
              await loadProfile();
            } else {
              Alert.alert("Hata", response.message || "Firmadan çıkılamadı");
            }
          },
        },
      ]
    );
  };

  /**
   * İstek onayla (kurumsal için)
   */
  const handleApproveRequest = async (requestId: number) => {
    Alert.alert(
      "İsteği Onayla",
      "Bu isteği onaylamak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Onayla",
          onPress: async () => {
            const response = await companyService.approveCompanyMembership(requestId);
            if (response.success) {
              Alert.alert("Başarılı", "İstek onaylandı");
              await loadProfile();
            } else {
              Alert.alert("Hata", response.message || "İstek onaylanamadı");
            }
          },
        },
      ]
    );
  };

  /**
   * İstek reddet (kurumsal için)
   */
  const handleRejectRequest = async (requestId: number) => {
    Alert.alert(
      "İsteği Reddet",
      "Bu isteği reddetmek istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Reddet",
          style: "destructive",
          onPress: async () => {
            const response = await companyService.rejectCompanyMembership(requestId);
            if (response.success) {
              Alert.alert("Başarılı", "İstek reddedildi");
              await loadProfile();
            } else {
              Alert.alert("Hata", response.message || "İstek reddedilemedi");
            }
          },
        },
      ]
    );
  };

  /**
   * Alt kullanıcıyı çıkar (kurumsal yetkili için)
   */
  const handleRemoveMember = async (userId: number) => {
    Alert.alert(
      "Üyeyi Çıkar",
      "Bu üyeyi firmadan çıkarmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Çıkar",
          style: "destructive",
          onPress: async () => {
            const response = await companyService.removeCompanyMember(userId);
            if (response.success) {
              Alert.alert("Başarılı", "Üye firmadan çıkarıldı");
              await loadProfile();
            } else {
              Alert.alert("Hata", response.message || "Üye çıkarılamadı");
            }
          },
        },
      ]
    );
  };

  /**
   * Hesap silme: Telefona OTP gönder (şifre doğrulandıktan sonra)
   */
  const handleSendDeleteOtp = async () => {
    if (!deletePassword.trim()) {
      Alert.alert("Hata", "Önce şifrenizi girin");
      return;
    }
    setSendingDeleteOtp(true);
    const response = await authService.requestDeleteAccountOtp(deletePassword);
    setSendingDeleteOtp(false);
    if (response.success) {
      setDeleteStep("otp");
      Alert.alert("Bilgi", "Doğrulama kodu telefonunuza gönderildi.");
    } else {
      Alert.alert("Hata", response.message || "Kod gönderilemedi.");
    }
  };

  /**
   * Hesap sil (şifre + OTP ile)
   */
  const confirmDeleteAccount = async () => {
    if (deleteStep === "password") {
      await handleSendDeleteOtp();
      return;
    }
    if (!deletePassword.trim()) {
      Alert.alert("Hata", "Şifre gerekli");
      return;
    }
    if (!deleteOtp.trim() || deleteOtp.trim().length !== 6) {
      Alert.alert("Hata", "6 haneli doğrulama kodunu girin");
      return;
    }
    setDeletingAccount(true);
    const response = await authService.deleteAccount(deletePassword, deleteOtp);
    setDeletingAccount(false);
    setShowDeleteModal(false);
    setDeletePassword("");
    setDeleteOtp("");
    setDeleteStep("password");
    if (response.success) {
      router.replace("login");
    } else {
      Alert.alert("Hata", response.message || "Hesap silinemedi");
    }
  };

  // Giriş yapılmamışsa
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            accessibilityLabel="Geri"
          >
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
          {PROFILE_SECTION_LABELS[profileSection]}
        </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed" size={64} color="#64748b" />
          <Text style={styles.emptyText}>Giriş yapmanız gerekiyor</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("login")}
          >
            <Text style={styles.loginButtonText}>Giriş Yap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.loginButton, { marginTop: 14, backgroundColor: "transparent", borderWidth: 1, borderColor: "#3b82f6" }]}
            onPress={() => router.push("legal-hub")}
          >
            <Text style={[styles.loginButtonText, { color: "#3b82f6" }]}>Hukuki metinler</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Yükleniyor
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            accessibilityLabel="Geri"
          >
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
          {PROFILE_SECTION_LABELS[profileSection]}
        </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isIndividual = profile?.member_type === "individual";
  const isConsultant = profile?.member_type === "consultant";
  const isCorporate = profile?.member_type === "corporate" || profile?.member_type === "expert" || profile?.role === "broker";
  const isIndividualOrConsultant = isIndividual || isConsultant;
  const canShowExpert = profile?.role === "consultant" || profile?.role === "broker";
  const canManageProviderCoverage =
    profile?.corporate_type === "lihkab" ||
    profile?.corporate_type === "spk" ||
    profile?.consultant_type === "spk";
  const providerCoverageTitle = profile?.corporate_type === "lihkab" ? "LIHKAB Coverage İlçeleri" : "SPK Coverage İlçeleri";
  const providerCoverageHint = profile?.corporate_type === "lihkab"
    ? "Harita işlemi taleplerinin yönleneceği ilçeleri seçin. Bir kayıt primary olabilir."
    : "SPK değerleme taleplerini almak istediğiniz ilçeleri seçin. Bir kayıt primary olabilir.";
  const isVip = user?.role === "vip" || user?.role === "vip_limited";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      {/* Header: sadece geri + başlık */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {PROFILE_SECTION_LABELS[profileSection]}
        </Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setProfileMenuOpen(true)}
          accessibilityLabel="Menü"
          accessibilityRole="button"
        >
          <Ionicons name="menu" size={22} color="#f8fafc" />
        </TouchableOpacity>
      </View>

      <ProfileMenuSheet
        visible={profileMenuOpen}
        onClose={() => setProfileMenuOpen(false)}
        profile={profile}
        creditBalance={balance?.balance ?? null}
        activeSection={profileSection}
        onSelectSection={setProfileSection}
      />

      <KeyboardAwareScrollScreen
        headerHeight={52}
        backgroundColor="#1e293b"
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header'ın altındaki alan: sol kolon tamamen resim, sağ kolon Ad Soyad + tip, bilgilendirme sağ kolon altında */}
        <View style={styles.profileSectionBelowHeader}>
          <View style={styles.profileSectionRow}>
            {/* Sol kolon: sadece resim alanı (tamamen bu kolonu kaplar) */}
            <View style={styles.profileSectionCol1}>
              <TouchableOpacity
                style={styles.profileSectionAvatarTouch}
                onPress={handleAvatarPick}
                activeOpacity={0.9}
                disabled={uploadingAvatar}
              >
                <View style={styles.profileSectionAvatarRect}>
                  {(() => {
                    const avatarUrl = profile?.avatar_url || profile?.avatar;
                    const pendingUrl = profile?.pending_avatar_url;
                    const approved = profile?.avatar_approved === true;
                    let src: string | null = null;
                    if (avatarUrl && approved) src = resolveMediaUrl(avatarUrl) ?? avatarUrl;
                    else if (pendingUrl) src = resolveMediaUrl(pendingUrl) ?? pendingUrl;
                    else if (avatarUrl) src = resolveMediaUrl(avatarUrl) ?? avatarUrl;
                    return src ? (
                      <Image source={{ uri: src }} style={styles.profileSectionAvatarImage} />
                    ) : (
                      <Text style={styles.profileSectionAvatarLetter}>
                        {(firstName || user?.email || "K")[0].toUpperCase()}
                      </Text>
                    );
                  })()}
                </View>
                {(profile?.avatar_rejection_reason || profile?.avatar_rejected_at) && (
                  <View style={styles.profileSectionAvatarRejectedBadge}>
                    <Ionicons name="alert-circle" size={12} color="#fff" />
                  </View>
                )}
                {profile?.pending_avatar_url && !profile?.avatar_approved && !profile?.avatar_rejection_reason && (
                  <View style={styles.profileSectionAvatarPendingBadge}>
                    <Ionicons name="time-outline" size={10} color="#fff" />
                  </View>
                )}
                <View style={styles.profileSectionAvatarCameraBadge}>
                  <Ionicons name="camera" size={10} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
            {/* Dikey ayraç */}
            <View style={styles.profileSectionDividerV} />
            {/* Sağ kolon: Ad Soyad + tip, altında bilgilendirme notları */}
            <View style={styles.profileSectionCol2}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.profileSectionUserName, { flexShrink: 1 }]} numberOfLines={1}>
                  {profile?.first_name || profile?.last_name
                    ? `${capitalizeName(profile?.first_name)} ${capitalizeName(profile?.last_name)}`.trim()
                    : "Profil"}
                </Text>
                {isVip && (
                  <View style={styles.profileVipBadge}>
                    <Ionicons name="star" size={12} color="#fff" />
                    <Text style={styles.profileVipBadgeText}>VIP</Text>
                  </View>
                )}
              </View>
              <Text style={styles.profileSectionUserType}>
                {isIndividual ? "Bireysel Kullanıcı" : isConsultant ? "Danışman" : "Kurumsal Kullanıcı"}
              </Text>
              {canShowExpert ? (
                <Text style={styles.profileSectionUserType} numberOfLines={1}>
                  {(() => {
                    const current = (profile as any)?.expert_score_current ?? 0;
                    const peak = (profile as any)?.expert_score_peak ?? 0;
                    const level = (profile as any)?.expert_level as string | null | undefined;
                    const levelLabel =
                      level === "platinum" ? "Platin" :
                      level === "gold" ? "Altın" :
                      level === "silver" ? "Gümüş" :
                      level === "bronze" ? "Bronz" :
                      level === "advisor" ? "Danışman" :
                      level === "first_experience" ? "İlk Tecrübe" :
                      "";
                    return `Uzmanlık: ${Number(current || 0)}${levelLabel ? ` (${levelLabel})` : ""} • En Yüksek: ${Number(peak || 0)}`;
                  })()}
                </Text>
              ) : null}
              {/* Yatay ayraç (notlar varsa) */}
              {(() => {
                const hasNotes = profile?.avatar_rejection_reason || profile?.avatar_rejected_at ||
                  (profile?.pending_avatar_url && !profile?.avatar_approved) || (profile?.avatar_url && profile?.avatar_approved);
                return hasNotes ? <View style={styles.profileSectionDividerH} /> : null;
              })()}
              {/* Bilgilendirme notları: sağ kolon altında */}
              {(() => {
                const rejected = profile?.avatar_rejection_reason || profile?.avatar_rejected_at;
                const pending = profile?.pending_avatar_url && !profile?.avatar_approved && !rejected;
                const approved = profile?.avatar_url && profile?.avatar_approved;
                if (rejected)
                  return (
                    <View style={styles.profileSectionNoteWrap}>
                      <Text style={styles.profileStatusRejected}>
                        Son yüklediğiniz fotoğraf reddedildi.
                      </Text>
                      {profile?.avatar_rejection_reason ? (
                        <Text style={styles.profileRejectionReason}>{profile.avatar_rejection_reason}</Text>
                      ) : null}
                    </View>
                  );
                if (pending)
                  return (
                    <Text style={styles.profileSectionNotePending}>
                      Fotoğrafınız admin onayı bekliyor
                    </Text>
                  );
                if (approved)
                  return (
                    <Text style={styles.profileSectionNoteApproved}>
                      Fotoğrafınız onaylandı
                    </Text>
                  );
                return null;
              })()}
            </View>
          </View>
        </View>

        {profileSection === "genel" && user?.id ? (
          <View style={styles.profileGenelHero}>
            {profileHeroRatingLoading ? (
              <ActivityIndicator color="#fbbf24" style={{ paddingVertical: 12 }} />
            ) : (
              <View style={styles.profileGenelHeroInner}>
                <View style={styles.profileHeroRatingBox}>
                  <TouchableOpacity
                    style={styles.profileHeroStarsTouch}
                    onPress={() => setProfileSection("puan_yorumlar")}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Kullanıcı puanı — değerlendirmeler ve yorumlar"
                  >
                    <View style={styles.profileHeroStarsTouchHeader}>
                      <Text style={styles.profileHeroRatingLabel}>Kullanıcı puanı</Text>
                      <Ionicons name="chevron-forward" size={20} color="#64748b" />
                    </View>
                    <View style={styles.profileHeroStarsRow}>
                      {[1, 2, 3, 4, 5].map((i) => {
                        const avg = profileHeroRating?.avg;
                        const filled =
                          avg != null && Number.isFinite(avg) ? Math.round(avg) : 0;
                        return (
                          <Ionicons
                            key={i}
                            name={i <= filled ? "star" : "star-outline"}
                            size={28}
                            color="#f59e0b"
                            style={{ marginRight: i < 5 ? 5 : 0 }}
                          />
                        );
                      })}
                    </View>
                    <Text style={styles.profileHeroRatingNum}>
                      {profileHeroRating?.avg != null && Number.isFinite(profileHeroRating.avg)
                        ? profileHeroRating.avg.toFixed(1)
                        : "—"}
                      <Text style={styles.profileHeroRatingSub}>
                        {" "}
                        / 5 · {profileHeroRating?.count ?? 0} değerlendirme
                      </Text>
                    </Text>
                    <Text style={styles.profileHeroTapHint}>
                      Değerlendirmeler ve yorumlar için dokunun
                    </Text>
                  </TouchableOpacity>
                </View>
                {badgeStrip[0] ? (
                  <View style={styles.profileHeroBadgeBox}>
                    <Text style={styles.profileHeroBadgeLabel}>Öne çıkan rozet</Text>
                    <View style={styles.profileHeroBadgeRow}>
                      {resolveMediaUrl(badgeStrip[0].svg_active_url || undefined) ? (
                        <SvgUri
                          uri={resolveMediaUrl(badgeStrip[0].svg_active_url || undefined)!}
                          width={56}
                          height={56}
                        />
                      ) : (
                        <View style={styles.profileHeroBadgeFallback}>
                          <Text style={styles.profileHeroBadgeFallbackTxt}>★</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                        <Text style={styles.profileHeroBadgeTitle} numberOfLines={2}>
                          {badgeStrip[0].title || badgeStrip[0].code}
                        </Text>
                        <TouchableOpacity onPress={() => router.push("badges")}>
                          <Text style={styles.profileHeroBadgeMore}>Tüm rozetler →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {profileSection === "genel" && user?.id ? (
          <ProfileGenelOverview
            userId={Number(user.id)}
            onOpenProfileSection={setProfileSection}
          />
        ) : null}

        {profileSection === "puan_yorumlar" && user?.id ? (
          <ProfileRatingsComments userId={Number(user.id)} />
        ) : null}

        {profileSection === "ilanlar" ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images" size={20} color="#3b82f6" />
              <Text style={styles.cardTitle}>İlanlarım</Text>
            </View>
            <Text style={styles.cardHint}>
              Yayın ve taslak ilanlarınız. Güncelleme portal düzenleyicide; yayında olan ilanı pasife alabilirsiniz.
            </Text>
            {mineListingsLoading ? (
              <ActivityIndicator color="#3b82f6" style={{ marginVertical: 16 }} />
            ) : mineListings.length ? (
              <View>
                {mineListings.slice(0, 12).map((row) => (
                  <View key={row.listing_id} style={styles.profileListingCard}>
                    <TouchableOpacity
                      style={styles.profileListingMainTouch}
                      onPress={() => openListingEditor(row.listing_id)}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.profileListingTitle} numberOfLines={2}>
                        {row.title || row.listing_id}
                      </Text>
                      <Text style={styles.profileListingMeta}>
                        {(row.publication_status || row.workflow_status || "—") +
                          (row.updated_at
                            ? ` · ${new Date(row.updated_at).toLocaleDateString("tr-TR")}`
                            : "")}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.profileListingActions}>
                      <TouchableOpacity
                        style={styles.profileListingActionBtn}
                        onPress={() => openListingEditor(row.listing_id)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="create-outline" size={18} color="#2563eb" />
                        <Text style={styles.profileListingActionTxtPrimary}>Güncelle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.profileListingActionBtn,
                          styles.profileListingActionSecond,
                          String(row.publication_status || "").toLowerCase() !== "published" &&
                            styles.profileListingActionBtnDisabled,
                        ]}
                        onPress={() => onDeactivateListingPress(row)}
                        disabled={String(row.publication_status || "").toLowerCase() !== "published"}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="pause-circle-outline"
                          size={18}
                          color={
                            String(row.publication_status || "").toLowerCase() === "published"
                              ? "#b45309"
                              : "#94a3b8"
                          }
                        />
                        <Text
                          style={[
                            styles.profileListingActionTxtWarn,
                            String(row.publication_status || "").toLowerCase() !== "published" &&
                              styles.profileListingActionTxtMuted,
                          ]}
                        >
                          Pasife al
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptySmallText}>Henüz ilan kaydı yok.</Text>
            )}
            <TouchableOpacity style={styles.updateButton} onPress={() => router.push("ilan-islemleri")}>
              <Ionicons name="briefcase-outline" size={18} color="#3b82f6" />
              <Text style={styles.updateButtonText}>İlan işlemleri</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {profileSection === "prosorgular" ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="search" size={20} color="#3b82f6" />
              <Text style={styles.cardTitle}>Pro sorgularım</Text>
            </View>
            <Text style={styles.cardHint}>Son kayıtlarınız (web ProSorgular sekmesi ile uyumlu liste).</Text>
            {proQueriesLoading ? (
              <ActivityIndicator color="#3b82f6" style={{ marginVertical: 16 }} />
            ) : proQueryRows.length ? (
              <View>
                {proQueryRows.map((q) => (
                  <TouchableOpacity
                    key={q.snapshot_id}
                    style={[styles.profileListingRow, { marginBottom: 10 }]}
                    onPress={() =>
                      router.push("son-30-gun-detay", {
                        snapshotId: String(q.snapshot_id),
                      })
                    }
                    activeOpacity={0.85}
                  >
                    <Text style={styles.profileListingTitle} numberOfLines={2}>
                      {q.title || `${q.ada}/${q.parsel}` || `Sorgu #${q.snapshot_id}`}
                    </Text>
                    <Text style={styles.profileListingMeta}>
                      {[q.quarter_name, q.query_type].filter(Boolean).join(" · ") || "—"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptySmallText}>Henüz Pro sorgu bulunmuyor.</Text>
            )}
            <TouchableOpacity style={styles.updateButton} onPress={() => router.push("son-30-gun")}>
              <Ionicons name="calendar-outline" size={18} color="#3b82f6" />
              <Text style={styles.updateButtonText}>Son 30 gün sorguları</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {profileSection === "kullanimlarim" ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart" size={20} color="#3b82f6" />
            <Text style={styles.cardTitle}>Kullanımlarım</Text>
          </View>
          <Text style={styles.cardHint}>
            Tepe Coin bakiyeniz, son 30 gün kullanım özeti ve hareket geçmişiniz.
          </Text>
          {usageSectionBusy ? (
            <View style={styles.usageLoadingWrap}>
              <ActivityIndicator color="#3b82f6" />
              <Text style={styles.usageLoadingTxt}>İstatistikler yükleniyor…</Text>
            </View>
          ) : null}
          <View style={[styles.usageStatsGrid, usageSectionBusy ? styles.usageStatsDimmed : null]}>
            <View style={styles.usageStatCard}>
              <Text style={styles.usageStatValue}>{(balance?.balance ?? stats?.balance ?? 0).toLocaleString("tr-TR")}</Text>
              <Text style={styles.usageStatLabel}>Mevcut Bakiye</Text>
            </View>
            <View style={styles.usageStatCard}>
              <Text style={styles.usageStatValue}>{(balance?.earned_balance ?? stats?.earned_balance ?? 0).toLocaleString("tr-TR")}</Text>
              <Text style={styles.usageStatLabel}>Kazanılan</Text>
            </View>
            <View style={styles.usageStatCard}>
              <Text style={styles.usageStatValue}>{(balance?.purchased_balance ?? stats?.purchased_balance ?? 0).toLocaleString("tr-TR")}</Text>
              <Text style={styles.usageStatLabel}>Satın Alınan</Text>
            </View>
            <View style={styles.usageStatCard}>
              <Text style={styles.usageStatValue}>{(stats?.usage_last_30_days ?? stats?.last_30_days ?? 0).toLocaleString("tr-TR")}</Text>
              <Text style={styles.usageStatLabel}>Son 30 Gün</Text>
            </View>
          </View>
          <View style={styles.usageSummaryRow}>
            <Text style={styles.usageSummaryText}>Pro Sorgu: {(stats?.usage_by_type?.pro_query ?? 0).toLocaleString("tr-TR")}</Text>
            <Text style={styles.usageSummaryText}>İlan: {(stats?.usage_by_type?.ilan ?? 0).toLocaleString("tr-TR")}</Text>
            <Text style={styles.usageSummaryText}>3D Tasarım: {(stats?.usage_by_type?.design_3d ?? 0).toLocaleString("tr-TR")}</Text>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son Kullanımlar</Text>
          </View>
          {history.length > 0 ? (
            <View style={styles.historyList}>
              {history.map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyItemLeft}>
                    <Ionicons name="time-outline" size={20} color="#64748b" />
                    <View style={styles.historyItemContent}>
                      <Text style={styles.historyItemTitle}>{item.action_type_display || item.action_type}</Text>
                      {item.description ? (
                        <Text style={styles.historyItemDescription}>{item.description}</Text>
                      ) : null}
                      <Text style={styles.historyItemDate}>
                        {new Date(item.created_at).toLocaleDateString("tr-TR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyItemCredits}>-{item.credits_used} C</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptySmallText}>Henüz kullanım geçmişi yok.</Text>
          )}
          <TouchableOpacity style={styles.updateButton} onPress={() => router.push("pricing")}>
            <Ionicons name="add-circle-outline" size={18} color="#3b82f6" />
            <Text style={styles.updateButtonText}>Tepe Coin Paketleri</Text>
          </TouchableOpacity>
        </View>
        ) : null}

        {/* Rozetler — web ile aynı overview API */}
        {profileSection === "rozetler" ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="ribbon" size={20} color="#3b82f6" />
            <Text style={styles.cardTitle}>Rozetler</Text>
          </View>
          <Text style={styles.cardHint}>
            {badgeEarnedCount != null
              ? `Kazanılan rozet: ${badgeEarnedCount}. Tüm kategoriler ve ilerleme için rozet ekranına gidin.`
              : "Rozet özeti yükleniyor…"}
          </Text>
          {badgeStrip.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgeStripRow}
            >
              {badgeStrip.map((b) => {
                const src = resolveMediaUrl(b.svg_active_url || undefined);
                return (
                  <View key={b.code} style={styles.badgeStripItem}>
                    {src ? (
                      <SvgUri uri={src} width={44} height={44} />
                    ) : (
                      <View style={styles.badgeStripFallback}>
                        <Text style={styles.badgeStripFallbackText}>●</Text>
                      </View>
                    )}
                    <Text style={styles.badgeStripLabel} numberOfLines={2}>
                      {b.title || b.code}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.emptySmallText}>
              Henüz görüntülenecek rozet yok veya özet alınamadı.
            </Text>
          )}
          <TouchableOpacity style={styles.updateButton} onPress={() => router.push("badges")}>
            <Ionicons name="chevron-forward-circle" size={18} color="#3b82f6" />
            <Text style={styles.updateButtonText}>Tüm rozetleri gör</Text>
          </TouchableOpacity>
        </View>
        ) : null}

        {/* Conditional Content: Bireysel veya Kurumsal */}
        {isIndividualOrConsultant ? (
          <View>
            {profileSection === "hesap" ? (
            <View>
            {/* Hesap Bilgileri */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-circle" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Hesap Bilgileri</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>E-posta</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Telefon</Text>
                <Text style={styles.infoValue}>
                  {user?.phone_number ? `+90 ${user.phone_number}` : "Eklenmemiş"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Kayıt Tarihi</Text>
                <Text style={styles.infoValue}>
                  {(profile?.created_at ?? user?.created_at)
                    ? new Date(profile?.created_at ?? user?.created_at!).toLocaleDateString("tr-TR")
                    : "-"}
                </Text>
              </View>
            </View>

            {/* Kişisel Bilgiler */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="id-card" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Ad</Text>
                <Text style={styles.infoValue}>{profile?.first_name || "-"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Soyad</Text>
                <Text style={styles.infoValue}>{profile?.last_name || "-"}</Text>
              </View>
              <TouchableOpacity
                style={styles.updateButton}
                onPress={() => {
                  setFirstName(profile?.first_name || "");
                  setLastName(profile?.last_name || "");
                  setShowPersonalInfoModal(true);
                }}
              >
                <Ionicons name="create-outline" size={18} color="#3b82f6" />
                <Text style={styles.updateButtonText}>Güncelle</Text>
              </TouchableOpacity>
            </View>

            {/* Adres Bilgileri */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="location" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Adres Bilgileri</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>İl</Text>
                <Text style={styles.infoValue}>{profile?.city_name || profile?.city || "-"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>İlçe</Text>
                <Text style={styles.infoValue}>{profile?.district_name || profile?.district || "-"}</Text>
              </View>
              {profile?.quarter_name ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mahalle</Text>
                  <Text style={styles.infoValue}>{profile.quarter_name}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Adres</Text>
                <Text style={styles.infoValue}>{profile?.address_line1 || profile?.street_and_number || "-"}</Text>
              </View>
              <TouchableOpacity
                style={styles.updateButton}
                onPress={() => {
                  setAddressLine1(profile?.address_line1 || "");
                  setCity(profile?.city || "");
                  setDistrict(profile?.district || "");
                  setCityId(profile?.city_id ?? null);
                  setCityName(profile?.city_name || "");
                  setDistrictId(profile?.district_id ?? null);
                  setDistrictName(profile?.district_name || "");
                  setQuarterId(profile?.quarter_id ?? null);
                  setQuarterName(profile?.quarter_name || "");
                  setStreetAndNumber(profile?.street_and_number || profile?.address_line1 || "");
                  setShowAddressModal(true);
                }}
              >
                <Ionicons name="create-outline" size={18} color="#3b82f6" />
                <Text style={styles.updateButtonText}>Güncelle</Text>
              </TouchableOpacity>
            </View>
            </View>
            ) : null}

            {profileSection === "uzmanlik" ? (
            <View>
            {/* Uzmanlık Bölgeleri (Danışman/Kurumsal) */}
            {(canShowExpert || isCorporate) ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="map" size={20} color="#3b82f6" />
                  <Text style={styles.cardTitle}>Uzmanlık Bölgeleri</Text>
                </View>
                <Text style={styles.cardHint}>
                  En fazla 5 mahalle seçebilirsiniz. Adresinizdeki mahalle ile eşleşen uzmanlık bölgesi prime olur.
                </Text>

                <View style={styles.chipsWrap}>
                  {expertiseDraft.length > 0 ? (
                    expertiseDraft.map((x) => (
                      <View key={x.quarter_value} style={[styles.chip, x.is_prime ? styles.chipPrime : null]}>
                        <Text style={styles.chipText} numberOfLines={1}>
                          {x.label || String(x.quarter_value)}
                        </Text>
                        {x.is_prime ? <Text style={styles.chipPrimeText}>prime</Text> : null}
                        {expertiseEditing ? (
                          <TouchableOpacity
                            style={styles.chipRemoveBtn}
                            onPress={() => removeExpertiseQuarterFromDraft(x.quarter_value)}
                          >
                            <Ionicons name="close" size={14} color="#0f172a" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptySmallText}>Henüz uzmanlık bölgesi eklenmedi.</Text>
                  )}
                </View>

                {expertiseEditing ? (
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.addExpertiseButton, expertiseDraft.length >= 5 ? styles.buttonDisabled : null]}
                      onPress={() => setExpertisePickerMode("city")}
                      disabled={expertiseDraft.length >= 5}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                      <Text style={styles.addExpertiseButtonText}>
                        {expertiseDraft.length >= 5 ? "Limit dolu (5/5)" : "Mahalle Ekle"}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalCancelButton]}
                        onPress={handleCancelExpertiseEdit}
                        disabled={savingExpertiseAreas}
                      >
                        <Text style={styles.modalCancelButtonText}>İptal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalSaveButton]}
                        onPress={handleSaveExpertiseAreas}
                        disabled={savingExpertiseAreas}
                      >
                        {savingExpertiseAreas ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.modalSaveButtonText}>Kaydet</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity style={styles.updateButton} onPress={() => setExpertiseEditing(true)}>
                    <Ionicons name="create-outline" size={18} color="#3b82f6" />
                    <Text style={styles.updateButtonText}>Güncelle</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {canManageProviderCoverage ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="navigate-circle" size={20} color="#0f766e" />
                  <Text style={styles.cardTitle}>{providerCoverageTitle}</Text>
                </View>
                <Text style={styles.cardHint}>{providerCoverageHint}</Text>

                <View style={styles.chipsWrap}>
                  {providerCoverageDraft.length > 0 ? (
                    providerCoverageDraft.map((x) => (
                      <View key={`${x.city_id}-${x.district_id}`} style={[styles.chip, x.is_primary ? styles.chipPrimaryCoverage : null]}>
                        <Text style={styles.chipText} numberOfLines={1}>{x.label}</Text>
                        {x.is_primary ? <Text style={styles.chipPrimeText}>primary</Text> : null}
                        {providerCoverageEditing ? (
                          <>
                            <TouchableOpacity style={styles.chipPrimaryBtn} onPress={() => setPrimaryProviderCoverage(x.district_id)}>
                              <Ionicons name="star" size={12} color={x.is_primary ? "#f59e0b" : "#64748b"} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.chipRemoveBtn} onPress={() => removeProviderCoverageFromDraft(x.district_id)}>
                              <Ionicons name="close" size={14} color="#0f172a" />
                            </TouchableOpacity>
                          </>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptySmallText}>Henüz coverage ilçesi eklenmedi.</Text>
                  )}
                </View>

                {providerCoverageEditing ? (
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.addExpertiseButton, providerCoverageDraft.length >= 20 ? styles.buttonDisabled : null]}
                      onPress={() => setCoveragePickerMode("city")}
                      disabled={providerCoverageDraft.length >= 20}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                      <Text style={styles.addExpertiseButtonText}>
                        {providerCoverageDraft.length >= 20 ? "Limit dolu (20/20)" : "İlçe Ekle"}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalCancelButton]}
                        onPress={handleCancelProviderCoverageEdit}
                        disabled={savingProviderCoverage}
                      >
                        <Text style={styles.modalCancelButtonText}>İptal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalSaveButton]}
                        onPress={handleSaveProviderCoverage}
                        disabled={savingProviderCoverage}
                      >
                        {savingProviderCoverage ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveButtonText}>Kaydet</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity style={styles.updateButton} onPress={() => setProviderCoverageEditing(true)}>
                    <Ionicons name="create-outline" size={18} color="#3b82f6" />
                    <Text style={styles.updateButtonText}>Güncelle</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
            </View>
            ) : null}

            {profileSection === "firma" ? (
            <View>
            {/* Firma Bilgileri */}
            {profile?.company_relation && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="business" size={20} color="#3b82f6" />
                  <Text style={styles.cardTitle}>Firma Bilgileri</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Firma Adı</Text>
                  <Text style={styles.infoValue}>
                    {profile.company_relation.company_name}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Vergi No</Text>
                  <Text style={styles.infoValue}>
                    {profile.company_relation.vergi_no}
                  </Text>
                </View>
                {profile.company_relation.vergi_dairesi && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Vergi Dairesi</Text>
                    <Text style={styles.infoValue}>
                      {profile.company_relation.vergi_dairesi}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.leaveButton}
                  onPress={handleLeaveCompany}
                >
                  <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                  <Text style={styles.leaveButtonText}>Firmadan Çık</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Firma Kaydı */}
            {!profile?.company_relation && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="hand-left" size={20} color="#3b82f6" />
                  <Text style={styles.cardTitle}>Firma Kaydı</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Vergi Numarası</Text>
                  <TextInput
                    style={styles.input}
                    value={vergiNo}
                    onChangeText={setVergiNo}
                    placeholder="10 haneli vergi numarası"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.button, styles.searchButton]}
                  onPress={handleSearchCompany}
                  disabled={searchingCompany}
                >
                  {searchingCompany ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="search" size={18} color="#fff" />
                      <Text style={styles.searchButtonText}>Firma Bul</Text>
                    </>
                  )}
                </TouchableOpacity>

                {foundCompany && (
                  <View style={styles.foundCompanyCard}>
                    <Text style={styles.foundCompanyTitle}>Firma Bulundu</Text>
                    <Text style={styles.foundCompanyName}>
                      {foundCompany.company_name}
                    </Text>
                    <Text style={styles.foundCompanyVergi}>
                      Vergi No: {foundCompany.vergi_no}
                    </Text>
                    <TouchableOpacity
                      style={[styles.button, styles.requestButton]}
                      onPress={handleRequestMembership}
                      disabled={sendingRequest}
                    >
                      {sendingRequest ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="send" size={18} color="#fff" />
                          <Text style={styles.requestButtonText}>
                            Firma Bağlantı İsteği Gönder
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Bekleyen İstekler */}
            {profile?.pending_requests && profile.pending_requests.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="time" size={20} color="#f59e0b" />
                  <Text style={styles.cardTitle}>Bekleyen İstekler</Text>
                </View>
                {profile.pending_requests.map((request) => (
                  <View key={request.id} style={styles.requestItem}>
                    <View style={styles.requestItemContent}>
                      <Text style={styles.requestItemTitle}>
                        Vergi No: {request.company_vergi_no}
                      </Text>
                      <Text style={styles.requestItemDate}>
                        {new Date(request.requested_at).toLocaleDateString("tr-TR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <View style={styles.requestItemBadge}>
                      <Text style={styles.requestItemBadgeText}>Beklemede</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            </View>
            ) : null}

            {profileSection === "danisman" && isIndividual ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="school-outline" size={20} color="#3b82f6" />
                  <Text style={styles.cardTitle}>Danışman başvurusu</Text>
                </View>
                <Text style={styles.cardHint}>
                  Üniversite, diploma ve firma eşlemesi için web profilindeki formu kullanın.
                </Text>
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={() =>
                    router.push("accounts-webview", {
                      path: "profile/#danisman",
                      title: "Danışman Başvurusu",
                    })
                  }
                >
                  <Ionicons name="open-outline" size={18} color="#3b82f6" />
                  <Text style={styles.updateButtonText}>Web formunu aç</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : isCorporate ? (
          // Kurumsal Kullanıcı İçeriği
          <View>
            {profileSection === "hesap" ? (
            <View>
            {/* Hesap Bilgileri */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-circle" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Hesap Bilgileri</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>E-posta</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Telefon</Text>
                <Text style={styles.infoValue}>
                  {user?.phone_number ? `+90 ${user.phone_number}` : "Eklenmemiş"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Kayıt Tarihi</Text>
                <Text style={styles.infoValue}>
                  {(profile?.created_at ?? user?.created_at)
                    ? new Date(profile?.created_at ?? user?.created_at!).toLocaleDateString("tr-TR")
                    : "-"}
                </Text>
              </View>
            </View>

            {/* Firma Bilgileri */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="business" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Firma Bilgileri</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Firma Adı</Text>
                <Text style={styles.infoValue}>{profile?.company_name || "-"}</Text>
              </View>
              {profile?.vergi_no && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Vergi No</Text>
                  <Text style={styles.infoValue}>{profile.vergi_no}</Text>
                </View>
              )}
              {profile?.vergi_dairesi && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Vergi Dairesi</Text>
                  <Text style={styles.infoValue}>{profile.vergi_dairesi}</Text>
                </View>
              )}
              {profile?.emlak_yetki_belge_no && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Emlak Yetki Belge No</Text>
                  <Text style={styles.infoValue}>{profile.emlak_yetki_belge_no}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.updateButton}
                onPress={() => {
                  setCompanyName(profile?.company_name || "");
                  setEmlakYetkiBelgeNo(profile?.emlak_yetki_belge_no || "");
                  setShowCompanyInfoModal(true);
                }}
              >
                <Ionicons name="create-outline" size={18} color="#3b82f6" />
                <Text style={styles.updateButtonText}>Güncelle</Text>
              </TouchableOpacity>
            </View>

            {/* Adres Bilgileri (Kurumsal için) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="location" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Adres Bilgileri</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>İl</Text>
                <Text style={styles.infoValue}>{profile?.city_name || profile?.city || "-"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>İlçe</Text>
                <Text style={styles.infoValue}>{profile?.district_name || profile?.district || "-"}</Text>
              </View>
              {profile?.quarter_name ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mahalle</Text>
                  <Text style={styles.infoValue}>{profile.quarter_name}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Adres</Text>
                <Text style={styles.infoValue}>{profile?.address_line1 || profile?.street_and_number || "-"}</Text>
              </View>
              <TouchableOpacity
                style={styles.updateButton}
                onPress={() => {
                  setAddressLine1(profile?.address_line1 || "");
                  setCity(profile?.city || "");
                  setDistrict(profile?.district || "");
                  setCityId(profile?.city_id ?? null);
                  setCityName(profile?.city_name || "");
                  setDistrictId(profile?.district_id ?? null);
                  setDistrictName(profile?.district_name || "");
                  setQuarterId(profile?.quarter_id ?? null);
                  setQuarterName(profile?.quarter_name || "");
                  setStreetAndNumber(profile?.street_and_number || profile?.address_line1 || "");
                  setShowAddressModal(true);
                }}
              >
                <Ionicons name="create-outline" size={18} color="#3b82f6" />
                <Text style={styles.updateButtonText}>Güncelle</Text>
              </TouchableOpacity>
            </View>
            </View>
            ) : null}

            {profileSection === "uzmanlik" ? (
            <View>
            {/* Uzmanlık Bölgeleri (Danışman/Kurumsal) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="map" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Uzmanlık Bölgeleri</Text>
              </View>
              <Text style={styles.cardHint}>
                En fazla 5 mahalle seçebilirsiniz. Adresinizdeki mahalle ile eşleşen uzmanlık bölgesi prime olur.
              </Text>

              <View style={styles.chipsWrap}>
                {expertiseDraft.length > 0 ? (
                  expertiseDraft.map((x) => (
                    <View key={x.quarter_value} style={[styles.chip, x.is_prime ? styles.chipPrime : null]}>
                      <Text style={styles.chipText} numberOfLines={1}>
                        {x.label || String(x.quarter_value)}
                      </Text>
                      {x.is_prime ? <Text style={styles.chipPrimeText}>prime</Text> : null}
                      {expertiseEditing ? (
                        <TouchableOpacity
                          style={styles.chipRemoveBtn}
                          onPress={() => removeExpertiseQuarterFromDraft(x.quarter_value)}
                        >
                          <Ionicons name="close" size={14} color="#0f172a" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptySmallText}>Henüz uzmanlık bölgesi eklenmedi.</Text>
                )}
              </View>

              {expertiseEditing ? (
                <>
                  <TouchableOpacity
                    style={[styles.button, styles.addExpertiseButton, expertiseDraft.length >= 5 ? styles.buttonDisabled : null]}
                    onPress={() => setExpertisePickerMode("city")}
                    disabled={expertiseDraft.length >= 5}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.addExpertiseButtonText}>
                      {expertiseDraft.length >= 5 ? "Limit dolu (5/5)" : "Mahalle Ekle"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalCancelButton]}
                      onPress={handleCancelExpertiseEdit}
                      disabled={savingExpertiseAreas}
                    >
                      <Text style={styles.modalCancelButtonText}>İptal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalSaveButton]}
                      onPress={handleSaveExpertiseAreas}
                      disabled={savingExpertiseAreas}
                    >
                      {savingExpertiseAreas ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.modalSaveButtonText}>Kaydet</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity style={styles.updateButton} onPress={() => setExpertiseEditing(true)}>
                  <Ionicons name="create-outline" size={18} color="#3b82f6" />
                  <Text style={styles.updateButtonText}>Güncelle</Text>
                </TouchableOpacity>
              )}
            </View>

            {canManageProviderCoverage ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="navigate-circle" size={20} color="#0f766e" />
                  <Text style={styles.cardTitle}>{providerCoverageTitle}</Text>
                </View>
                <Text style={styles.cardHint}>{providerCoverageHint}</Text>

                <View style={styles.chipsWrap}>
                  {providerCoverageDraft.length > 0 ? (
                    providerCoverageDraft.map((x) => (
                      <View key={`${x.city_id}-${x.district_id}`} style={[styles.chip, x.is_primary ? styles.chipPrimaryCoverage : null]}>
                        <Text style={styles.chipText} numberOfLines={1}>{x.label}</Text>
                        {x.is_primary ? <Text style={styles.chipPrimeText}>primary</Text> : null}
                        {providerCoverageEditing ? (
                          <>
                            <TouchableOpacity style={styles.chipPrimaryBtn} onPress={() => setPrimaryProviderCoverage(x.district_id)}>
                              <Ionicons name="star" size={12} color={x.is_primary ? "#f59e0b" : "#64748b"} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.chipRemoveBtn} onPress={() => removeProviderCoverageFromDraft(x.district_id)}>
                              <Ionicons name="close" size={14} color="#0f172a" />
                            </TouchableOpacity>
                          </>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptySmallText}>Henüz coverage ilçesi eklenmedi.</Text>
                  )}
                </View>

                {providerCoverageEditing ? (
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.addExpertiseButton, providerCoverageDraft.length >= 20 ? styles.buttonDisabled : null]}
                      onPress={() => setCoveragePickerMode("city")}
                      disabled={providerCoverageDraft.length >= 20}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                      <Text style={styles.addExpertiseButtonText}>
                        {providerCoverageDraft.length >= 20 ? "Limit dolu (20/20)" : "İlçe Ekle"}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalCancelButton]}
                        onPress={handleCancelProviderCoverageEdit}
                        disabled={savingProviderCoverage}
                      >
                        <Text style={styles.modalCancelButtonText}>İptal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalSaveButton]}
                        onPress={handleSaveProviderCoverage}
                        disabled={savingProviderCoverage}
                      >
                        {savingProviderCoverage ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveButtonText}>Kaydet</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity style={styles.updateButton} onPress={() => setProviderCoverageEditing(true)}>
                    <Ionicons name="create-outline" size={18} color="#3b82f6" />
                    <Text style={styles.updateButtonText}>Güncelle</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
            </View>
            ) : null}

            {profileSection === "firma" ? (
            <View>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="business" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Firma bilgileri</Text>
              </View>
              <Text style={styles.cardHint}>
                Firma adı, vergi ve yetki bilgileri web profilinizde düzenlenir.
              </Text>
              {profile?.company_name ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Firma adı</Text>
                  <Text style={styles.infoValue}>{profile.company_name}</Text>
                </View>
              ) : null}
              {profile?.vergi_no ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Vergi no</Text>
                  <Text style={styles.infoValue}>{profile.vergi_no}</Text>
                </View>
              ) : null}
              {profile?.vergi_dairesi ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Vergi dairesi</Text>
                  <Text style={styles.infoValue}>{profile.vergi_dairesi}</Text>
                </View>
              ) : null}
              {profile?.emlak_yetki_belge_no ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Emlak yetki belge no</Text>
                  <Text style={styles.infoValue}>{profile.emlak_yetki_belge_no}</Text>
                </View>
              ) : null}
              {profile?.company_license_no ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Yetki belgesi (TTBS / lisans)</Text>
                  <Text style={styles.infoValue}>{profile.company_license_no}</Text>
                </View>
              ) : null}
              {(() => {
                const logoUri = resolveMediaUrl(profile?.company_logo_url || profile?.company_logo || undefined);
                return logoUri ? (
                  <View style={{ marginTop: 10, alignItems: "center" }}>
                    <Image
                      source={{ uri: logoUri }}
                      style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: "#f1f5f9" }}
                      resizeMode="contain"
                    />
                  </View>
                ) : null;
              })()}
              {!profile?.company_name && !profile?.vergi_no ? (
                <Text style={styles.emptySmallText}>
                  Henüz firma kaydı görünmüyor. Web üzerinden firma bilgilerinizi tamamlayın.
                </Text>
              ) : null}
              <TouchableOpacity
                style={styles.updateButton}
                onPress={() =>
                  router.push("accounts-webview", {
                    path: "profile/#firma",
                    title: "Firma bilgileri",
                  })
                }
              >
                <Ionicons name="create-outline" size={18} color="#3b82f6" />
                <Text style={styles.updateButtonText}>Firmayı güncelle (web)</Text>
              </TouchableOpacity>
            </View>
            {/* Bekleyen Onaylar */}
            {profile?.pending_membership_requests &&
              profile.pending_membership_requests.length > 0 && (
                <View style={[styles.card, styles.pendingCard]}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="time" size={20} color="#f59e0b" />
                    <Text style={styles.cardTitle}>
                      Bekleyen Onaylar ({profile.pending_membership_requests.length})
                    </Text>
                  </View>
                  {profile.pending_membership_requests.map((request) => (
                    <View key={request.id} style={styles.requestItem}>
                      <View style={styles.requestItemContent}>
                        <Text style={styles.requestItemTitle}>
                          {request.individual_user.email}
                        </Text>
                        <Text style={styles.requestItemDate}>
                          {new Date(request.requested_at).toLocaleDateString("tr-TR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={[styles.requestActionButton, styles.approveButton]}
                          onPress={() => handleApproveRequest(request.id)}
                        >
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={styles.requestActionText}>Onayla</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.requestActionButton, styles.rejectButton]}
                          onPress={() => handleRejectRequest(request.id)}
                        >
                          <Ionicons name="close" size={16} color="#fff" />
                          <Text style={styles.requestActionText}>Reddet</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

            {/* Alt Kullanıcılar (Yetkili ise) */}
            {profile?.is_company_authority && profile?.sub_users && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="people" size={20} color="#3b82f6" />
                  <Text style={styles.cardTitle}>Alt Kullanıcılar</Text>
                </View>
                {profile.sub_users.length > 0 ? (
                  profile.sub_users.map((subUser) => (
                    <View key={subUser.email} style={styles.subUserItem}>
                      <View style={styles.subUserContent}>
                        <Text style={styles.subUserEmail}>{subUser.email}</Text>
                        {subUser.first_name && (
                          <Text style={styles.subUserName}>
                            {subUser.first_name} {subUser.last_name}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => {
                          // subUser.user.id gerekli, şimdilik email ile deneyelim
                          Alert.alert("Bilgi", "Alt kullanıcı çıkarma özelliği yakında eklenecek");
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Henüz alt kullanıcı bulunmuyor</Text>
                )}
              </View>
            )}
            </View>
            ) : null}
          </View>
        ) : null}

        {profileSection === "ayarlar" ? (
          <View>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="lock-closed" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Şifre Değiştir</Text>
              </View>
              <TouchableOpacity
                style={[styles.button, styles.changePasswordButton]}
                onPress={() => setShowPasswordModal(true)}
              >
                <Ionicons name="key" size={18} color="#fff" />
                <Text style={styles.changePasswordButtonText}>Şifreyi Değiştir</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="document-text-outline" size={20} color="#38bdf8" />
                <Text style={styles.cardTitle}>Hukuki metinler</Text>
              </View>
              <TouchableOpacity
                style={[styles.button, styles.changePasswordButton]}
                onPress={() => router.push("legal-hub")}
              >
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={styles.changePasswordButtonText}>Belgeleri görüntüle</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="settings" size={20} color="#ef4444" />
                <Text style={styles.cardTitle}>Hesap Ayarları</Text>
              </View>
              <TouchableOpacity
                style={[styles.button, styles.logoutButton]}
                onPress={async () => {
                  await logout();
                  router.replace("login");
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#fff" />
                <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={() => setShowDeleteModal(true)}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={styles.deleteButtonText}>Hesabı Sil</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </KeyboardAwareScrollScreen>

      {/* Şifre Değiştirme Modal */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setPasswordChangeStep("request_otp");
          setOtp("");
          setNewPassword("");
          setNewPasswordConfirm("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Şifre Değiştir</Text>
            {passwordChangeStep === "request_otp" ? (
              <Text style={styles.modalMessage}>
                Telefonunuza doğrulama kodu göndereceğiz. Devam etmek için aşağıdaki butona basın.
              </Text>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Doğrulama kodu (SMS)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="6 haneli kod"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Yeni Şifre</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="En az 8 karakter"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Yeni şifrenizi tekrar girin"
                    secureTextEntry
                    value={newPasswordConfirm}
                    onChangeText={setNewPasswordConfirm}
                  />
                </View>
              </>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPasswordChangeStep("request_otp");
                  setOtp("");
                  setNewPassword("");
                  setNewPasswordConfirm("");
                }}
              >
                <Text style={styles.modalCancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleChangePassword}
                disabled={changingPassword || sendingPasswordOtp}
              >
                {changingPassword || sendingPasswordOtp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>
                    {passwordChangeStep === "request_otp" ? "Kod Gönder" : "Şifreyi Güncelle"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Arka plan temizlensin mi? Modal */}
      <Modal
        visible={showRemoveBgModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowRemoveBgModal(false);
          setPendingAvatarUri(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 340 }]}>
            <Text style={styles.modalTitle}>Resim yüklendiğinde arka plan temizlensin mi?</Text>
            <Text style={[styles.modalMessage, { marginBottom: 12 }]}>Örnekler:</Text>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginBottom: 16 }}>
              <View style={{ alignItems: "center" }}>
                <Image source={require("../../assets/images/avatar_with_back.png")} style={{ width: 100, height: 100, borderRadius: 12 }} resizeMode="cover" />
                <Text style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Arka planlı</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Image source={require("../../assets/images/avatar_no_back.png")} style={{ width: 100, height: 100, borderRadius: 12 }} resizeMode="cover" />
                <Text style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Arka plansız</Text>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancelButton]} onPress={() => handleAvatarRemoveBgChoice(false)}>
                <Text style={styles.modalCancelButtonText}>Hayır, olduğu gibi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#16a34a" }]} onPress={() => handleAvatarRemoveBgChoice(true)}>
                <Text style={styles.modalDeleteButtonText}>Evet, temizle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hesap Silme Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setDeleteStep("password");
          setDeleteOtp("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hesabı Sil</Text>
            <Text style={styles.modalMessage}>
              Bu işlem geri alınamaz. Önce şifrenizi girin, ardından telefonunuza gelen doğrulama kodunu girin.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Şifre</Text>
              <TextInput
                style={styles.input}
                placeholder="Şifreniz"
                secureTextEntry
                value={deletePassword}
                onChangeText={setDeletePassword}
                editable={deleteStep === "password"}
              />
            </View>
            {deleteStep === "otp" && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Doğrulama kodu (SMS)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="6 haneli kod"
                  value={deleteOtp}
                  onChangeText={setDeleteOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeletePassword("");
                  setDeleteOtp("");
                  setDeleteStep("password");
                }}
              >
                <Text style={styles.modalCancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmDeleteAccount}
                disabled={sendingDeleteOtp || deletingAccount}
              >
                {sendingDeleteOtp || deletingAccount ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalDeleteButtonText}>
                    {deleteStep === "password" ? "Kod Gönder" : "Hesabı Sil"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Kişisel Bilgiler Güncelleme Modal */}
      <Modal
        visible={showPersonalInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPersonalInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kişisel Bilgileri Güncelle</Text>
              <TouchableOpacity onPress={() => setShowPersonalInfoModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ad</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Adınız"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Soyad</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Soyadınız"
                />
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowPersonalInfoModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleUpdatePersonalInfo}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Adres Bilgileri Güncelleme Modal - İl, İlçe, Mahalle seçim + Sokak satırı */}
      <AddressPickerModal
        visible={showAddressModal}
        title="Adres Güncelle"
        initialValue={{
          cityId,
          cityName,
          districtId,
          districtName,
          quarterId,
          quarterName,
          quarterValue,
          streetAndNumber,
        }}
        isSaving={isSaving}
        saveLabel="Güncelle"
        onCancel={() => setShowAddressModal(false)}
        onSave={async (v) => {
          await handleUpdateAddress(v);
        }}
      />

      {/* Firma Bilgileri Güncelleme Modal (Kurumsal için) */}
      <Modal
        visible={showCompanyInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCompanyInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Firma Bilgilerini Güncelle</Text>
              <TouchableOpacity onPress={() => setShowCompanyInfoModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Firma Adı</Text>
                <TextInput
                  style={styles.input}
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Firma adı"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Emlak Yetki Belge No</Text>
                <TextInput
                  style={styles.input}
                  value={emlakYetkiBelgeNo}
                  onChangeText={setEmlakYetkiBelgeNo}
                  placeholder="7 haneli belge no"
                  keyboardType="numeric"
                  maxLength={7}
                />
              </View>
              {profile?.vergi_no && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Vergi No (Değiştirilemez)</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={profile.vergi_no}
                    editable={false}
                  />
                </View>
              )}
              {profile?.vergi_dairesi && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Vergi Dairesi (Değiştirilemez)</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={profile.vergi_dairesi}
                    editable={false}
                  />
                </View>
              )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowCompanyInfoModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleUpdateCompanyInfo}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Uzmanlık bölgeleri seçici modalı */}
      <Modal
        visible={expertisePickerMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setExpertisePickerMode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.pickerModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {expertisePickerMode === "city" && "İl seçin"}
                {expertisePickerMode === "town" && (expCityName ? `İlçe seçin (${expCityName})` : "İlçe seçin")}
                {expertisePickerMode === "quarter" && (expTownName ? `Mahalle seçin (${expTownName})` : "Mahalle seçin")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {expertisePickerMode !== "city" ? (
                  <TouchableOpacity
                    onPress={() => {
                      setExpertisePickerSearch("");
                      if (expertisePickerMode === "quarter") {
                        setExpertisePickerMode("town");
                      } else if (expertisePickerMode === "town") {
                        setExpertisePickerMode("city");
                      }
                    }}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="arrow-back" size={20} color="#64748b" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setExpertisePickerMode(null)} style={{ padding: 6 }}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ara</Text>
              <TextInput
                style={styles.input}
                placeholder="Yazmaya başlayın..."
                value={expertisePickerSearch}
                onChangeText={setExpertisePickerSearch}
              />
            </View>

            <FlatList
              data={expertiseListData as any[]}
              keyExtractor={(item: any) => String(item?.Id ?? item?.quarter_value ?? Math.random())}
              renderItem={({ item }: any) => {
                const text =
                  expertisePickerMode === "city"
                    ? (item?.Proparcel_text ?? "")
                    : expertisePickerMode === "town"
                      ? (item?.Proparcel_text ?? "")
                      : (() => {
                          const tkgm = item?.Tkgm_text ?? "";
                          const ptxt = item?.Proparcel_text ?? "";
                          return ptxt && String(ptxt).trim() !== "" ? `${tkgm} (${ptxt})` : tkgm;
                        })();
                return (
                  <TouchableOpacity
                    style={styles.pickerItemRow}
                    onPress={() => {
                      if (expertisePickerMode === "city") {
                        setExpCityId(item.Id);
                        setExpCityName(item.Proparcel_text || "");
                        setExpTownId(null);
                        setExpTownName("");
                        setExpertisePickerSearch("");
                        setExpertisePickerMode("town");
                      } else if (expertisePickerMode === "town") {
                        setExpTownId(item.Id);
                        setExpTownName(item.Proparcel_text || "");
                        setExpertisePickerSearch("");
                        setExpertisePickerMode("quarter");
                      } else if (expertisePickerMode === "quarter") {
                        addExpertiseQuarterToDraft(item);
                        setExpertisePickerSearch("");
                        setExpertisePickerMode(null);
                      }
                    }}
                    disabled={expertisePickerMode === "quarter" && expertiseDraft.length >= 5}
                  >
                    <Text style={styles.pickerItemText} numberOfLines={2}>
                      {text}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Provider coverage seçici modalı */}
      <Modal
        visible={coveragePickerMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCoveragePickerMode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.pickerModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {coveragePickerMode === "city" && "İl seçin"}
                {coveragePickerMode === "town" && (covCityName ? `İlçe seçin (${covCityName})` : "İlçe seçin")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {coveragePickerMode !== "city" ? (
                  <TouchableOpacity
                    onPress={() => {
                      setCoveragePickerSearch("");
                      setCoveragePickerMode("city");
                    }}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="arrow-back" size={20} color="#64748b" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setCoveragePickerMode(null)} style={{ padding: 6 }}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ara</Text>
              <TextInput
                style={styles.input}
                placeholder="Yazmaya başlayın..."
                value={coveragePickerSearch}
                onChangeText={setCoveragePickerSearch}
              />
            </View>

            <FlatList
              data={coverageListData as any[]}
              keyExtractor={(item: any) => String(item?.Id ?? Math.random())}
              renderItem={({ item }: any) => {
                const text = item?.Proparcel_text ?? "";
                const currentCity = locationsData?.cities?.find((c) => c.Id === covCityId);
                return (
                  <TouchableOpacity
                    style={styles.pickerItemRow}
                    onPress={() => {
                      if (coveragePickerMode === "city") {
                        setCovCityId(item.Id);
                        setCovCityName(item.Proparcel_text || "");
                        setCoveragePickerSearch("");
                        setCoveragePickerMode("town");
                      } else if (coveragePickerMode === "town" && currentCity) {
                        addProviderCoverageToDraft(currentCity, item);
                        setCoveragePickerSearch("");
                        setCoveragePickerMode(null);
                      }
                    }}
                    disabled={coveragePickerMode === "town" && providerCoverageDraft.length >= 20}
                  >
                    <Text style={styles.pickerItemText} numberOfLines={2}>
                      {text}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptySmallText}>Kayıt bulunamadı.</Text>
                </View>
              }
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e293b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "#3b82f6",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 36,
    height: 36,
  },
  /* Header'ın altındaki profil alanı: iki kolon, ayraç çizgileri, avatar gölge+border */
  profileSectionBelowHeader: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  profileSectionRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  profileSectionCol1: {
    width: 88,
    alignSelf: "stretch",
    minHeight: 80,
  },
  profileSectionCol2: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 4,
    paddingVertical: 2,
    justifyContent: "flex-start",
  },
  profileSectionDividerV: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#e2e8f0",
    marginHorizontal: 10,
  },
  profileSectionDividerH: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginTop: 10,
    marginBottom: 6,
  },
  profileSectionAvatarTouch: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    position: "relative",
  },
  profileSectionAvatarRect: {
    flex: 1,
    width: "100%",
    minHeight: 72,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  profileSectionAvatarImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  profileSectionAvatarLetter: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  profileSectionAvatarRejectedBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
    zIndex: 10,
    elevation: 8,
  },
  profileSectionAvatarPendingBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
    zIndex: 10,
    elevation: 8,
  },
  profileSectionAvatarCameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    elevation: 8,
  },
  profileSectionUserName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
  },
  profileSectionUserType: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },
  profileVipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#d97706",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  profileVipBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  profileSectionNoteWrap: {
    marginTop: 10,
  },
  profileSectionNotePending: {
    marginTop: 10,
    fontSize: 12,
    color: "#b45309",
  },
  profileSectionNoteApproved: {
    marginTop: 10,
    fontSize: 12,
    color: "#047857",
  },
  content: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: "#64748b",
    textAlign: "center",
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Profil alanı (yeniden tasarım)
  profileBlock: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  profileAvatarRow: {
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarTouch: {
    position: "relative",
  },
  profileAvatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatarImage: {
    width: 64,
    height: 64,
  },
  profileAvatarPendingBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 10,
    elevation: 8,
  },
  profileAvatarRejectedBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 10,
    elevation: 8,
  },
  profileAvatarLetter: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  profileAvatarCameraBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 5,
    elevation: 4,
  },
  profileUserType: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  profileStatusPending: {
    marginTop: 6,
    fontSize: 12,
    color: "#b45309",
  },
  profileStatusApproved: {
    marginTop: 6,
    fontSize: 12,
    color: "#047857",
  },
  profileStatusRejected: {
    marginTop: 6,
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "500",
  },
  profileRejectionReason: {
    marginTop: 4,
    fontSize: 11,
    color: "#64748b",
    fontStyle: "italic",
    paddingHorizontal: 8,
  },
  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pendingCard: {
    borderColor: "#f59e0b",
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    flex: 1,
  },
  cardHint: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    color: "#64748b",
  },
  badgeStripRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4,
    paddingRight: 8,
  },
  badgeStripItem: {
    width: 72,
    alignItems: "center",
  },
  badgeStripLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
    lineHeight: 13,
  },
  badgeStripFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeStripFallbackText: {
    color: "#64748b",
    fontSize: 18,
  },
  usageStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  usageStatCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  usageStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  usageStatLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  usageSummaryRow: {
    gap: 6,
    marginBottom: 12,
  },
  usageSummaryText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    maxWidth: "100%",
  },
  chipPrime: {
    backgroundColor: "#e0f2fe",
    borderColor: "#38bdf8",
  },
  chipPrimaryCoverage: {
    backgroundColor: "#ecfdf5",
    borderColor: "#34d399",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    maxWidth: 220,
  },
  chipPrimeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369a1",
  },
  chipPrimaryBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.08)",
  },
  chipRemoveBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.08)",
  },
  emptySmallText: {
    fontSize: 13,
    color: "#64748b",
  },
  profileListingRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  profileListingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  profileListingMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  profileGenelHero: {
    marginBottom: 14,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  profileGenelHeroInner: {
    padding: 16,
  },
  profileHeroRatingBox: {
    marginBottom: 4,
  },
  profileHeroStarsTouch: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  profileHeroStarsTouchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  profileHeroRatingLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  profileHeroStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  profileHeroRatingNum: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  profileHeroRatingSub: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  profileHeroTapHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#94a3b8",
  },
  profileHeroRatingPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  profileHeroRatingPanelTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e40af",
    marginBottom: 6,
  },
  profileHeroRatingPanelLine: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
  },
  profileHeroBadgeBox: {
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  profileHeroBadgeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  profileHeroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileHeroBadgeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  profileHeroBadgeMore: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  profileHeroBadgeFallback: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  profileHeroBadgeFallbackTxt: {
    fontSize: 28,
    color: "#f59e0b",
  },
  profileListingCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  profileListingMainTouch: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  profileListingActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  profileListingActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  profileListingActionSecond: {
    marginLeft: 10,
  },
  profileListingActionBtnDisabled: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  profileListingActionTxtPrimary: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563eb",
  },
  profileListingActionTxtWarn: {
    fontSize: 14,
    fontWeight: "700",
    color: "#b45309",
  },
  profileListingActionTxtMuted: {
    color: "#94a3b8",
  },
  usageLoadingWrap: {
    alignItems: "center",
    paddingVertical: 16,
  },
  usageLoadingTxt: {
    marginTop: 8,
    fontSize: 13,
    color: "#64748b",
  },
  usageStatsDimmed: {
    opacity: 0.45,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  infoLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
  },
  // Form Inputs
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#1e293b",
  },
  inputDisabled: {
    backgroundColor: "#f1f5f9",
    color: "#94a3b8",
  },
  addressModalField: {
    marginBottom: 12,
  },
  addressPickerTouch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  addressPickerDisabled: {
    backgroundColor: "#f1f5f9",
    opacity: 0.8,
  },
  addressPickerText: {
    fontSize: 16,
    color: "#1e293b",
  },
  placeholderText: {
    color: "#94a3b8",
  },
  addressUpdateButton: {
    marginTop: 16,
    marginBottom: 8,
  },
  pickerModalContent: {
    maxHeight: "70%",
  },
  pickerSearchInput: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  pickerItemRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerItemText: {
    fontSize: 16,
    color: "#1e293b",
  },
  editButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  cancelButtonText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  searchButton: {
    backgroundColor: "#3b82f6",
    marginTop: 8,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  requestButton: {
    backgroundColor: "#10b981",
    marginTop: 12,
  },
  requestButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  addExpertiseButton: {
    backgroundColor: "#10b981",
    marginTop: 12,
  },
  addExpertiseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  leaveButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3b82f6",
    backgroundColor: "#fff",
  },
  updateButtonText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
  changePasswordButton: {
    backgroundColor: "#3b82f6",
  },
  changePasswordButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "#64748b",
    marginBottom: 12,
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  deleteButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
  // Found Company
  foundCompanyCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#10b981",
  },
  foundCompanyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10b981",
    marginBottom: 8,
  },
  foundCompanyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  foundCompanyVergi: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 12,
  },
  // Request Items
  requestItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  requestItemContent: {
    flex: 1,
  },
  requestItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  requestItemDate: {
    fontSize: 12,
    color: "#64748b",
  },
  requestItemBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  requestItemBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f59e0b",
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  requestActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  approveButton: {
    backgroundColor: "#10b981",
  },
  rejectButton: {
    backgroundColor: "#ef4444",
  },
  requestActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  // Sub Users
  subUserItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  subUserContent: {
    flex: 1,
  },
  subUserEmail: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  subUserName: {
    fontSize: 12,
    color: "#64748b",
  },
  removeButton: {
    padding: 8,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
    flex: 1,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalMessage: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: "#f1f5f9",
  },
  modalCancelButtonText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveButton: {
    backgroundColor: "#3b82f6",
  },
  modalSaveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalDeleteButton: {
    backgroundColor: "#ef4444",
  },
  modalDeleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
