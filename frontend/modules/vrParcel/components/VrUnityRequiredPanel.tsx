import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { VrUnityLinkStatus } from "../native/VrUnityModule";

type Props = {
  linkStatus: VrUnityLinkStatus;
  onBack: () => void;
  onClose: () => void;
};

export function VrUnityRequiredPanel({ linkStatus, onBack, onClose }: Props): React.ReactElement {
  const missingBridge = linkStatus === "missing_bridge";
  const staleExport = linkStatus === "linked_stale_export";
  const unityLinked = linkStatus === "linked";

  return (
    <View style={styles.root}>
      <MaterialCommunityIcons
        name={staleExport ? "camera-off-outline" : "cube-off-outline"}
        size={48}
        color="#f59e0b"
      />
      <Text style={styles.title}>
        {missingBridge
          ? Platform.OS === "android"
            ? "Android build gerekli"
            : "Development IPA gerekli"
          : staleExport
            ? "Unity AR export eksik"
          : unityLinked
            ? "Unity oturumu açılamadı"
          : Platform.OS === "android"
            ? "Unity Android export gerekli"
            : "Unity iOS export gerekli"}
      </Text>
      <Text style={styles.body}>
        {missingBridge
          ? Platform.OS === "android"
            ? "VR köprüsü bu APK'da yok. npm run android ile güncel native build kurun."
            : "VR köprüsü bu kurulumda yok. Expo Go veya eski IPA kullanıyorsanız AR adımları açılmaz."
          : staleExport
            ? "Unity açılıyor ama APK'daki export AR scriptlerini içermiyor — bu yüzden sanal zemin/gökyüzü görürsünüz, gerçek kamera gelmez. Unity Editor'de VrParcelScene + ARCore ile yeniden export alın."
          : unityLinked
            ? "unityLibrary bağlı görünüyor ama oturum başlatılamadı. Uygulamayı kapatıp tekrar deneyin veya adb uninstall com.proparcel.mobile ardından npm run android."
          : Platform.OS === "android"
            ? "RN köprüsü var; unityLibrary henüz Gradle'a bağlanmadı (VR_UNITY_LINKED=false). Unity export + npm run android gerekir."
            : "EAS IPA köprüyü içeriyor; UnityFramework henüz embed edilmedi. Mac + Unity iOS export gerekir."}
      </Text>
      <Text style={styles.bodySecondary}>
        Parsel çizimi AR world içinde sabit kalmalıdır. Sahte RN overlay devre dışı — yanlış sonuç
        üretmemesi için AR adımları Unity + {Platform.OS === "ios" ? "ARKit" : "ARCore"} olmadan açılmaz.
      </Text>
      <View style={styles.codeBox}>
        {missingBridge ? (
          Platform.OS === "android" ? (
            <>
              <Text style={styles.codeLabel}>1. Native Android build</Text>
              <Text style={styles.codeText}>npm run prebuild:android:safe</Text>
              <Text style={styles.codeText}>npm run android</Text>
            </>
          ) : (
            <>
              <Text style={styles.codeLabel}>1. Development IPA</Text>
              <Text style={styles.codeText}>npm run eas:build:ios</Text>
              <Text style={styles.codeText}>npm run start:ios-dev</Text>
            </>
          )
        ) : staleExport ? (
          <>
            <Text style={styles.codeLabel}>Unity Editor (Windows) — zorunlu yeniden export</Text>
            <Text style={styles.codeText}>ProParcel → VR → Create VrParcel Scene</Text>
            <Text style={styles.codeText}>XR Plug-in Management → Android → ARCore ✓</Text>
            <Text style={styles.codeText}>ProParcel → VR → Configure Android Build Settings</Text>
            <Text style={styles.codeText}>Export → builds/android/unityLibrary</Text>
            <Text style={styles.codeText}>npm run prebuild:android:safe</Text>
            <Text style={styles.codeText}>npm run android</Text>
            <Text style={styles.codeHint}>node scripts/validate-unity-export.js ile dogrulayin</Text>
          </>
        ) : Platform.OS === "android" ? (
          <>
            <Text style={styles.codeLabel}>Unity Editor (Windows)</Text>
            <Text style={styles.codeText}>ProParcel → VR → Configure Android Build Settings</Text>
            <Text style={styles.codeText}>Export → builds/android/unityLibrary</Text>
            <Text style={styles.codeText}>npm run prebuild:android:safe</Text>
            <Text style={styles.codeHint}>android_windows_unity_build.md</Text>
          </>
        ) : (
          <>
            <Text style={styles.codeLabel}>Mac + Unity Editor</Text>
            <Text style={styles.codeText}>unity/vrParcel → iOS Export</Text>
            <Text style={styles.codeText}>UnityFramework embed + VR_UNITY_LINKED=1</Text>
            <Text style={styles.codeHint}>mac_xcode_unity_build.md</Text>
          </>
        )}
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={onBack}>
        <Text style={styles.primaryBtnText}>Harita Adımlarına Dön</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
        <Text style={styles.secondaryBtnText}>Kapat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b1220",
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { color: "#94a3b8", fontSize: 15, lineHeight: 22, textAlign: "center" },
  bodySecondary: { color: "#64748b", fontSize: 13, lineHeight: 19, textAlign: "center" },
  codeBox: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    width: "100%",
    marginVertical: 8,
    gap: 4,
  },
  codeLabel: { color: "#cbd5e1", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  codeText: { color: "#93c5fd", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12 },
  codeHint: { color: "#64748b", fontSize: 11, marginTop: 4 },
  primaryBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 240,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { paddingVertical: 10 },
  secondaryBtnText: { color: "#64748b", fontWeight: "600" },
});

export default VrUnityRequiredPanel;
