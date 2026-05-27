/**
 * ProParcel Register Screen
 * 
 * Yeni kullanıcı kaydı - Bireysel/Kurumsal + OTP akışı.
 */

import React, { useEffect, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../../src/hooks/useNavigation";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../../services/authService";
import { storageService } from "../../../services/storageService";
import { StatusBar } from "react-native";
import { KeyboardAwareScrollScreen } from "../../../components/app/KeyboardAwareScrollScreen";
import { LandingLegalFooter } from "../../../components/landing/LandingLegalFooter";
import { AddressPickerModal, type AddressValue } from "../../../components/app/AddressPickerModal";

type MemberType = "individual" | "consultant" | "corporate";
type CorporateType = "emlak" | "spk" | "lihkab";

type CompanySearchItem = {
  id?: number;
  company_name?: string;
  name?: string;
  title?: string;
  vergi_no: string;
  vergi_dairesi?: string;
  corporate_type?: "emlak" | "spk" | "lihkab" | null;
};

function getCompanyDisplayName(company: CompanySearchItem | null): string {
  if (!company) return "";
  return (company.company_name || company.name || company.title || company.vergi_no || "").trim();
}

function getConsultantTypeFromCompany(company: CompanySearchItem | null): "emlak" | "spk" | "lihkab" {
  return company?.corporate_type || "emlak";
}

export default function RegisterScreen() {
  const router = useRouter();
  const { isLoading } = useAuth();

  // State
  const [memberType, setMemberType] = useState<MemberType>("individual");
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
  const [vergiNo, setVergiNo] = useState("");
  const [vergiDairesi, setVergiDairesi] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [educationLevel, setEducationLevel] = useState<number | null>(null);
  const [universityId, setUniversityId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [showCorporateAddressModal, setShowCorporateAddressModal] = useState(false);
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
  const [companySearchResults, setCompanySearchResults] = useState<CompanySearchItem[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchItem | null>(null);
  const [isCompanySearching, setIsCompanySearching] = useState(false);
  const [companySearchError, setCompanySearchError] = useState("");
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpModalError, setOtpModalError] = useState("");

  useEffect(() => {
    storageService.getDeferredReferralCode().then((code) => {
      if (code) setReferralCode(code);
    });
  }, []);

  // Danışman: Firma arama (autocomplete)
  useEffect(() => {
    if (memberType !== "consultant") {
      setIsCompanySearching(false);
      setCompanySearchResults([]);
      setIsCompanyPickerOpen(false);
      return;
    }

    const q = companySearchText.trim();
    if (q && /^\d+$/.test(q)) {
      setIsCompanySearching(false);
      setCompanySearchResults([]);
      setCompanySearchError("Firma adı ile arama yapın.");
      return;
    }

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
        const res = await authService.listCompanies(q, 20);
        if (cancelled) return;

        setCompanySearchResults((res.data || []).filter((company) => !!company.vergi_no));
        if (!res.success) setCompanySearchError(res.message || "Firma araması yapılamadı.");
      } catch (e) {
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
      if (!vergiNo || vergiNo.length !== 10 || !/^\d{10}$/.test(vergiNo)) {
        newErrors.vergiNo = "10 haneli vergi no gereklidir";
      }
      if (!vergiDairesi) {
        newErrors.vergiDairesi = "Vergi dairesi gereklidir";
      }
      if (!corporateAddress.cityId || !corporateAddress.districtId || !corporateAddress.quarterValue) {
        newErrors.address = "Adres için il, ilçe ve mahalle seçiniz";
      }
      if (!corporateAddress.streetAndNumber.trim()) {
        newErrors.streetAndNumber = "Sokak ve numara bilgisi gereklidir";
      }
      if (corporateType === "spk") {
        if (educationLevel === null) {
          newErrors.educationLevel = "Mezuniyet seviyesi seçiniz";
        }
        if ((educationLevel === 1 || educationLevel === 2) && !universityId.trim()) {
          newErrors.universityId = "Üniversite ID gereklidir";
        }
      }
    }

    // Danışman için ek alanlar
    if (memberType === "consultant") {
      if (!selectedCompany) {
        newErrors.companyPicker = "Lütfen listeden firma seçiniz";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildRegisterData = () => {
    const selectedCompanyVergiNo = (selectedCompany?.vergi_no || "").trim();

    return {
      member_type: memberType,
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      password,
      password_confirm: passwordConfirm,
      referral_code: referralCode?.trim() || undefined,
      ...(memberType === "consultant" && selectedCompanyVergiNo && {
        consultant_type: getConsultantTypeFromCompany(selectedCompany),
        consultant_license_no: "",
        company_vergi_no: selectedCompanyVergiNo,
      }),
      ...(memberType === "corporate" && {
        corporate_type: corporateType || undefined,
        company_name: companyName,
        company_license_no: companyLicenseNo,
        office_no: corporateType === "lihkab" ? officeNo.trim() : undefined,
        spk_tc_no: corporateType === "spk" ? spkTcNo : undefined,
        vergi_no: vergiNo,
        vergi_dairesi: vergiDairesi,
        city_id: corporateAddress.cityId || undefined,
        district_id: corporateAddress.districtId || undefined,
        quarter_id: corporateAddress.quarterId || undefined,
        quarter_value: corporateAddress.quarterValue || undefined,
        city_name: corporateAddress.cityName || undefined,
        district_name: corporateAddress.districtName || undefined,
        quarter_name: corporateAddress.quarterName || undefined,
        street_and_number: corporateAddress.streetAndNumber.trim(),
        postal_code: postalCode.trim() || undefined,
        education_level: educationLevel ?? undefined,
        university_id: universityId.trim() ? Number(universityId.trim()) : undefined,
        department_id: departmentId.trim() ? Number(departmentId.trim()) : undefined,
        custom_department: customDepartment.trim() || undefined,
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

  /**
   * Devam: Önce bilgi varlığı kontrolü → varsa uyarı, yoksa OTP gönderip modal aç
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
        setErrors({ general: validateRes.message || "Bilgilerinizi kontrol edin." });
        setIsSending(false);
        return;
      }

      const sendRes = await authService.registerSendOTP(registerData);

      if (!sendRes.success) {
        setErrors({ general: sendRes.message || "Kod gönderilemedi. Lütfen tekrar deneyin." });
        setIsSending(false);
        return;
      }

      setOtpModalError("");
      setOtp("");
      setShowOtpModal(true);
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
    if (!otp || otp.length !== 6) {
      setOtpModalError("6 haneli doğrulama kodunu girin");
      return;
    }

    const registerData = buildRegisterData();

    setOtpModalError("");

    try {
      const response = await authService.registerVerifyOTP(registerData, otp);

      if (response.success && response.data) {
        setShowOtpModal(false);
        await storageService.clearDeferredReferralCode();
        if (memberType === "individual") {
          router.replace("index");
        } else {
          router.replace("complete-registration");
        }
      } else {
        setOtpModalError(response.message || "Geçersiz doğrulama kodu");
      }
    } catch (error) {
      setOtpModalError("Bir hata oluştu. Lütfen tekrar deneyin.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Kayıt Ol</Text>
        <View style={styles.headerRight} />
      </View>
      <KeyboardAwareScrollScreen
        behaviorContext="auth"
        headerHeight={56}
        backgroundColor="#fff"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Hesap Oluştur</Text>
          <Text style={styles.formSubtitle}>ProParcel'e hoş geldiniz</Text>
        </View>

        {/* Error Message */}
        {errors.general ? <Text style={styles.error}>{errors.general}</Text> : null}

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
            <View style={styles.inputContainer}>
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
              />
              {errors.firstName ? (
                <Text style={styles.fieldError}>{errors.firstName}</Text>
              ) : null}
            </View>

            {/* Last Name */}
            <View style={styles.inputContainer}>
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
              />
              {errors.lastName ? (
                <Text style={styles.fieldError}>{errors.lastName}</Text>
              ) : null}
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
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
              />
              {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
            </View>

            {/* Phone */}
            <View style={styles.inputContainer}>
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
                />
              </View>
              {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}
            </View>

            {/* Referral Code (optional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Referans Kodu (opsiyonel)</Text>
              <TextInput
                style={styles.input}
                placeholder="Referans kodun var mı?"
                placeholderTextColor="#999"
                value={referralCode}
                onChangeText={setReferralCode}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Consultant Fields */}
            {memberType === "consultant" && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Firma Seç</Text>
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
                  {isCompanyPickerOpen ? (
                    <View style={styles.select2Dropdown}>
                      <TextInput
                        style={styles.select2SearchInput}
                        placeholder="Firma adı ile ara"
                        placeholderTextColor="#999"
                        value={companySearchText}
                        onChangeText={(text) => {
                          setCompanySearchText(text);
                          setCompanySearchError("");
                        }}
                        autoCapitalize="words"
                        autoCorrect={false}
                      />

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
                        <Text style={styles.helperText}>Firma adı yazarak listeden seçim yapın.</Text>
                      ) : null}

                      {companySearchResults.length > 0 ? (
                        <ScrollView style={styles.companyResults} keyboardShouldPersistTaps="handled">
                          {companySearchResults.map((company) => {
                            const displayName = getCompanyDisplayName(company);
                            return (
                              <TouchableOpacity
                                key={`${company.vergi_no}-${company.id || displayName}`}
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
                                {company.vergi_dairesi ? (
                                  <Text style={styles.companyResultMeta}>{company.vergi_dairesi}</Text>
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
                        {selectedCompany.vergi_dairesi ? (
                          <Text style={styles.selectedCompanyMeta}>{selectedCompany.vergi_dairesi}</Text>
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
              </>
            )}

            {/* Corporate Fields */}
            {memberType === "corporate" && (
              <>
                <View style={styles.inputContainer}>
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
                  />
                  {errors.companyName ? (
                    <Text style={styles.fieldError}>{errors.companyName}</Text>
                  ) : null}
                </View>

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
                            setUniversityId("");
                            setDepartmentId("");
                            setCustomDepartment("");
                          }
                          if (errors.corporateType) setErrors((e) => ({ ...e, corporateType: "" }));
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
                  <View style={styles.inputContainer}>
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
                    />
                    {errors.spkTcNo ? (
                      <Text style={styles.fieldError}>{errors.spkTcNo}</Text>
                    ) : null}
                  </View>
                ) : null}

                {corporateType === "lihkab" ? (
                  <View style={styles.inputContainer}>
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
                    />
                    {errors.officeNo ? (
                      <Text style={styles.fieldError}>{errors.officeNo}</Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.inputContainer}>
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
                  />
                  {errors.companyLicenseNo ? (
                    <Text style={styles.fieldError}>{errors.companyLicenseNo}</Text>
                  ) : null}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Vergi No *</Text>
                  <TextInput
                    style={[styles.input, errors.vergiNo && styles.inputError]}
                    placeholder="10 haneli kod"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={vergiNo}
                    onChangeText={(text) => {
                      setVergiNo(text.replace(/\D/g, ""));
                      if (errors.vergiNo) setErrors((e) => ({ ...e, vergiNo: "" }));
                    }}
                  />
                  {errors.vergiNo ? (
                    <Text style={styles.fieldError}>{errors.vergiNo}</Text>
                  ) : null}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Vergi Dairesi *</Text>
                  <TextInput
                    style={[styles.input, errors.vergiDairesi && styles.inputError]}
                    placeholder="Vergi dairesi adı"
                    placeholderTextColor="#999"
                    value={vergiDairesi}
                    onChangeText={(text) => {
                      setVergiDairesi(text);
                      if (errors.vergiDairesi)
                        setErrors((e) => ({ ...e, vergiDairesi: "" }));
                    }}
                  />
                  {errors.vergiDairesi ? (
                    <Text style={styles.fieldError}>{errors.vergiDairesi}</Text>
                  ) : null}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Adres *</Text>
                  <TouchableOpacity
                    style={[
                      styles.select2Button,
                      (errors.address || errors.streetAndNumber) && styles.inputError,
                    ]}
                    onPress={() => setShowCorporateAddressModal(true)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.select2ButtonText,
                        !corporateAddress.cityName && styles.select2Placeholder,
                      ]}
                    >
                      {corporateAddress.cityName
                        ? `${corporateAddress.cityName} / ${corporateAddress.districtName || "-"} / ${corporateAddress.quarterName || "-"}`
                        : "İl, ilçe, mahalle ve sokak seçin"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#64748b" />
                  </TouchableOpacity>
                  {corporateAddress.streetAndNumber ? (
                    <Text style={styles.helperText}>{corporateAddress.streetAndNumber}</Text>
                  ) : null}
                  {errors.address ? <Text style={styles.fieldError}>{errors.address}</Text> : null}
                  {errors.streetAndNumber ? <Text style={styles.fieldError}>{errors.streetAndNumber}</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Posta Kodu (opsiyonel)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Posta kodu"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={postalCode}
                    onChangeText={(text) => setPostalCode(text.replace(/\D/g, ""))}
                  />
                </View>

                {corporateType === "spk" ? (
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Mezuniyet Bilgileri *</Text>
                    <View style={styles.educationOptions}>
                      {[
                        { value: 0, label: "Lise" },
                        { value: 2, label: "Ön Lisans" },
                        { value: 1, label: "Lisans" },
                      ].map((item) => (
                        <TouchableOpacity
                          key={item.value}
                          style={[
                            styles.educationOption,
                            item.value !== 1 && styles.educationOptionDisabled,
                            educationLevel === item.value && styles.educationOptionActive,
                          ]}
                          onPress={() => {
                            setEducationLevel(item.value);
                            if (errors.educationLevel) setErrors((e) => ({ ...e, educationLevel: "" }));
                          }}
                          disabled={item.value !== 1}
                        >
                          <Text
                            style={[
                              styles.educationOptionText,
                              item.value !== 1 && styles.educationOptionTextDisabled,
                              educationLevel === item.value && styles.educationOptionTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {errors.educationLevel ? (
                      <Text style={styles.fieldError}>{errors.educationLevel}</Text>
                    ) : null}

                    {(educationLevel === 1 || educationLevel === 2) ? (
                      <>
                        <TextInput
                          style={[styles.input, styles.stackedInput, errors.universityId && styles.inputError]}
                          placeholder="Üniversite ID *"
                          placeholderTextColor="#999"
                          keyboardType="number-pad"
                          value={universityId}
                          onChangeText={(text) => {
                            setUniversityId(text.replace(/\D/g, ""));
                            if (errors.universityId) setErrors((e) => ({ ...e, universityId: "" }));
                          }}
                        />
                        {errors.universityId ? (
                          <Text style={styles.fieldError}>{errors.universityId}</Text>
                        ) : null}
                        <TextInput
                          style={[styles.input, styles.stackedInput]}
                          placeholder="Bölüm ID (opsiyonel)"
                          placeholderTextColor="#999"
                          keyboardType="number-pad"
                          value={departmentId}
                          onChangeText={(text) => setDepartmentId(text.replace(/\D/g, ""))}
                        />
                        <TextInput
                          style={[styles.input, styles.stackedInput]}
                          placeholder="Bölüm listede yoksa yazın"
                          placeholderTextColor="#999"
                          value={customDepartment}
                          onChangeText={setCustomDepartment}
                        />
                      </>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Şifre *</Text>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="En az 8 karakter"
                placeholderTextColor="#999"
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors((e) => ({ ...e, password: "" }));
                }}
              />
              {errors.password ? (
                <Text style={styles.fieldError}>{errors.password}</Text>
              ) : null}
            </View>

            {/* Password Confirm */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Şifre Tekrar *</Text>
              <TextInput
                style={[styles.input, errors.passwordConfirm && styles.inputError]}
                placeholder="Şifrenizi tekrar girin"
                placeholderTextColor="#999"
                secureTextEntry
                value={passwordConfirm}
                onChangeText={(text) => {
                  setPasswordConfirm(text);
                  if (errors.passwordConfirm)
                    setErrors((e) => ({ ...e, passwordConfirm: "" }));
                }}
              />
              {errors.passwordConfirm ? (
                <Text style={styles.fieldError}>{errors.passwordConfirm}</Text>
              ) : null}
            </View>

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

        {/* Login Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Zaten hesabınız var mı? </Text>
          <TouchableOpacity onPress={() => router.push("login")}>
            <Text style={styles.loginLink}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>

        <LandingLegalFooter tone="light" />
      </KeyboardAwareScrollScreen>

      <AddressPickerModal
        visible={showCorporateAddressModal}
        title="Kurumsal Adres"
        initialValue={corporateAddress}
        saveLabel="Adresi Seç"
        onCancel={() => setShowCorporateAddressModal(false)}
        onSave={(addr) => {
          setCorporateAddress(addr);
          setShowCorporateAddressModal(false);
          setErrors((e) => ({ ...e, address: "", streetAndNumber: "" }));
        }}
      />

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
              disabled={isLoading}
            >
              {isLoading ? (
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
