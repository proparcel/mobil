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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../../src/hooks/useNavigation";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../../services/authService";
import { storageService } from "../../../services/storageService";
import { StatusBar } from "react-native";

type MemberType = "individual" | "consultant" | "corporate";

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
  const [emlakYetkiBelgeNo, setEmlakYetkiBelgeNo] = useState("");
  const [vergiNo, setVergiNo] = useState("");
  const [vergiDairesi, setVergiDairesi] = useState("");
  const [companyVergiNo, setCompanyVergiNo] = useState("");
  const [companyVergiCheck, setCompanyVergiCheck] = useState<{
    checking: boolean;
    exists?: boolean;
    companyName?: string;
    lastChecked?: string;
    message?: string;
  }>({ checking: false });
  const lastCompanyVergiNoAlertedRef = useRef<string>("");
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

  // Danışman: Firma vergi no canlı kontrol (10 hane girilince)
  useEffect(() => {
    if (memberType !== "consultant") {
      setCompanyVergiCheck({ checking: false });
      return;
    }

    const vkn = (companyVergiNo || "").trim();
    if (!/^\d{10}$/.test(vkn)) {
      setCompanyVergiCheck({ checking: false });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setCompanyVergiCheck((s) => ({
          ...s,
          checking: true,
          lastChecked: vkn,
          message: undefined,
        }));
        const res = await authService.checkCompanyVergiNo(vkn);
        if (cancelled) return;

        const exists = !!res?.data?.exists;
        const companyName = (res?.data as any)?.company_name as string | undefined;
        setCompanyVergiCheck({
          checking: false,
          exists,
          companyName: (companyName || "").trim() || undefined,
          lastChecked: vkn,
          message: res?.message,
        });

        if (!exists) {
          setErrors((e) => ({
            ...e,
            companyVergiNo: "Bu vergi numarasıyla kayıtlı firma bulunamadı.",
          }));
        } else {
          setErrors((e) => ({ ...e, companyVergiNo: "" }));
        }
      } catch (e) {
        if (cancelled) return;
        setCompanyVergiCheck({
          checking: false,
          exists: undefined,
          lastChecked: vkn,
          message: "Kontrol sırasında hata oluştu",
        });
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyVergiNo, memberType]);

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
      if (!emlakYetkiBelgeNo || emlakYetkiBelgeNo.length !== 7 || !/^\d{7}$/.test(emlakYetkiBelgeNo)) {
        newErrors.emlakYetkiBelgeNo = "7 haneli emlak yetki belge no gereklidir";
      }
      if (!vergiNo || vergiNo.length !== 10 || !/^\d{10}$/.test(vergiNo)) {
        newErrors.vergiNo = "10 haneli vergi no gereklidir";
      }
      if (!vergiDairesi) {
        newErrors.vergiDairesi = "Vergi dairesi gereklidir";
      }
    }

    // Danışman için ek alanlar
    if (memberType === "consultant") {
      if (!companyVergiNo || companyVergiNo.length !== 10 || !/^\d{10}$/.test(companyVergiNo)) {
        newErrors.companyVergiNo = "10 haneli firma vergi no gereklidir";
      } else {
        // Firma varlık kontrolü
        const checkedSame = companyVergiCheck.lastChecked === companyVergiNo;
        if (companyVergiCheck.checking) {
          newErrors.companyVergiNo = "Firma vergi numarası doğrulanıyor...";
        } else if (!checkedSame || companyVergiCheck.exists !== true) {
          newErrors.companyVergiNo = "Bu vergi numarasıyla kayıtlı firma bulunamadı.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

    const registerData = {
      member_type: memberType,
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      password,
      password_confirm: passwordConfirm,
      referral_code: referralCode?.trim() || undefined,
      ...(memberType === "consultant" && {
        company_vergi_no: companyVergiNo,
      }),
      ...(memberType === "corporate" && {
        company_name: companyName,
        emlak_yetki_belge_no: emlakYetkiBelgeNo,
        vergi_no: vergiNo,
        vergi_dairesi: vergiDairesi,
      }),
    };

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

    const registerData = {
      member_type: memberType,
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      password,
      password_confirm: passwordConfirm,
      referral_code: referralCode?.trim() || undefined,
      ...(memberType === "consultant" && {
        company_vergi_no: companyVergiNo,
      }),
      ...(memberType === "corporate" && {
        company_name: companyName,
        emlak_yetki_belge_no: emlakYetkiBelgeNo,
        vergi_no: vergiNo,
        vergi_dairesi: vergiDairesi,
      }),
    };

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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
                  <Text style={styles.label}>Çalıştığınız Firmanın Vergi No *</Text>
                  <TextInput
                    style={[styles.input, errors.companyVergiNo && styles.inputError]}
                    placeholder="10 haneli vergi no"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={companyVergiNo}
                    onChangeText={(text) => {
                      setCompanyVergiNo(text.replace(/\D/g, ""));
                      if (errors.companyVergiNo) setErrors((e) => ({ ...e, companyVergiNo: "" }));
                    }}
                    onEndEditing={() => {
                      const vkn = (companyVergiNo || "").trim();
                      const checkedSame = companyVergiCheck.lastChecked === vkn;
                      if (/^\d{10}$/.test(vkn) && checkedSame && companyVergiCheck.exists === false) {
                        if (lastCompanyVergiNoAlertedRef.current !== vkn) {
                          lastCompanyVergiNoAlertedRef.current = vkn;
                          Alert.alert("Uyarı", "Bu vergi numarasıyla kayıtlı firma bulunamadı.");
                        }
                      }
                    }}
                  />
                  {companyVergiCheck.checking && companyVergiNo.length === 10 ? (
                    <Text style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
                      Firma doğrulanıyor...
                    </Text>
                  ) : null}
                  {!companyVergiCheck.checking &&
                  companyVergiNo.length === 10 &&
                  companyVergiCheck.lastChecked === companyVergiNo &&
                  companyVergiCheck.exists === true ? (
                    <Text style={{ marginTop: 6, color: "#198754", fontSize: 12 }}>
                      Firma bulundu{companyVergiCheck.companyName ? `: ${companyVergiCheck.companyName}` : ""}
                    </Text>
                  ) : null}
                  {errors.companyVergiNo ? (
                    <Text style={styles.fieldError}>{errors.companyVergiNo}</Text>
                  ) : null}
                </View>
              </>
            )}

            {/* Corporate Fields */}
            {memberType === "corporate" && (
              <>
                {/* Company Name */}
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

                {/* Emlak Yetki Belge No */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Emlak Yetki Belge No *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.emlakYetkiBelgeNo && styles.inputError,
                    ]}
                    placeholder="7 haneli kod"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={7}
                    value={emlakYetkiBelgeNo}
                    onChangeText={(text) => {
                      setEmlakYetkiBelgeNo(text.replace(/\D/g, ""));
                      if (errors.emlakYetkiBelgeNo)
                        setErrors((e) => ({ ...e, emlakYetkiBelgeNo: "" }));
                    }}
                  />
                  {errors.emlakYetkiBelgeNo ? (
                    <Text style={styles.fieldError}>{errors.emlakYetkiBelgeNo}</Text>
                  ) : null}
                </View>

                {/* Vergi No */}
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

                {/* Vergi Dairesi */}
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
      </ScrollView>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
