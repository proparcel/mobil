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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";

import { useRouter, useLocalSearchParams } from "../../src/hooks/useNavigation";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { storageService } from "../../services/storageService";
import {
  getImageAnimationCreditCosts,
  imageAnimationResultUrl,
  runwayPrepPushRef,
  runwayPrepStart,
  startImageAnimationAnimate,
  waitForImageAnimationReady,
  type MobileUploadImage,
} from "../../services/imageAnimationService";

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
    image_animation_title?: string;
    license_ref?: string;
  }>();

  const animationTitle = String(params.image_animation_title || "AI Resim Canlandırma").trim();
  const licenseRef = String(params.license_ref || "").trim();

  const [prompt, setPrompt] = useState("");
  const [slots, setSlots] = useState<SlotState[]>(emptySlots);
  const [activeSlot, setActiveSlot] = useState(0);
  const [message, setMessage] = useState("Görsel yükleyin, prompt yazıp Canlandır'a basın.");
  const [busy, setBusy] = useState(false);
  const [licenseConsumed, setLicenseConsumed] = useState(false);
  const [extraCoinCost, setExtraCoinCost] = useState(1);
  const [authHeader, setAuthHeader] = useState<Record<string, string> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await storageService.getAccessToken();
      if (!cancelled && token) {
        setAuthHeader({ Authorization: `Bearer ${token}` });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const showUsageRight = !licenseConsumed && filledCount > 0;

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
      if (!next[slotIndex]?.image) return prev;
      next[slotIndex] = { ...next[slotIndex], checked: !next[slotIndex].checked };
      return next;
    });
  }, []);

  const onAnimate = useCallback(async () => {
    const promptText = prompt.trim();
    if (!promptText) {
      Alert.alert("Eksik", "Canlandırma promptu yazın.");
      return;
    }
    const selected = slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.checked && slot.image);
    if (!selected.length) {
      Alert.alert("Eksik", "Canlandırmak için en az bir görsel seçin.");
      return;
    }

    setBusy(true);
    setMessage("Görseller hazırlanıyor...");
    try {
      const costs = await getImageAnimationCreditCosts();
      if (costs.ok) setExtraCoinCost(costs.costs.image_animation);

      const prep = await runwayPrepStart({
        refFrameCount: selected.length,
        title: animationTitle,
        licenseRef,
        promptText,
      });
      if (!prep.ok) throw new Error(prep.error);

      for (let i = 0; i < selected.length; i += 1) {
        const slotNumber = i + 1;
        const src = selected[i];
        setMessage(`Görsel yükleniyor (${i + 1}/${selected.length})...`);
        const pushed = await runwayPrepPushRef(prep.jobId, slotNumber, src.slot.image!);
        if (!pushed.ok) throw new Error(pushed.error);
      }

      for (let i = 0; i < selected.length; i += 1) {
        const slotNumber = i + 1;
        const srcIndex = selected[i].index;
        setSlots((prev) => {
          const next = [...prev];
          next[srcIndex] = { ...next[srcIndex], busy: true };
          return next;
        });
        setMessage(`OpenAI ile canlandırılıyor (${i + 1}/${selected.length})...`);

        const started = await startImageAnimationAnimate({
          jobId: prep.jobId,
          slot: slotNumber,
          promptText,
          image: selected[i].slot.image,
        });
        if (!started.ok) throw new Error(started.error);

        if (started.async) {
          const ready = await waitForImageAnimationReady(prep.jobId, slotNumber, started.pollMs);
          if (!ready.ok) throw new Error(ready.error);
        }

        const resultUrl = imageAnimationResultUrl(prep.jobId, slotNumber);
        setSlots((prev) => {
          const next = [...prev];
          next[srcIndex] = {
            ...next[srcIndex],
            resultUrl,
            busy: false,
          };
          return next;
        });
        setActiveSlot(srcIndex);
      }

      setLicenseConsumed(true);
      setMessage("Resim canlandırıldı. Sonuçları kartlardan görebilirsiniz.");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Resim canlandırılamadı.");
      setSlots((prev) => prev.map((s) => ({ ...s, busy: false })));
    } finally {
      setBusy(false);
    }
  }, [animationTitle, licenseRef, prompt, slots]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.toolbarBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color={DE.text} />
        </TouchableOpacity>
        <View style={styles.toolbarCenter}>
          <Text style={styles.toolbarTitle} numberOfLines={1}>
            {animationTitle}
          </Text>
          <Text style={styles.toolbarSub}>AI Resim Canlandırma</Text>
        </View>
        <View style={styles.toolbarBtn} />
      </View>

      <KeyboardAwareScrollScreen
        headerHeight={52}
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
                  {slot.image ? (
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
                    {slot.image && showUsageRight && index === 0 ? (
                      <Text style={styles.rightBadge}> · 1 hak</Text>
                    ) : slot.image && licenseConsumed ? (
                      <Text style={styles.coinBadge}> · +{extraCoinCost} coin</Text>
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
                {showUsageRight ? (
                  <Text style={styles.primaryBadge}>1 hak</Text>
                ) : filledCount > 0 ? (
                  <Text style={styles.primaryCoin}>+{extraCoinCost} coin</Text>
                ) : null}
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.note}>
            {licenseConsumed
              ? `Paket hakkı kullanıldı; yeniden canlandırma +${extraCoinCost} coin.`
              : "Yalnızca canlandırma promptu kullanılır; paket hakkı ilk başarılı canlandırmada tüketilir."}
          </Text>
        </View>
      </KeyboardAwareScrollScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DE.shell },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: DE.toolbar,
    borderBottomWidth: 1,
    borderBottomColor: DE.border,
  },
  toolbarBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  toolbarCenter: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  toolbarTitle: { fontSize: 15, fontWeight: "800", color: DE.text },
  toolbarSub: { fontSize: 11, color: DE.muted, marginTop: 2 },
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
});
