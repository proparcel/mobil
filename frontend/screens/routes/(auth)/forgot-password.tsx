/**
 * ProParcel Forgot Password Screen
 * 
 * Şifre sıfırlama - Çok adımlı OTP akışı (email → phone → OTP → reset).
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "../../../src/hooks/useNavigation";
import { authService } from "../../../services/authService";
import { KeyboardAwareScrollScreen } from "../../../components/app/KeyboardAwareScrollScreen";

type ResetStep = "email" | "phone" | "otp" | "reset";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  // State
  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Adım 1: E-posta doğrulama
   */
  const handleEmailStep = async () => {
    if (!email) {
      setError("E-posta adresi gereklidir");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Geçerli bir e-posta adresi girin");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await authService.requestPasswordResetStep1(email);

      if (response.success) {
        setStep("phone");
      } else {
        setError(response.message || "Bir hata oluştu");
      }
    } catch (error) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Adım 2: Telefon doğrulama ve OTP gönderimi
   */
  const handlePhoneStep = async () => {
    if (!phoneNumber || phoneNumber.length !== 10 || !phoneNumber.startsWith("5")) {
      setError("Geçerli bir telefon numarası girin (5XXXXXXXXX)");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await authService.requestPasswordResetStep2(email, phoneNumber);

      if (response.success) {
        setStep("otp");
        Alert.alert("Başarılı", "Doğrulama kodu telefonunuza gönderildi");
      } else {
        setError(response.message || "OTP gönderilemedi");
      }
    } catch (error) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Adım 3: OTP doğrulama ve token alma
   */
  const handleOTPStep = async () => {
    if (!otp || otp.length !== 6) {
      setError("6 haneli doğrulama kodunu girin");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await authService.requestPasswordResetStep3(email, phoneNumber, otp);

      if (response.success && response.data?.token) {
        setToken(response.data.token);
        setStep("reset");
      } else {
        setError(response.message || "Geçersiz doğrulama kodu");
      }
    } catch (error) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Adım 4: Şifre sıfırlama
   */
  const handleResetStep = async () => {
    if (!password) {
      setError("Şifre gereklidir");
      return;
    }

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await authService.confirmPasswordReset({
        token,
        password,
        password_confirm: passwordConfirm,
      });

      if (response.success) {
        Alert.alert("Başarılı", "Şifreniz başarıyla güncellendi", [
          { text: "Tamam", onPress: () => router.replace("login") },
        ]);
      } else {
        setError(response.message || "Şifre güncellenemedi");
      }
    } catch (error) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Şifre Sıfırla</Text>
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
          <Text style={styles.formTitle}>Şifremi Unuttum</Text>
          <Text style={styles.formSubtitle}>
            {step === "email" && "E-posta adresinizi girin"}
            {step === "phone" && "Telefon numaranızı girin"}
            {step === "otp" && "Doğrulama kodunu girin"}
            {step === "reset" && "Yeni şifrenizi belirleyin"}
          </Text>
        </View>

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Step 1: Email */}
        {step === "email" && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="E-posta adresi"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError("");
              }}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleEmailStep}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Devam</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Phone */}
        {step === "phone" && (
          <View style={styles.form}>
            <Text style={styles.infoText}>
              E-posta: {email}
            </Text>
            <View style={styles.phoneInputContainer}>
              <Text style={styles.phonePrefix}>+90</Text>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                placeholder="5XX XXX XX XX"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={(text) => {
                  setPhoneNumber(text.replace(/\D/g, ""));
                  setError("");
                }}
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handlePhoneStep}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>OTP Gönder</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setStep("email");
                setPhoneNumber("");
                setError("");
              }}
            >
              <Text style={styles.backButtonText}>← Geri</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: OTP */}
        {step === "otp" && (
          <View style={styles.form}>
            <Text style={styles.infoText}>
              {phoneNumber.slice(0, 3)}****{phoneNumber.slice(-2)} numarasına kod gönderildi
            </Text>
            <TextInput
              style={styles.input}
              placeholder="6 haneli doğrulama kodu"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(text) => {
                setOtp(text.replace(/\D/g, ""));
                setError("");
              }}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleOTPStep}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Doğrula ve Şifre Sıfırlamaya Geç</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setStep("phone");
                setOtp("");
                setError("");
              }}
            >
              <Text style={styles.backButtonText}>← Geri</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 4: Reset Password */}
        {step === "reset" && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Yeni şifre"
              placeholderTextColor="#999"
              secureTextEntry
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError("");
              }}
            />
            <TextInput
              style={styles.input}
              placeholder="Yeni şifre tekrar"
              placeholderTextColor="#999"
              secureTextEntry
              value={passwordConfirm}
              onChangeText={(text) => {
                setPasswordConfirm(text);
                setError("");
              }}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleResetStep}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Şifreyi Güncelle</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAwareScrollScreen>
    </View>
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
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  formSubtitle: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
  backButton: {
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: "#1a73e8",
  },
  form: {
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
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
    marginBottom: 0,
  },
  button: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
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
  infoText: {
    textAlign: "center",
    color: "#666",
    marginBottom: 16,
    fontSize: 14,
  },
});
