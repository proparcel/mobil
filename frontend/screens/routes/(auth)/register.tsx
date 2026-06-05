/**
 * ProParcel Register Screen
 * 
 * Yeni kullanıcı kaydı - Bireysel/Kurumsal + OTP akışı.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  type ScrollView as ScrollViewType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../../src/hooks/useNavigation";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../../services/authService";
import type { RegistrationCompanyItem } from "../../../src/types/auth";
import { storageService } from "../../../services/storageService";
import { AppStatusBar } from "../../../components/app/AppStatusBar";
import { KeyboardAwareScrollScreen } from "../../../components/app/KeyboardAwareScrollScreen";
import { LandingLegalFooter } from "../../../components/landing/LandingLegalFooter";
import {
  INPUT_TEXT_COLOR,
  securePasswordInputProps,
  securePasswordInputStyle,
} from "../../../src/utils/passwordTextInput";
import type { AddressValue } from "../../../components/app/AddressPickerModal";
import { AddressFormFields } from "../../../components/app/AddressFormFields";
import {
  EducationPickerFields,
  EMPTY_EDUCATION_PICKER,
  type EducationPickerValue,
} from "../../../components/app/EducationPickerFields";
import { useScrollInputIntoView } from "../../../src/keyboard";
import {
  RegistrationMediaStep,
  type RegistrationMediaValue,
} from "../../../components/auth/RegistrationMediaStep";
import {
  RegistrationExpertiseStep,
  type RegistrationExpertiseValue,
} from "../../../components/auth/RegistrationExpertiseStep";

type MemberType = "individual" | "consultant" | "corporate";
type RegistrationStep = "info" | "media" | "expertise";
type CorporateType = "emlak" | "spk" | "lihkab";

function consultantEffectiveType(
  company: RegistrationCompanyItem | null,
): CorporateType | null {
  const t = String(company?.corporate_type || "").trim().toLowerCase();
  if (t === "emlak" || t === "spk" || t === "lihkab") return t;
  return null;
}

function isConsultantSpkFlow(company: RegistrationCompanyItem | null): boolean {
  return consultantEffectiveType(company) === "spk";
}

function shouldShowExpertiseStep(
  memberType: MemberType,
  company: RegistrationCompanyItem | null,
  corporateType: CorporateType | null,
): boolean {
  if (memberType === "individual") return false;
  if (memberType === "consultant" && consultantEffectiveType(company) === "lihkab") return false;
  if (memberType === "corporate" && corporateType === "lihkab") return false;
  return true;
}

function useSpkExpertiseMode(
  memberType: MemberType,
  consultantSpkFlow: boolean,
  corporateType: CorporateType | null,
): boolean {
  if (memberType === "corporate" && corporateType === "spk") return true;
  if (memberType === "consultant" && consultantSpkFlow) return true;
  return false;
}

function resolveEducationLevel(
  memberType: MemberType,
  company: RegistrationCompanyItem | null,
  corporateType: CorporateType | null,
  educationLevel: number | null
): number | undefined {
  if (memberType === "consultant" && consultantEffectiveType(company) === "lihkab") return 0;
  if (memberType === "corporate" && corporateType === "lihkab") return 0;
  return educationLevel ?? undefined;
}

function getGraduationNoteText(isRequired: boolean, variant: "consultant" | "corporate"): string {
  if (!isRequired) {
    return "Mezuniyetiniz uygulama üzerinde uzmanlık puanınızı arttırır ve uygulamanın bir çok alanda size öncelik vermesini sağlar.";
  }
  if (variant === "corporate") {
    return "SPK Lisanslı Değerleme Firması için üniversite bilgileri zorunludur.";
  }
  return "SPK Lisanslı Değerleme Firmasına bağlı danışmanlar için üniversite bilgileri zorunludur.";
}

function buildEducationPayload(
  memberType: MemberType,
  company: RegistrationCompanyItem | null,
  corporateType: CorporateType | null,
  educationLevel: number | null,
  educationDetails: EducationPickerValue,
) {
  const level = resolveEducationLevel(memberType, company, corporateType, educationLevel);
  if (level === undefined) return {};
  return {
    education_level: level,
    university_id:
      level === 1 || level === 2 ? educationDetails.universityId ?? undefined : undefined,
    department_id:
      level === 1 || level === 2 ? educationDetails.departmentId ?? undefined : undefined,
    custom_department:
      level === 1 || level === 2
        ? educationDetails.customDepartment.trim() || undefined
        : undefined,
  };
}

function getCompanyDisplayName(company: RegistrationCompanyItem | null): string {
  if (!company) return "";
  return (company.company_name || "").trim();
}

function ScrollInputWrap({
  scrollRef,
  style,
  children,
}: {
  scrollRef: React.RefObject<ScrollViewType | null>;
  style?: StyleProp<ViewStyle>;
  children: (focus: { onFocus: () => void; onBlur: () => void }) => React.ReactNode;
}) {
  const wrapRef = useRef<View>(null);
  const { handleFocus, handleBlur } = useScrollInputIntoView({ scrollRef, inputWrapRef: wrapRef });
  return (
    <View ref={wrapRef} collapsable={false} style={style}>
      {children({ onFocus: handleFocus, onBlur: handleBlur })}
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { isLoading, syncSessionFromLoginResponse } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewType>(null);

  // State
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>("info");
  const [registrationMedia, setRegistrationMedia] = useState<RegistrationMediaValue>({
    avatarUri: null,
    companyLogoUri: null,
  });
  const [registrationExpertise, setRegistrationExpertise] = useState<RegistrationExpertiseValue>({
    quarters: [],
    cities: [],
  });
  const [memberType, setMemberType] = useState<MemberType>("individual");
  const [consultantLicenseNo, setConsultantLicenseNo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [corporateType, setCorporateType] = useState<CorporateType | null>(null);
  const [companyLicenseNo, setCompanyLicenseNo] = useState("");
  const [officeNo, setOfficeNo] = useState("");
  const [spkTcNo, setSpkTcNo] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [educationLevel, setEducationLevel] = useState<number | null>(null);
  const [educationDetails, setEducationDetails] = useState<EducationPickerValue>(EMPTY_EDUCATION_PICKER);
  const [corporateAddress, setCorporateAddress] = useState<AddressValue>({
    cityId: null,
    cityName: "",
    districtId: null,
    districtName: "",
    quarterId: null,
    quarterName: "",
    quarterValue: null,
    streetAndNumber: "",
  });
  const [companySearchText, setCompanySearchText] = useState("");
  const [companySearchResults, setCompanySearchResults] = useState<RegistrationCompanyItem[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<RegistrationCompanyItem | null>(null);
  const [isCompanySearching, setIsCompanySearching] = useState(false);
  const [companySearchError, setCompanySearchError] = useState("");
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpModalError, setOtpModalError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    storageService.getDeferredReferralCode().then((code) => {
      if (code) setReferralCode(code);
    });
  }, []);

  // Danışman: firma arama (liste API)
  useEffect(() => {
    if (memberType !== "consultant") {
      setIsCompanySearching(false);
      setCompanySearchResults([]);
      setIsCompanyPickerOpen(false);
      return;
    }

    const q = companySearchText.trim();
    if (!isCompanyPickerOpen) {
      setIsCompanySearching(false);
      setCompanySearchResults([]);
      return;
    }

    if (selectedCompany && q === getCompanyDisplayName(selectedCompany)) {
      setIsCompanySearching(false);
      setCompanySearchResults([]);
      setCompanySearchError("");
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsCompanySearching(true);
        setCompanySearchError("");

        const res = await authService.listCompaniesForRegistration(q, 20);
        if (cancelled) return;

        setCompanySearchResults(res.data || []);
        if (!res.success) setCompanySearchError(res.message || "Firma araması yapılamadı.");
      } catch {
        if (cancelled) return;
        setCompanySearchError("Firma araması sırasında hata oluştu.");
      } finally {
        if (!cancelled) setIsCompanySearching(false);
      }
    }, q ? 400 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companySearchText, isCompanyPickerOpen, memberType, selectedCompany]);

  const consultantSpkFlow =
    memberType === "consultant" && isConsultantSpkFlow(selectedCompany);
  const consultantSubtype = consultantEffectiveType(selectedCompany);
  const showExpertiseStep = shouldShowExpertiseStep(memberType, selectedCompany, corporateType);
  const expertiseMode = useSpkExpertiseMode(memberType, consultantSpkFlow, corporateType)
    ? "cities"
    : "quarters";

  useEffect(() => {
    if (memberType !== "consultant" || consultantSubtype === "lihkab") return;
    if (consultantSpkFlow && educationLevel === 0) {
      setEducationLevel(null);
    }
  }, [memberType, consultantSubtype, consultantSpkFlow, educationLevel]);

  /**
   * Form validasyonu
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName) {
      newErrors.firstName = "Ad gereklidir";
    }

    if (!lastName) {
      newErrors.lastName = "Soyad gereklidir";
    }

    if (!email) {
      newErrors.email = "E-posta adresi gereklidir";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Geçerli bir e-posta adresi girin";
    }

    if (!phoneNumber || phoneNumber.length !== 10 || !phoneNumber.startsWith("5")) {
      newErrors.phone = "Geçerli bir telefon numarası girin (5XXXXXXXXX)";
    }

    if (!password) {
      newErrors.password = "Şifre gereklidir";
    } else if (password.length < 8) {
      newErrors.password = "Şifre en az 8 karakter olmalıdır";
    }

    if (password !== passwordConfirm) {
      newErrors.passwordConfirm = "Şifreler eşleşmiyor";
    }

    // Kurumsal için ek alanlar
    if (memberType === "corporate") {
      if (!companyName) {
        newErrors.companyName = "Firma adı gereklidir";
      }
      if (!corporateType) {
        newErrors.corporateType = "Firma tipi seçiniz";
      }
      if (!companyLicenseNo) {
        newErrors.companyLicenseNo = "Lisans / yetki belge no gereklidir";
      }
      if (corporateType === "spk" && (!spkTcNo || !/^\d{11}$/.test(spkTcNo))) {
        newErrors.spkTcNo = "SPK için 11 haneli TC kimlik no gereklidir";
      }
      if (corporateType === "lihkab" && !officeNo.trim()) {
        newErrors.officeNo = "Lihkab büro için büro no gereklidir";
      }
      if (!corporateAddress.cityId || !corporateAddress.districtId || !corporateAddress.quarterValue) {
        newErrors.address = "Adres için il, ilçe ve mahalle seçiniz";
      }
      if (!corporateAddress.streetAndNumber.trim()) {
        newErrors.streetAndNumber = "Sokak ve numara bilgisi gereklidir";
      }
      if (corporateType && corporateType !== "lihkab" && corporateType === "spk") {
        if (educationLevel === null) {
          newErrors.educationLevel = "Mezuniyet seviyesi seçiniz";
        } else if (educationLevel !== 1) {
          newErrors.educationLevel = "SPK için Lisans seviyesi seçiniz";
        } else if (!educationDetails.universityId) {
          newErrors.universityId = "Üniversite seçiniz";
        }
      }
    }

    // Danışman için ek alanlar
    if (memberType === "consultant") {
      if (!selectedCompany?.company_profile_id) {
        newErrors.companyPicker = "Lütfen listeden firma seçiniz";
      }
      if (consultantSubtype === "spk" && !consultantLicenseNo.trim()) {
        newErrors.consultantLicenseNo = "SPK Lisanslı Değerleme Uzmanı için Lisans No gereklidir";
      }
      if (!corporateAddress.cityId || !corporateAddress.districtId || !corporateAddress.quarterValue) {
        newErrors.address = "Adres için il, ilçe ve mahalle seçiniz";
      }
      if (!corporateAddress.streetAndNumber.trim()) {
        newErrors.streetAndNumber = "Sokak ve numara bilgisi gereklidir";
      }
      if (consultantSubtype !== "lihkab" && consultantSpkFlow) {
        if (educationLevel !== 1 && educationLevel !== 2) {
          newErrors.educationLevel =
            "SPK Lisanslı firmaya bağlı danışmanlar için Lisans veya Ön Lisans seçiniz";
        } else if (!educationDetails.universityId) {
          newErrors.universityId = "Üniversite seçiniz";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildRegisterData = () => {
    const selectedCompanyProfileId = selectedCompany?.company_profile_id;

    return {
      member_type: memberType,
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      password,
      password_confirm: passwordConfirm,
      referral_code: referralCode?.trim() || undefined,
      ...(memberType === "consultant" && selectedCompanyProfileId
        ? {
            consultant_license_no: consultantSubtype === "spk" ? consultantLicenseNo.trim() : undefined,
            company_profile_id: selectedCompanyProfileId,
            city_id: corporateAddress.cityId || undefined,
            district_id: corporateAddress.districtId || undefined,
            quarter_id: corporateAddress.quarterId || undefined,
            quarter_value: corporateAddress.quarterValue || undefined,
            city_name: corporateAddress.cityName || undefined,
            district_name: corporateAddress.districtName || undefined,
            quarter_name: corporateAddress.quarterName || undefined,
            street_and_number: corporateAddress.streetAndNumber.trim(),
            postal_code: postalCode.trim() || undefined,
            ...buildEducationPayload(
              memberType,
              selectedCompany,
              corporateType,
              educationLevel,
              educationDetails,
            ),
          }
        : {}),
      ...(memberType === "corporate" && {
        corporate_type: corporateType || undefined,
        ...(corporateType && corporateType !== "spk" ? { is_expert: false } : {}),
        company_name: companyName,
        company_license_no: companyLicenseNo,
        office_no: corporateType === "lihkab" ? officeNo.trim() : undefined,
        spk_tc_no: corporateType === "spk" ? spkTcNo : undefined,
        city_id: corporateAddress.cityId || undefined,
        district_id: corporateAddress.districtId || undefined,
        quarter_id: corporateAddress.quarterId || undefined,
        quarter_value: corporateAddress.quarterValue || undefined,
        city_name: corporateAddress.cityName || undefined,
        district_name: corporateAddress.districtName || undefined,
        quarter_name: corporateAddress.quarterName || undefined,
        street_and_number: corporateAddress.streetAndNumber.trim(),
        postal_code: postalCode.trim() || undefined,
        ...buildEducationPayload(
          memberType,
          null,
          corporateType,
          educationLevel,
          educationDetails,
        ),
      }),
    };
  };

  /** API errors içinden kayıt-varlığı uyarı metnini üretir */
  const getDuplicateWarning = (errs: Record<string, string[]> | undefined): string | null => {
    if (!errs) return null;
    const parts: string[] = [];
    if (Array.isArray(errs.email) && errs.email[0]) parts.push(errs.email[0]);
    if (Array.isArray(errs.phone_number) && errs.phone_number[0]) parts.push(errs.phone_number[0]);
    return parts.length ? parts.join("\n") : null;
  };

  const mapRegisterApiErrors = (errs: Record<string, string[]> | undefined): Record<string, string> => {
    if (!errs) return {};
    const mapped: Record<string, string> = {};
    if (errs.address?.[0]) mapped.address = errs.address[0];
    if (errs.street_and_number?.[0]) mapped.streetAndNumber = errs.street_and_number[0];
    if (errs.education_level?.[0]) mapped.educationLevel = errs.education_level[0];
    if (errs.university_id?.[0]) mapped.universityId = errs.university_id[0];
    if (errs.department_id?.[0]) mapped.departmentId = errs.department_id[0];
    if (errs.company_profile_id?.[0]) mapped.companyPicker = errs.company_profile_id[0];
    if (errs.company_vergi_no?.[0]) mapped.companyPicker = errs.company_vergi_no[0];
    if (errs.consultant_license_no?.[0]) mapped.consultantLicenseNo = errs.consultant_license_no[0];
    return mapped;
  };

  const buildRegisterDataWithExpertise = () => {
    const base = buildRegisterData();
    const quarterCsv = registrationExpertise.quarters.map((q) => q.quarter_value).join(",");
    const cityCsv = registrationExpertise.cities.map((c) => c.city_id).join(",");
    return {
      ...base,
      ...(quarterCsv ? { expertise_quarters: quarterCsv } : {}),
      ...(cityCsv ? { expertise_cities: cityCsv } : {}),
    };
  };

  const proceedToOtp = async () => {
    const registerData = buildRegisterDataWithExpertise();
    setIsSending(true);
    setErrors({});
    try {
      const sendRes = await authService.registerSendOTP(registerData);
      if (!sendRes.success) {
        setErrors({
          general: sendRes.message || "Kod gönderilemedi. Lütfen tekrar deneyin.",
          ...mapRegisterApiErrors(sendRes.errors),
        });
        setRegistrationStep("info");
        return;
      }
      setOtpModalError("");
      setOtp("");
      setShowOtpModal(true);
    } catch {
      setErrors({ general: "Bir hata oluştu. Lütfen tekrar deneyin." });
      setRegistrationStep("info");
    } finally {
      setIsSending(false);
    }
  };

  const goToStepAfterMedia = () => {
    if (showExpertiseStep) {
      setRegistrationStep("expertise");
      return;
    }
    void proceedToOtp();
  };

  const handleRegistrationBack = () => {
    if (registrationStep === "expertise") {
      setRegistrationStep("media");
      return;
    }
    if (registrationStep === "media") {
      setRegistrationStep("info");
      return;
    }
    router.back();
  };

  /**
   * Devam: Bilgi validasyonu → medya adımı
   */
  const handleDevam = async () => {
    if (!validateForm()) return;

    const registerData = buildRegisterData();

    setIsSending(true);
    setErrors({});

    try {
      const validateRes = await authService.registerValidate(registerData);

      if (!validateRes.success) {
        const dup = getDuplicateWarning(validateRes.errors);
        if (dup) {
          Alert.alert("Uyarı", dup);
          setIsSending(false);
          return;
        }
        setErrors({
          general: validateRes.message || "Bilgilerinizi kontrol edin.",
          ...mapRegisterApiErrors(validateRes.errors),
        });
        setIsSending(false);
        return;
      }

      setRegistrationStep("media");
    } catch (error) {
      setErrors({ general: "Bir hata oluştu. Lütfen tekrar deneyin." });
    } finally {
      setIsSending(false);
    }
  };

  /**
   * OTP doğrula ve kayıt ol (modal içinden)
   */
  const handleVerifyOTP = async () => {
    if (isVerifying) {
      return;
    }

    if (!otp || otp.length !== 6) {
      setOtpModalError("6 haneli doğrulama kodunu girin");
      return;
    }

    const registerData = buildRegisterDataWithExpertise();

    setOtpModalError("");
    setIsVerifying(true);

    try {
      const response = await authService.registerVerifyOTP(registerData, otp, {
        avatarUri: registrationMedia.avatarUri,
        companyLogoUri: registrationMedia.companyLogoUri,
      });

      if (response.success && response.data) {
        syncSessionFromLoginResponse(response.data);
        setShowOtpModal(false);
        await storageService.clearDeferredReferralCode();
        router.replace("index");
      } else {
        setOtpModalError(response.message || "Geçersiz doğrulama kodu");
      }
    } catch (error) {
      setOtpModalError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsVerifying(false);
    }
  };

  const stepSubtitle =
    registrationStep === "info"
      ? "Hesap bilgilerinizi girin"
      : registrationStep === "media"
        ? showExpertiseStep
          ? "2/3 Profil fotoğrafı"
          : "2/2 Profil fotoğrafı"
        : "3/3 Uzmanlık bölgeleri";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AppStatusBar />
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleRegistrationBack}
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Kayıt Ol</Text>
        <View style={styles.headerRight} />
      </View>
      <KeyboardAwareScrollScreen
        ref={scrollRef}
        behaviorContext="auth"
        headerHeight={56}
        backgroundColor="#fff"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
      >
        {/* Header */}
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Hesap Oluştur</Text>
          <Text style={styles.formSubtitle}>
            {registrationStep === "info" ? "ProParcel'e hoş geldiniz" : stepSubtitle}
          </Text>
        </View>

        {/* Error Message */}
        {errors.general ? <Text style={styles.error}>{errors.general}</Text> : null}

        {registrationStep === "media" ? (
          <RegistrationMediaStep
            memberType={memberType}
            value={registrationMedia}
            onChange={setRegistrationMedia}
            onContinue={goToStepAfterMedia}
            onSkip={goToStepAfterMedia}
          />
        ) : null}

        {registrationStep === "expertise" ? (
          <RegistrationExpertiseStep
            mode={expertiseMode}
            value={registrationExpertise}
            onChange={setRegistrationExpertise}
            onContinue={() => void proceedToOtp()}
            onSkip={() => void proceedToOtp()}
            busy={isSending}
          />
        ) : null}

        {registrationStep === "info" ? (
        <>
        {/* Member Type Selection */}
        <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, memberType === "individual" && styles.activeTab]}
              onPress={() => {
                setMemberType("individual");
                setErrors({});
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  memberType === "individual" && styles.activeTabText,
                ]}
              >
                Bireysel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, memberType === "consultant" && styles.activeTab]}
              onPress={() => {
                setMemberType("consultant");
                setErrors({});
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  memberType === "consultant" && styles.activeTabText,
                ]}
              >
                Danışman
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, memberType === "corporate" && styles.activeTab]}
              onPress={() => {
                setMemberType("corporate");
                setErrors({});
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  memberType === "corporate" && styles.activeTabText,
                ]}
              >
                Kurumsal
              </Text>
            </TouchableOpacity>
          </View>

        {/* Form */}
        <View style={styles.form}>
            {/* First Name */}
            <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
              {({ onFocus, onBlur }) => (
                <>
                  <Text style={styles.label}>Ad *</Text>
                  <TextInput
                    style={[styles.input, errors.firstName && styles.inputError]}
                    placeholder="Adınız"
                    placeholderTextColor="#999"
                    value={firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      if (errors.firstName) setErrors((e) => ({ ...e, firstName: "" }));
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  {errors.firstName ? (
                    <Text style={styles.fieldError}>{errors.firstName}</Text>
                  ) : null}
                </>
              )}
            </ScrollInputWrap>

            {/* Last Name */}
            <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
              {({ onFocus, onBlur }) => (
                <>
                  <Text style={styles.label}>Soyad *</Text>
                  <TextInput
                    style={[styles.input, errors.lastName && styles.inputError]}
                    placeholder="Soyadınız"
                    placeholderTextColor="#999"
                    value={lastName}
                    onChangeText={(text) => {
                      setLastName(text);
                      if (errors.lastName) setErrors((e) => ({ ...e, lastName: "" }));
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  {errors.lastName ? (
                    <Text style={styles.fieldError}>{errors.lastName}</Text>
                  ) : null}
                </>
              )}
            </ScrollInputWrap>

            {/* Email */}
            <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
              {({ onFocus, onBlur }) => (
                <>
                  <Text style={styles.label}>E-posta *</Text>
                  <TextInput
                    style={[styles.input, errors.email && styles.inputError]}
                    placeholder="ornek@email.com"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email) setErrors((e) => ({ ...e, email: "" }));
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
                </>
              )}
            </ScrollInputWrap>

            {/* Phone */}
            <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
              {({ onFocus, onBlur }) => (
                <>
                  <Text style={styles.label}>Telefon *</Text>
                  <View style={styles.phoneInputContainer}>
                    <Text style={styles.phonePrefix}>+90</Text>
                    <TextInput
                      style={[styles.input, styles.phoneInput, errors.phone && styles.inputError]}
                      placeholder="5XX XXX XX XX"
                      placeholderTextColor="#999"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={phoneNumber}
                      onChangeText={(text) => {
                        setPhoneNumber(text.replace(/\D/g, ""));
                        if (errors.phone) setErrors((e) => ({ ...e, phone: "" }));
                      }}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                  </View>
                  {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}
                </>
              )}
            </ScrollInputWrap>

            {/* Consultant Fields */}
            {memberType === "consultant" && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Firma Seç *</Text>
                  <Text style={styles.helperText}>
                    Danışman alt tipi seçtiğiniz firmanın kurumsal tipinden otomatik belirlenir.
                  </Text>
                  <TouchableOpacity
                    style={[styles.select2Button, errors.companyPicker && styles.inputError]}
                    onPress={() => {
                      setCompanySearchText(selectedCompany ? getCompanyDisplayName(selectedCompany) : "");
                      setCompanySearchError("");
                      setIsCompanyPickerOpen((open) => !open);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.select2ButtonText,
                        !selectedCompany && styles.select2Placeholder,
                      ]}
                    >
                      {selectedCompany ? getCompanyDisplayName(selectedCompany) : "Listeden firma seçin"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#64748b" />
                  </TouchableOpacity>
                  {selectedCompany?.corporate_type ? (
                    <Text style={styles.helperText}>
                      Firma tipi: {String(selectedCompany.corporate_type).toUpperCase()}
                    </Text>
                  ) : null}
                  {isCompanyPickerOpen ? (
                    <View style={styles.select2Dropdown}>
                      <ScrollInputWrap scrollRef={scrollRef}>
                        {({ onFocus, onBlur }) => (
                          <TextInput
                            style={styles.select2SearchInput}
                            placeholder="Firma adı ile arayın"
                            placeholderTextColor="#999"
                            value={companySearchText}
                            onChangeText={(text) => {
                              setCompanySearchText(text);
                              setCompanySearchError("");
                            }}
                            autoCapitalize="words"
                            autoCorrect={false}
                            onFocus={onFocus}
                            onBlur={onBlur}
                          />
                        )}
                      </ScrollInputWrap>

                      {isCompanySearching ? (
                        <View style={styles.companyPickerStatus}>
                          <ActivityIndicator color="#1a73e8" />
                          <Text style={styles.helperText}>Firma listesi yükleniyor...</Text>
                        </View>
                      ) : null}

                      {companySearchError ? (
                        <Text style={styles.fieldError}>{companySearchError}</Text>
                      ) : null}

                      {!isCompanySearching && !companySearchError && companySearchResults.length === 0 ? (
                        <Text style={styles.helperText}>Firma adı yazarak listeden seçin.</Text>
                      ) : null}

                      {companySearchResults.length > 0 ? (
                        <ScrollView style={styles.companyResults} keyboardShouldPersistTaps="handled">
                          {companySearchResults.map((company) => {
                            const displayName = getCompanyDisplayName(company);
                            return (
                              <TouchableOpacity
                                key={`${company.company_profile_id}-${displayName}`}
                                style={styles.companyResultItem}
                                onPress={() => {
                                  setSelectedCompany(company);
                                  setCompanySearchText(displayName);
                                  setCompanySearchResults([]);
                                  setCompanySearchError("");
                                  setIsCompanyPickerOpen(false);
                                  if (errors.companyPicker) setErrors((e) => ({ ...e, companyPicker: "" }));
                                }}
                              >
                                <Text style={styles.companyResultTitle}>{displayName}</Text>
                                {company.corporate_type ? (
                                  <Text style={styles.companyResultMeta}>
                                    {company.corporate_type.toUpperCase()}
                                  </Text>
                                ) : null}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      ) : null}
                    </View>
                  ) : null}
                  {selectedCompany ? (
                    <View style={styles.selectedCompanyBox}>
                      <View style={styles.selectedCompanyText}>
                        <Text style={styles.selectedCompanyTitle}>{getCompanyDisplayName(selectedCompany)}</Text>
                        {selectedCompany.corporate_type ? (
                          <Text style={styles.selectedCompanyMeta}>
                            {selectedCompany.corporate_type.toUpperCase()}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedCompany(null);
                          setCompanySearchText("");
                          setIsCompanyPickerOpen(true);
                        }}
                      >
                        <Text style={styles.clearCompanyText}>Kaldır</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {errors.companyPicker ? (
                    <Text style={styles.fieldError}>{errors.companyPicker}</Text>
                  ) : null}
                </View>

                {consultantSubtype === "spk" ? (
                  <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
                    {({ onFocus, onBlur }) => (
                      <>
                        <Text style={styles.label}>Lisans No *</Text>
                        <TextInput
                          style={[styles.input, errors.consultantLicenseNo && styles.inputError]}
                          placeholder="SPK lisans numaranız"
                          placeholderTextColor="#999"
                          value={consultantLicenseNo}
                          onChangeText={(text) => {
                            setConsultantLicenseNo(text);
                            if (errors.consultantLicenseNo) {
                              setErrors((e) => ({ ...e, consultantLicenseNo: "" }));
                            }
                          }}
                          onFocus={onFocus}
                          onBlur={onBlur}
                        />
                        {errors.consultantLicenseNo ? (
                          <Text style={styles.fieldError}>{errors.consultantLicenseNo}</Text>
                        ) : null}
                      </>
                    )}
                  </ScrollInputWrap>
                ) : null}

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Adres Bilgileri *</Text>
                  <Text style={styles.helperText}>
                    Danışman kaydı için il, ilçe, mahalle ve açık adres bilgileri zorunludur.
                  </Text>
                  <AddressFormFields
                    scrollRef={scrollRef}
                    value={corporateAddress}
                    onChange={(addr) => {
                      setCorporateAddress(addr);
                      setErrors((e) => ({ ...e, address: "", streetAndNumber: "" }));
                    }}
                    errors={{
                      address: errors.address,
                      streetAndNumber: errors.streetAndNumber,
                    }}
                  />
                </View>

                {consultantSubtype !== "lihkab" ? (
                  <View style={styles.inputContainer}>
                    <View style={styles.graduationTitleRow}>
                      <Text style={styles.label}>Mezuniyet Bilgileri</Text>
                      {consultantSpkFlow ? (
                        <Text style={styles.graduationRequiredBadge}>* Zorunlu</Text>
                      ) : null}
                    </View>
                    <View style={styles.graduationInfoNote}>
                      <Ionicons name="information-circle-outline" size={18} color="#1d4ed8" />
                      <Text style={styles.graduationInfoNoteText}>
                        {getGraduationNoteText(consultantSpkFlow, "consultant")}
                      </Text>
                    </View>
                    <View style={styles.educationOptions}>
                      {[
                        { value: 0, label: "Lise" },
                        { value: 2, label: "Ön Lisans" },
                        { value: 1, label: "Lisans" },
                      ].map((item) => {
                        const disabled = consultantSpkFlow && item.value === 0;
                        return (
                          <TouchableOpacity
                            key={item.value}
                            style={[
                              styles.educationOption,
                              disabled && styles.educationOptionDisabled,
                              educationLevel === item.value && styles.educationOptionActive,
                            ]}
                            onPress={() => {
                              if (disabled) return;
                              setEducationLevel(item.value);
                              if (item.value === 0) {
                                setEducationDetails(EMPTY_EDUCATION_PICKER);
                              } else {
                                setEducationDetails((current) => ({
                                  ...current,
                                  departmentId: null,
                                  departmentName: "",
                                  customDepartment: "",
                                }));
                              }
                              if (errors.educationLevel) {
                                setErrors((e) => ({
                                  ...e,
                                  educationLevel: "",
                                  universityId: "",
                                  departmentId: "",
                                }));
                              }
                            }}
                            disabled={disabled}
                          >
                            <Text
                              style={[
                                styles.educationOptionText,
                                disabled && styles.educationOptionTextDisabled,
                                educationLevel === item.value && styles.educationOptionTextActive,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {errors.educationLevel ? (
                      <Text style={styles.fieldError}>{errors.educationLevel}</Text>
                    ) : null}

                    {(educationLevel === 1 || educationLevel === 2) ? (
                      <EducationPickerFields
                        scrollRef={scrollRef}
                        educationLevel={educationLevel}
                        value={educationDetails}
                        required={consultantSpkFlow}
                        onChange={(next) => {
                          setEducationDetails(next);
                          setErrors((e) => ({
                            ...e,
                            universityId: "",
                            departmentId: "",
                          }));
                        }}
                        errors={{
                          universityId: errors.universityId,
                          departmentId: errors.departmentId,
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
              </>
            )}

            {/* Referral Code — şimdilik gizli; deferred deep link kodu arka planda kullanılmaya devam eder */}

            {/* Corporate Fields */}
            {memberType === "corporate" && (
              <>
                <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
                  {({ onFocus, onBlur }) => (
                    <>
                      <Text style={styles.label}>Firma Marka/Ünvan *</Text>
                      <TextInput
                        style={[styles.input, errors.companyName && styles.inputError]}
                        placeholder="Firma adı"
                        placeholderTextColor="#999"
                        value={companyName}
                        onChangeText={(text) => {
                          setCompanyName(text);
                          if (errors.companyName) setErrors((e) => ({ ...e, companyName: "" }));
                        }}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      />
                      {errors.companyName ? (
                        <Text style={styles.fieldError}>{errors.companyName}</Text>
                      ) : null}
                    </>
                  )}
                </ScrollInputWrap>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Firma Tipi *</Text>
                  <View style={styles.corporateTypeTabs}>
                    {[
                      { value: "emlak", label: "Emlak" },
                      { value: "spk", label: "SPK" },
                      { value: "lihkab", label: "LİHKAB" },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.corporateTypeTab,
                          corporateType === item.value && styles.corporateTypeTabActive,
                        ]}
                        onPress={() => {
                          setCorporateType(item.value as CorporateType);
                          if (item.value === "spk") {
                            setEducationLevel(1);
                          } else if (item.value === "lihkab") {
                            setEducationLevel(null);
                            setEducationDetails(EMPTY_EDUCATION_PICKER);
                          }
                          if (errors.corporateType) {
                            setErrors((e) => ({
                              ...e,
                              corporateType: "",
                              universityId: "",
                              departmentId: "",
                            }));
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.corporateTypeTabText,
                            corporateType === item.value && styles.corporateTypeTabTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {errors.corporateType ? (
                    <Text style={styles.fieldError}>{errors.corporateType}</Text>
                  ) : null}
                </View>

                {corporateType === "spk" ? (
                  <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
                    {({ onFocus, onBlur }) => (
                      <>
                        <Text style={styles.label}>TC Kimlik No *</Text>
                        <TextInput
                          style={[styles.input, errors.spkTcNo && styles.inputError]}
                          placeholder="11 haneli TC kimlik no"
                          placeholderTextColor="#999"
                          keyboardType="number-pad"
                          maxLength={11}
                          value={spkTcNo}
                          onChangeText={(text) => {
                            setSpkTcNo(text.replace(/\D/g, ""));
                            if (errors.spkTcNo) setErrors((e) => ({ ...e, spkTcNo: "" }));
                          }}
                          onFocus={onFocus}
                          onBlur={onBlur}
                        />
                        {errors.spkTcNo ? (
                          <Text style={styles.fieldError}>{errors.spkTcNo}</Text>
                        ) : null}
                      </>
                    )}
                  </ScrollInputWrap>
                ) : null}

                {corporateType === "lihkab" ? (
                  <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
                    {({ onFocus, onBlur }) => (
                      <>
                        <Text style={styles.label}>Büro No *</Text>
                        <TextInput
                          style={[styles.input, errors.officeNo && styles.inputError]}
                          placeholder="Büro no"
                          placeholderTextColor="#999"
                          value={officeNo}
                          onChangeText={(text) => {
                            setOfficeNo(text);
                            if (errors.officeNo) setErrors((e) => ({ ...e, officeNo: "" }));
                          }}
                          onFocus={onFocus}
                          onBlur={onBlur}
                        />
                        {errors.officeNo ? (
                          <Text style={styles.fieldError}>{errors.officeNo}</Text>
                        ) : null}
                      </>
                    )}
                  </ScrollInputWrap>
                ) : null}

                <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
                  {({ onFocus, onBlur }) => (
                    <>
                      <Text style={styles.label}>Lisans / Yetki Belge No *</Text>
                      <TextInput
                        style={[
                          styles.input,
                          errors.companyLicenseNo && styles.inputError,
                        ]}
                        placeholder={corporateType === "emlak" ? "7 haneli TTBS yetki belge no" : "Lisans / yetki belge no"}
                        placeholderTextColor="#999"
                        value={companyLicenseNo}
                        onChangeText={(text) => {
                          setCompanyLicenseNo(corporateType === "emlak" ? text.replace(/\D/g, "") : text);
                          if (errors.companyLicenseNo)
                            setErrors((e) => ({ ...e, companyLicenseNo: "" }));
                        }}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      />
                      {errors.companyLicenseNo ? (
                        <Text style={styles.fieldError}>{errors.companyLicenseNo}</Text>
                      ) : null}
                    </>
                  )}
                </ScrollInputWrap>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Adres Bilgileri *</Text>
                  <AddressFormFields
                    scrollRef={scrollRef}
                    value={corporateAddress}
                    onChange={(addr) => {
                      setCorporateAddress(addr);
                      setErrors((e) => ({ ...e, address: "", streetAndNumber: "" }));
                    }}
                    errors={{
                      address: errors.address,
                      streetAndNumber: errors.streetAndNumber,
                    }}
                  />
                </View>

                {corporateType && corporateType !== "lihkab" ? (
                  <View style={styles.inputContainer}>
                    <View style={styles.graduationTitleRow}>
                      <Text style={styles.label}>Mezuniyet Bilgileri</Text>
                      {corporateType === "spk" ? (
                        <Text style={styles.graduationRequiredBadge}>* Zorunlu</Text>
                      ) : null}
                    </View>
                    <View style={styles.graduationInfoNote}>
                      <Ionicons name="information-circle-outline" size={18} color="#1d4ed8" />
                      <Text style={styles.graduationInfoNoteText}>
                        {getGraduationNoteText(corporateType === "spk", "corporate")}
                      </Text>
                    </View>
                    <View style={styles.educationOptions}>
                      {[
                        { value: 0, label: "Lise" },
                        { value: 2, label: "Ön Lisans" },
                        { value: 1, label: "Lisans" },
                      ].map((item) => {
                        const disabled = corporateType === "spk" && item.value !== 1;
                        return (
                          <TouchableOpacity
                            key={item.value}
                            style={[
                              styles.educationOption,
                              disabled && styles.educationOptionDisabled,
                              educationLevel === item.value && styles.educationOptionActive,
                            ]}
                            onPress={() => {
                              if (disabled) return;
                              setEducationLevel(item.value);
                              if (item.value === 0) {
                                setEducationDetails(EMPTY_EDUCATION_PICKER);
                              } else {
                                setEducationDetails((current) => ({
                                  ...current,
                                  departmentId: null,
                                  departmentName: "",
                                  customDepartment: "",
                                }));
                              }
                              if (errors.educationLevel) {
                                setErrors((e) => ({
                                  ...e,
                                  educationLevel: "",
                                  universityId: "",
                                  departmentId: "",
                                }));
                              }
                            }}
                            disabled={disabled}
                          >
                            <Text
                              style={[
                                styles.educationOptionText,
                                disabled && styles.educationOptionTextDisabled,
                                educationLevel === item.value && styles.educationOptionTextActive,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {errors.educationLevel ? (
                      <Text style={styles.fieldError}>{errors.educationLevel}</Text>
                    ) : null}

                    {(educationLevel === 1 || educationLevel === 2) ? (
                      <EducationPickerFields
                        scrollRef={scrollRef}
                        educationLevel={educationLevel}
                        value={educationDetails}
                        required={corporateType === "spk"}
                        onChange={(next) => {
                          setEducationDetails(next);
                          setErrors((e) => ({
                            ...e,
                            universityId: "",
                            departmentId: "",
                          }));
                        }}
                        errors={{
                          universityId: errors.universityId,
                          departmentId: errors.departmentId,
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
              </>
            )}

            {/* Password */}
            <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
              {({ onFocus, onBlur }) => (
                <>
                  <Text style={styles.label}>Şifre *</Text>
                  <TextInput
                    style={[styles.input, errors.password && styles.inputError, securePasswordInputStyle]}
                    placeholder="En az 8 karakter"
                    placeholderTextColor="#999"
                    secureTextEntry
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) setErrors((e) => ({ ...e, password: "" }));
                    }}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    onFocus={onFocus}
                    onBlur={onBlur}
                    {...securePasswordInputProps}
                  />
                  {errors.password ? (
                    <Text style={styles.fieldError}>{errors.password}</Text>
                  ) : null}
                </>
              )}
            </ScrollInputWrap>

            {/* Password Confirm */}
            <ScrollInputWrap scrollRef={scrollRef} style={styles.inputContainer}>
              {({ onFocus, onBlur }) => (
                <>
                  <Text style={styles.label}>Şifre Tekrar *</Text>
                  <TextInput
                    style={[styles.input, errors.passwordConfirm && styles.inputError, securePasswordInputStyle]}
                    placeholder="Şifrenizi tekrar girin"
                    placeholderTextColor="#999"
                    secureTextEntry
                    value={passwordConfirm}
                    onChangeText={(text) => {
                      setPasswordConfirm(text);
                      if (errors.passwordConfirm)
                        setErrors((e) => ({ ...e, passwordConfirm: "" }));
                    }}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    onFocus={onFocus}
                    onBlur={onBlur}
                    {...securePasswordInputProps}
                  />
                  {errors.passwordConfirm ? (
                    <Text style={styles.fieldError}>{errors.passwordConfirm}</Text>
                  ) : null}
                </>
              )}
            </ScrollInputWrap>

            {/* Devam - önce varlık kontrolü, yoksa OTP + modal */}
            <TouchableOpacity
              style={styles.button}
              onPress={handleDevam}
              disabled={isSending || isLoading}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Devam</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
        ) : null}

        {/* Login Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Zaten hesabınız var mı? </Text>
          <TouchableOpacity onPress={() => router.push("login")}>
            <Text style={styles.loginLink}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>

        <LandingLegalFooter tone="light" />
      </KeyboardAwareScrollScreen>

      {/* OTP Onay Modal */}
      <Modal
        visible={showOtpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOtpModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowOtpModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Doğrulama Kodu</Text>
            <Text style={styles.modalSubtitle}>
              {phoneNumber.slice(0, 3)}****{phoneNumber.slice(-2)} numarasına gönderilen 6 haneli kodu girin
            </Text>
            {otpModalError ? (
              <Text style={styles.modalError}>{otpModalError}</Text>
            ) : null}
            <TextInput
              style={[styles.input, styles.modalInput, otpModalError && styles.inputError]}
              placeholder="6 haneli kod"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(text) => {
                setOtp(text.replace(/\D/g, ""));
                setOtpModalError("");
              }}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleVerifyOTP}
              disabled={isLoading || isVerifying}
            >
              {isLoading || isVerifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Doğrula ve Kayıt Ol</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setShowOtpModal(false);
                setOtp("");
                setOtpModalError("");
              }}
            >
              <Text style={styles.modalCancelText}>İptal</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#1e293b",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  topbar: {
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
  topbarTitle: { fontSize: 20, fontWeight: "bold", color: "#fff", flex: 1, textAlign: "center" },
  headerRight: { width: 36, height: 36 },
  formHeader: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 24,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    color: "#666",
  },
  tabs: {
    flexDirection: "row",
    marginBottom: 24,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  activeTabText: {
    color: "#1a73e8",
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: "#fafafa",
    color: INPUT_TEXT_COLOR,
  },
  inputError: {
    borderColor: "#dc3545",
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: "#f0f0f0",
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRightWidth: 0,
  },
  phoneInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  fieldError: {
    color: "#dc3545",
    fontSize: 12,
    marginTop: 4,
  },
  select2Button: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: "#fafafa",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  select2ButtonText: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
    marginRight: 12,
  },
  select2Placeholder: {
    color: "#999",
  },
  select2Dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    padding: 10,
  },
  select2SearchInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#f8fafc",
  },
  corporateTypeTabs: {
    flexDirection: "row",
    gap: 8,
  },
  corporateTypeTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  corporateTypeTabActive: {
    backgroundColor: "#1a73e8",
    borderColor: "#1a73e8",
  },
  corporateTypeTabText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  corporateTypeTabTextActive: {
    color: "#fff",
  },
  educationOptions: {
    flexDirection: "row",
    gap: 8,
  },
  educationOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  educationOptionActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#1a73e8",
  },
  educationOptionDisabled: {
    opacity: 0.45,
  },
  educationOptionText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  educationOptionTextDisabled: {
    color: "#94a3b8",
  },
  educationOptionTextActive: {
    color: "#1a73e8",
  },
  graduationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  graduationRequiredBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626",
  },
  graduationInfoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  graduationInfoNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#1e3a8a",
  },
  stackedInput: {
    marginTop: 10,
  },
  helperText: {
    marginTop: 6,
    color: "#666",
    fontSize: 12,
  },
  companyPickerStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  companyResults: {
    marginTop: 8,
    maxHeight: 320,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  companyResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  companyResultTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  companyResultMeta: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  selectedCompanyBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectedCompanyText: {
    flex: 1,
  },
  selectedCompanyTitle: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "600",
  },
  selectedCompanyMeta: {
    color: "#1d4ed8",
    fontSize: 12,
    marginTop: 4,
  },
  clearCompanyText: {
    color: "#1a73e8",
    fontSize: 13,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#dc3545",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14,
    padding: 12,
    backgroundColor: "#f8d7da",
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalError: {
    color: "#dc3545",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalCancel: {
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: "#1a73e8",
    fontSize: 15,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  footerText: {
    color: "#666",
    fontSize: 14,
  },
  loginLink: {
    color: "#1a73e8",
    fontSize: 14,
    fontWeight: "600",
  },
});
