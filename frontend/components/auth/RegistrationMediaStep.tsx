import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import Ionicons from "react-native-vector-icons/Ionicons";

export type RegistrationMediaValue = {
  avatarUri: string | null;
  companyLogoUri: string | null;
};

type Props = {
  memberType: "individual" | "consultant" | "corporate";
  value: RegistrationMediaValue;
  onChange: (next: RegistrationMediaValue) => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function RegistrationMediaStep({ memberType, value, onChange, onContinue, onSkip }: Props) {
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [showRemoveBgModal, setShowRemoveBgModal] = useState(false);
  const [picking, setPicking] = useState(false);

  const pickImage = async (target: "avatar" | "logo") => {
    setPicking(true);
    try {
      const result = await launchImageLibrary({
        mediaType: "photo",
        quality: 0.8,
        selectionLimit: 1,
      });
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      if (target === "avatar") {
        setPendingAvatarUri(uri);
        setShowRemoveBgModal(true);
      } else {
        onChange({ ...value, companyLogoUri: uri });
      }
    } finally {
      setPicking(false);
    }
  };

  const confirmAvatar = () => {
    if (!pendingAvatarUri) return;
    onChange({ ...value, avatarUri: pendingAvatarUri });
    setPendingAvatarUri(null);
    setShowRemoveBgModal(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Profil Fotoğrafı</Text>
      <Text style={styles.cardHint}>
        Fotoğrafınızı şimdi seçebilirsiniz. Bu adım isteğe bağlıdır; kayıt tamamlanırken yüklenir.
      </Text>

      {value.avatarUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: value.avatarUri }} style={styles.preview} />
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => onChange({ ...value, avatarUri: null })}
          >
            <Ionicons name="close-circle" size={22} color="#dc2626" />
            <Text style={styles.clearBtnText}>Kaldır</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => pickImage("avatar")}
        disabled={picking}
      >
        {picking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {value.avatarUri ? "Fotoğrafı Değiştir" : "Fotoğraf Seç"}
          </Text>
        )}
      </TouchableOpacity>

      {memberType === "corporate" ? (
        <>
          <Text style={[styles.cardTitle, styles.logoTitle]}>Firma Logosu</Text>
          <Text style={styles.cardHint}>Kurumsal hesaplar için logo yükleyebilirsiniz (opsiyonel).</Text>
          {value.companyLogoUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: value.companyLogoUri }} style={styles.preview} />
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => onChange({ ...value, companyLogoUri: null })}
              >
                <Ionicons name="close-circle" size={22} color="#dc2626" />
                <Text style={styles.clearBtnText}>Kaldır</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => pickImage("logo")}
            disabled={picking}
          >
            <Text style={styles.secondaryButtonText}>
              {value.companyLogoUri ? "Logoyu Değiştir" : "Logo Seç"}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}

      <TouchableOpacity style={styles.primaryButton} onPress={onContinue}>
        <Text style={styles.primaryButtonText}>Devam</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={onSkip}>
        <Text style={styles.secondaryButtonText}>Şimdilik Geç</Text>
      </TouchableOpacity>

      <Modal
        visible={showRemoveBgModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemoveBgModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowRemoveBgModal(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Fotoğraf Seçildi</Text>
            <Text style={styles.modalText}>
              Kayıt tamamlandığında fotoğraf yüklenecek. Sunucu tarafında arka plan temizleme uygulanabilir.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={confirmAvatar}>
              <Text style={styles.primaryButtonText}>Tamam</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 24,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 8 },
  logoTitle: { marginTop: 16 },
  cardHint: { fontSize: 14, color: "#6b7280", marginBottom: 12, lineHeight: 20 },
  previewWrap: { alignItems: "center", marginBottom: 12 },
  preview: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#e5e7eb" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  clearBtnText: { color: "#dc2626", fontWeight: "600" },
  primaryButton: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#fff",
  },
  secondaryButtonText: { color: "#334155", fontSize: 16, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 8 },
  modalText: { fontSize: 14, color: "#6b7280", marginBottom: 16, lineHeight: 20 },
});
