/**
 * AI Resim Canlandırma editörü — web drone-editor image_animation modu (yalnızca ilgili alanlar).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MobileAiScreenShell } from "../../components/app/MobileAiScreenHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";

import { useRouter, useLocalSearchParams } from "../../src/hooks/useNavigation";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { storageService } from "../../services/storageService";
import {
  IMAGE_ANIMATION_PACKAGE_UNITS,
  downloadImageAnimationResults,
  getImageAnimationCreditCosts,
  getImageAnimationPackageStatus,
  imageAnimationResultUrl,
  runwayPrepPushRef,
  runwayPrepStart,
  startImageAnimationAnimate,
  waitForImageAnimationReady,
  type MobileUploadImage,
} from "../../services/imageAnimationService";
import { AiImageAnimationExtraPurchaseModal } from "../../components/ai-image-animation/AiImageAnimationExtraPurchaseModal";
import { saveImageUrisToPhotoLibrary } from "../../src/utils/saveToDeviceGallery";
import {
  buildDroneProjectDisplayName,
  DRONE_PROJECT_LOCATION_MISSING_LABEL,
  parseDroneProjectLocationParams,
  validateDroneProjectLocation,
} from "../../src/utils/droneProjectContract";

const DE = {
  shell: "#0b1220",
  toolbar: "rgba(15, 23, 42, 0.96)",
  text: "#e5eefc",
  muted: "#94a3b8",
  border: "rgba(148, 163, 184, 0.22)",
  previewBg: "#020617",
  primary: "#38bdf8",
  primaryDark: "#0ea5e9",
  badge: "#22c55e",
  coin: "#fbbf24",
} as const;

const MAX_SLOTS = 8;

type SlotState = {
  image: MobileUploadImage | null;
  resultUrl: string | null;
  checked: boolean;
  busy: boolean;
};

function emptySlots(): SlotState[] {
  return Array.from({ length: MAX_SLOTS }, () => ({
    image: null,
    resultUrl: null,
    checked: true,
    busy: false,
  }));
}

export default function AiImageAnimationEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    license_ref?: string;
    display_name?: string;
    city?: string;
    district?: string;
    mahalle?: string;
    ada?: string;
    parsel?: string;
  }>();

  const projectLocation = useMemo(
    () => parseDroneProjectLocationParams(params),
    [params],
  );
  const displayName = useMemo(() => {
    const fromRoute = String(params.display_name || "").trim();
    if (fromRoute) return fromRoute;
    if (projectLocation) return buildDroneProjectDisplayName(projectLocation);
    return DRONE_PROJECT_LOCATION_MISSING_LABEL;
  }, [params.display_name, projectLocation]);
  const [licenseRef, setLicenseRef] = useState(String(params.license_ref || "").trim());

  const [prompt, setPrompt] = useState("");
  const [slots, setSlots] = useState<SlotState[]>(emptySlots);
  const [activeSlot, setActiveSlot] = useState(0);
  const [message, setMessage] = useState("Görsel yükleyin, prompt yazıp Canlandır'a basın.");
  const [busy, setBusy] = useState(false);
  const [packageRemaining, setPackageRemaining] = useState(0);
  const [packageUnitsTotal, setPackageUnitsTotal] = useState(IMAGE_ANIMATION_PACKAGE_UNITS);
  const [extraCoinCost, setExtraCoinCost] = useState(1);
  const [authHeader, setAuthHeader] = useState<Record<string, string> | undefined>(undefined);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [extraPurchaseVisible, setExtraPurchaseVisible] = useState(false);
  const [pendingAnimateCount, setPendingAnimateCount] = useState(0);

  useEffect(() => {
    const ref = String(params.license_ref || "").trim();
    const locCheck = validateDroneProjectLocation(projectLocation);
    if (!ref || !locCheck.ok) {
      router.replace("ai-image-animation-purchase");
    }
  }, [params.license_ref, projectLocation, router]);

  const refreshPackageStatus = useCallback(async (activeRef?: string) => {
    const res = await getImageAnimationPackageStatus(activeRef || licenseRef || undefined);
    if (!res.ok) return;
    setPackageRemaining(res.status.remainingUses);
    setPackageUnitsTotal(res.status.packageUnitsTotal);
    if (res.status.licenseRef) {
      setLicenseRef(res.status.licenseRef);
    }
  }, [licenseRef]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await storageService.getAccessToken();
      if (!cancelled && token) {
        setAuthHeader({ Authorization: `Bearer ${token}` });
      }
      const costs = await getImageAnimationCreditCosts();
      if (!cancelled && costs.ok) {
        setExtraCoinCost(costs.costs.image_animation);
      }
      if (!cancelled) {
        await refreshPackageStatus();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPackageStatus]);

  const imageSource = useCallback(
    (uri: string | null | undefined) => {
      if (!uri) return null;
      if (uri.startsWith("file:") || uri.startsWith("content:") || uri.startsWith("data:")) {
        return { uri };
      }
      if (authHeader) return { uri, headers: authHeader };
      return { uri };
    },
    [authHeader],
  );

  const filledCount = useMemo(() => slots.filter((s) => s.image).length, [slots]);
  const previewUrl = useMemo(() => {
    const slot = slots[activeSlot];
    return slot?.resultUrl || slot?.image?.uri || null;
  }, [activeSlot, slots]);
  const previewSource = useMemo(() => imageSource(previewUrl), [imageSource, previewUrl]);

  const hasPackageRights = packageRemaining > 0;
  const packageDepleted = packageRemaining === 0 && Boolean(licenseRef);
  const animateCoinCost = extraCoinCost;

  const selectedForAnimate = useMemo(
    () =>
      slots
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => slot.checked && slot.image),
    [slots],
  );

  const selectedResults = useMemo(
    () =>
      slots
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => slot.checked && slot.resultUrl),
    [slots],
  );

  const canDownload = selectedResults.length > 0 && !downloadBusy && !busy;

  const pickImage = useCallback(async (slotIndex: number) => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      quality: 0.88,
      selectionLimit: 1,
    });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert("Hata", result.errorMessage || "Görsel seçilemedi");
      return;
    }
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = {
        ...next[slotIndex],
        image: {
          uri: asset.uri!,
          name: asset.fileName || `ref_${slotIndex + 1}.jpg`,
          type: asset.type || "image/jpeg",
        },
        resultUrl: null,
        checked: true,
      };
      return next;
    });
    setActiveSlot(slotIndex);
    setMessage(`Kare ${slotIndex + 1} yüklendi.`);
  }, []);

  const toggleSlotChecked = useCallback((slotIndex: number) => {
    setSlots((prev) => {
      const next = [...prev];
      if (!next[slotIndex]?.image && !next[slotIndex]?.resultUrl) return prev;
      next[slotIndex] = { ...next[slotIndex], checked: !next[slotIndex].checked };
      return next;
    });
  }, []);

  const onDownloadSelected = useCallback(async () => {
    if (!selectedResults.length) {
      Alert.alert("Seçim", "İndirmek için canlandırılmış ve seçili en az bir kare işaretleyin.");
      return;
    }
    setDownloadBusy(true);
    setMessage("Görseller indiriliyor…");
    try {
      const urls = selectedResults.map(({ slot }) => slot.resultUrl!).filter(Boolean);
      const downloaded = await downloadImageAnimationResults(urls);
      if (!downloaded.ok) throw new Error(downloaded.error);

      const saved = await saveImageUrisToPhotoLibrary(downloaded.paths);
      if (!saved.ok) throw new Error(saved.error || "Galeriye kaydedilemedi.");

      setMessage(`${saved.savedCount} görsel galeriye kaydedildi.`);
      Alert.alert("İndirildi", `${saved.savedCount} görsel fotoğraf galerinize kaydedildi.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Görseller indirilemedi.";
      setMessage(msg);
      Alert.alert("Hata", msg);
    } finally {
      setDownloadBusy(false);
    }
  }, [selectedResults]);

  const executeAnimate = useCallback(async (activeLicenseRef?: string) => {
    const resolvedLicenseRef = String(activeLicenseRef || licenseRef || "").trim();
    if (!resolvedLicenseRef) {
      Alert.alert("Lisans", "Canlandırma lisansı bulunamadı.");
      return;
    }
    const promptText = prompt.trim();
    if (!promptText) {
      Alert.alert("Eksik", "Canlandırma promptu yazın.");
      return;
    }
    const selected = selectedForAnimate;
    if (!selected.length) {
      Alert.alert("Eksik", "Canlandırmak için en az bir görsel seçin.");
      return;
    }

    const locCheck = validateDroneProjectLocation(projectLocation);
    if (!locCheck.ok) {
      Alert.alert("Konum gerekli", locCheck.error);
      return;
    }

    setBusy(true);
    setMessage("Görseller hazırlanıyor...");
    try {
      const costs = await getImageAnimationCreditCosts();
      if (costs.ok) setExtraCoinCost(costs.costs.image_animation);

      const prep = await runwayPrepStart({
        refFrameCount: selected.length,
        location: locCheck.location,
        licenseRef: resolvedLicenseRef,
        promptText,
      });
      if (!prep.ok) throw new Error(prep.error);

      let uploaded = 0;
      await Promise.all(
        selected.map(async (src, i) => {
          const slotNumber = i + 1;
          const pushed = await runwayPrepPushRef(prep.jobId, slotNumber, src.slot.image!);
          if (!pushed.ok) throw new Error(pushed.error);
          uploaded += 1;
          setMessage(`Görseller yükleniyor (${uploaded}/${selected.length})…`);
        }),
      );

      setSlots((prev) => {
        const next = [...prev];
        for (const { index } of selected) {
          next[index] = { ...next[index], busy: true };
        }
        return next;
      });
      setMessage(`Paralel canlandırma (${selected.length} kare)…`);

      let completed = 0;
      const failures: string[] = [];

      await Promise.all(
        selected.map(async (src, i) => {
          const slotNumber = i + 1;
          const srcIndex = src.index;
          try {
            const started = await startImageAnimationAnimate({
              jobId: prep.jobId,
              slot: slotNumber,
              promptText,
              image: src.slot.image,
            });
            if (!started.ok) throw new Error(started.error);

            const ready = await waitForImageAnimationReady(
              prep.jobId,
              slotNumber,
              started.pollMs,
              240,
              (info) => {
                const label = String(info.label || "").trim();
                setMessage(
                  label ||
                    `Kare ${srcIndex + 1} canlandırılıyor… (${completed}/${selected.length} tamam)`,
                );
              },
            );
            if (!ready.ok) throw new Error(ready.error);

            const resultUrl = imageAnimationResultUrl(prep.jobId, slotNumber);
            completed += 1;
            setSlots((prev) => {
              const next = [...prev];
              next[srcIndex] = {
                ...next[srcIndex],
                resultUrl,
                busy: false,
                checked: true,
              };
              return next;
            });
            setMessage(`Canlandırılıyor… (${completed}/${selected.length} tamamlandı)`);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Canlandırma başarısız";
            failures.push(`Kare ${srcIndex + 1}: ${msg}`);
            setSlots((prev) => {
              const next = [...prev];
              next[srcIndex] = { ...next[srcIndex], busy: false };
              return next;
            });
          }
        }),
      );

      if (completed === 0) {
        throw new Error(failures[0] || "Hiçbir kare canlandırılamadı.");
      }

      if (completed > 0) {
        await refreshPackageStatus(resolvedLicenseRef);
        setActiveSlot(selected[0]!.index);
      }

      if (failures.length > 0) {
        Alert.alert(
          "Kısmen tamamlandı",
          `${completed}/${selected.length} kare hazır.\n\n${failures.join("\n")}`,
        );
        setMessage(`${completed}/${selected.length} kare canlandırıldı.`);
      } else {
        setMessage("Tüm kareler canlandırıldı. Seçili kareleri üst menüden indirebilirsiniz.");
      }
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Resim canlandırılamadı.");
      setSlots((prev) => prev.map((s) => ({ ...s, busy: false })));
    } finally {
      setBusy(false);
    }
  }, [licenseRef, projectLocation, prompt, refreshPackageStatus, selectedForAnimate]);

  const onAnimate = useCallback(() => {
    const promptText = prompt.trim();
    if (!promptText) {
      Alert.alert("Eksik", "Canlandırma promptu yazın.");
      return;
    }
    if (!selectedForAnimate.length) {
      Alert.alert("Eksik", "Canlandırmak için en az bir görsel seçin.");
      return;
    }
    if (hasPackageRights) {
      if (selectedForAnimate.length > packageRemaining) {
        Alert.alert(
          "Hak yetersiz",
          `Paketinizde ${packageRemaining} canlandırma hakkı kaldı. En fazla ${packageRemaining} kare seçin veya paket bittikten sonra ek kredi ile devam edin.`,
        );
        return;
      }
      void executeAnimate();
      return;
    }
    if (packageDepleted) {
      setPendingAnimateCount(selectedForAnimate.length);
      setExtraPurchaseVisible(true);
      return;
    }
    Alert.alert(
      "Paket gerekli",
      "Canlandırma hakkınız yok. Paket tanımlama sayfasından yeni paket satın alın veya mevcut paketinize devam edin.",
      [
        { text: "İptal", style: "cancel" },
        { text: "Paketler", onPress: () => router.replace("ai-image-animation-purchase") },
      ],
    );
  }, [
    executeAnimate,
    hasPackageRights,
    packageDepleted,
    packageRemaining,
    prompt,
    router,
    selectedForAnimate.length,
  ]);

  return (
    <MobileAiScreenShell
      title={displayName}
      subtitle="AI Resim Canlandırma"
      onBack={() => router.back()}
      pageBackgroundColor={DE.shell}
      right={
        <TouchableOpacity
          onPress={() => void onDownloadSelected()}
          disabled={!canDownload}
          style={[styles.headerBtn, !canDownload && styles.headerBtnDisabled]}
          accessibilityLabel="Seçili görselleri indir"
        >
          {downloadBusy ? (
            <ActivityIndicator color="#f8fafc" size="small" />
          ) : (
            <Ionicons
              name="download-outline"
              size={18}
              color={canDownload ? "#f8fafc" : "rgba(248,250,252,0.35)"}
            />
          )}
        </TouchableOpacity>
      }
    >
      <KeyboardAwareScrollScreen
        headerHeight={63}
        backgroundColor={DE.shell}
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: 20 + insets.bottom }]}
      >
        <View style={styles.previewWrap}>
          {previewSource ? (
            <Image source={previewSource} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.previewEmpty}>
              <Ionicons name="image-outline" size={48} color={DE.muted} />
              <Text style={styles.previewEmptyText}>Önizleme</Text>
            </View>
          )}
        </View>

        {message ? (
          <Text style={styles.statusMsg} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.panelToolbar}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => pickImage(activeSlot)}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={DE.text} />
              <Text style={styles.secondaryBtnText}>Resim Yükle</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.panelHint}>
            Görsel yükleyin, canlandırılacak kareleri seçin, prompt yazıp Canlandır'a basın.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
            {slots.map((slot, index) => {
              const thumb = slot.resultUrl || slot.image?.uri;
              const isActive = activeSlot === index;
              return (
                <TouchableOpacity
                  key={`slot-${index}`}
                  style={[styles.slotCard, isActive && styles.slotCardActive]}
                  onPress={() => setActiveSlot(index)}
                  activeOpacity={0.9}
                >
                  {thumb ? (
                    <Image source={imageSource(thumb) || { uri: thumb }} style={styles.slotThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.slotPlaceholder}>
                      <Text style={styles.slotPlaceholderText}>Kare {index + 1}</Text>
                    </View>
                  )}
                  {slot.busy ? (
                    <View style={styles.slotLoading}>
                      <ActivityIndicator color={DE.primary} size="small" />
                    </View>
                  ) : null}
                  {slot.resultUrl ? (
                    <View style={styles.slotBadge}>
                      <Text style={styles.slotBadgeText}>Canlandırılmış</Text>
                    </View>
                  ) : null}
                  {slot.image || slot.resultUrl ? (
                    <TouchableOpacity
                      style={styles.slotCheck}
                      onPress={() => toggleSlotChecked(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={slot.checked ? "checkbox" : "square-outline"}
                        size={18}
                        color={slot.checked ? DE.primary : DE.muted}
                      />
                    </TouchableOpacity>
                  ) : null}
                  <Text style={styles.slotCaption}>
                    Kare {index + 1}
                    {slot.image && hasPackageRights ? (
                      <Text style={styles.rightBadge}> · paket</Text>
                    ) : slot.image && filledCount > 0 && packageDepleted ? (
                      <Text style={styles.coinBadge}> · +{animateCoinCost} kredi</Text>
                    ) : null}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.promptLabel}>Canlandırma promptu</Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            style={styles.promptInput}
            placeholder="Örn. Daha yeşil çevre, yumuşak gün batımı tonu..."
            placeholderTextColor={DE.muted}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (busy || filledCount < 1) && styles.primaryBtnDisabled]}
            onPress={() => void onAnimate()}
            disabled={busy || filledCount < 1}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#0f172a" />
                <Text style={styles.primaryBtnText}>Canlandır</Text>
                {hasPackageRights ? (
                  <Text style={styles.primaryBadge}>{packageRemaining} hak</Text>
                ) : packageDepleted && filledCount > 0 ? (
                  <Text style={styles.primaryCoin}>+{animateCoinCost} kredi</Text>
                ) : null}
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.note}>
            {hasPackageRights
              ? `${displayName} — ${packageRemaining}/${packageUnitsTotal} canlandırma hakkı kaldı.`
              : packageDepleted
                ? `Paket hakkınız bitti. Yeniden canlandırma +${extraCoinCost} kredi / kare. Canlandır ile onay modalı açılır.`
                : "Canlandırma hakkınız yok. Paket tanımlama sayfasına dönün."}
          </Text>
        </View>
      </KeyboardAwareScrollScreen>

      <AiImageAnimationExtraPurchaseModal
        visible={extraPurchaseVisible}
        onClose={() => setExtraPurchaseVisible(false)}
        displayName={displayName}
        licenseRef={licenseRef}
        selectedCount={pendingAnimateCount}
        onPurchaseSuccess={() => executeAnimate()}
      />
    </MobileAiScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: DE.shell },
  bodyContent: { padding: 12, gap: 10 },
  previewWrap: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: DE.previewBg,
    borderWidth: 1,
    borderColor: DE.border,
  },
  previewImage: { width: "100%", height: "100%" },
  previewEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  previewEmptyText: { color: DE.muted, fontSize: 13 },
  statusMsg: {
    color: DE.muted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  panel: {
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DE.border,
    padding: 14,
    gap: 10,
  },
  panelToolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DE.border,
    backgroundColor: "rgba(30, 41, 59, 0.6)",
  },
  secondaryBtnText: { color: DE.text, fontWeight: "700", fontSize: 14 },
  panelHint: { color: DE.muted, fontSize: 12, lineHeight: 17 },
  slotRow: { gap: 10, paddingVertical: 4 },
  slotCard: {
    width: 108,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: DE.border,
    backgroundColor: DE.previewBg,
  },
  slotCardActive: { borderColor: DE.primary },
  slotThumb: { width: 108, height: 88 },
  slotPlaceholder: {
    width: 108,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.5)",
  },
  slotPlaceholderText: { color: DE.muted, fontSize: 11 },
  slotLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(34, 197, 94, 0.9)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  slotBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  slotCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 6,
    padding: 2,
  },
  slotCaption: {
    padding: 6,
    fontSize: 11,
    color: DE.muted,
    fontWeight: "600",
  },
  rightBadge: { color: DE.badge, fontWeight: "800" },
  coinBadge: { color: DE.coin, fontWeight: "800" },
  promptLabel: { color: DE.text, fontWeight: "700", fontSize: 13, marginTop: 4 },
  promptInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: DE.border,
    borderRadius: 10,
    padding: 12,
    color: DE.text,
    backgroundColor: "rgba(11, 18, 32, 0.9)",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: DE.primary,
    borderRadius: 10,
    paddingVertical: 14,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#0f172a", fontWeight: "900", fontSize: 15 },
  primaryBadge: {
    color: "#14532d",
    fontWeight: "800",
    fontSize: 12,
    backgroundColor: "rgba(34, 197, 94, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  primaryCoin: {
    color: "#78350f",
    fontWeight: "800",
    fontSize: 12,
    backgroundColor: "rgba(251, 191, 36, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  note: { color: DE.muted, fontSize: 11, lineHeight: 16 },
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
  headerBtnDisabled: { opacity: 0.45 },
});
