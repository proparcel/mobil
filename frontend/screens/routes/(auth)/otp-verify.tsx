/**
 * ProParcel OTP Verify Screen
 * 
 * Telefon doğrulama için OTP girişi.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter, useLocalSearchParams } from "../../../src/hooks/useNavigation";
import { useAuth } from "../../contexts/AuthContext";
import { StatusBar } from "react-native";

export default function OTPVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone: string; mode?: string }>();
  const { verifyOTP, sendOTP, isLoading } = useAuth();

  // State
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Refs for input focus
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const phoneNumber = params.phone || "";
  const mode = params.mode || "verify"; // register, forgot, veya verify

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  /**
   * OTP input handler
   */
  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Paste handling
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      
      // Focus last filled input or next empty
      const lastIndex = Math.min(index + digits.length - 1, 5);
      inputRefs.current[lastIndex]?.focus();
    } else {
      const newOtp = [...otp];
      newOtp[index] = value.replace(/\D/g, "");
      setOtp(newOtp);

      // Auto focus next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    setError("");
  };

  /**
   * Handle backspace
   */
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Verify OTP
   */
  const handleVerify = async () => {
    const otpCode = otp.join("");
    
    if (otpCode.length !== 6) {
      setError("6 haneli kodu eksiksiz girin");
      return;
    }

    setError("");

    // OTP verify ekranı artık sadece register ve forgot password için kullanılır
    // Login OTP kaldırıldı
    if (mode === "register" || mode === "forgot") {
      const success = await verifyOTP(phoneNumber, otpCode);
      if (success) {
        Alert.alert("Başarılı", "Telefon numaranız doğrulandı", [
          { text: "Tamam", onPress: () => router.back() },
        ]);
      } else {
        setError("Geçersiz doğrulama kodu");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } else {
      // Genel verify (geriye dönük uyumluluk)
      const success = await verifyOTP(phoneNumber, otpCode);
      if (success) {
        Alert.alert("Başarılı", "Telefon numaranız doğrulandı", [
          { text: "Tamam", onPress: () => router.back() },
        ]);
      } else {
        setError("Geçersiz doğrulama kodu");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    }
  };

  /**
   * Resend OTP
   */
  const handleResend = async () => {
    if (!canResend) return;

    const success = await sendOTP(phoneNumber);
    if (success) {
      setCountdown(60);
      setCanResend(false);
      Alert.alert("Başarılı", "Yeni doğrulama kodu gönderildi");
    } else {
      Alert.alert("Hata", "Kod gönderilemedi. Lütfen tekrar deneyin.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Doğrulama</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Doğrulama Kodu</Text>
          <Text style={styles.formSubtitle}>
            {phoneNumber.slice(0, 3)}****{phoneNumber.slice(-2)} numarasına gönderilen 6 haneli kodu girin
          </Text>
        </View>

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* OTP Inputs */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[styles.otpInput, digit && styles.otpInputFilled]}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.button, otp.join("").length !== 6 && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isLoading || otp.join("").length !== 6}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Doğrula</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Kod gelmedi mi? </Text>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>Tekrar Gönder</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.countdown}>{countdown}s</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
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
  error: {
    color: "#dc3545",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "#fafafa",
  },
  otpInputFilled: {
    borderColor: "#1a73e8",
    backgroundColor: "#e8f0fe",
  },
  button: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  resendText: {
    color: "#666",
    fontSize: 14,
  },
  resendLink: {
    color: "#1a73e8",
    fontSize: 14,
    fontWeight: "600",
  },
  countdown: {
    color: "#999",
    fontSize: 14,
  },
});
